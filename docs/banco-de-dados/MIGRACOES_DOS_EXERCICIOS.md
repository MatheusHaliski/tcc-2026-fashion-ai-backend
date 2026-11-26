# Migrações Flyway dos exercícios de banco de dados

Situação em **26/11/2026**. Produção: MySQL **9.7** no Railway (schema `fashionai`). No último deploy ativo da API
(#564) o Flyway registrou `Current version of schema fashionai: 110`. As versões 111 e 112 entram no próximo deploy; as versões 114, 115 e 116 (exercícios 09 a 11) entram no seguinte.

## Regras

1. **Toda mudança de schema de exercício vira migração versionada** em
   `fai-infrastructure/persistence-mysql/src/main/resources/db/migration`. O SQL rodado à mão no Railway não substitui
   a migração, porque um banco novo (CI, outra máquina, restauração) só tem o que está versionado.
2. **A partir da V110 a migração é idempotente.** Ela confere no `information_schema` e cria só o que falta, com os
   mesmos nomes do SQL entregue no exercício. Também cobre os desvios mais prováveis de um SQL rodado à mão:
   - coluna que falta (`ativo` e as de auditoria);
   - UNIQUE que falta, criado quando não há código repetido;
   - collation diferente entre a coluna da FK e a tabela de opções, alinhada enquanto nenhuma FK depende dela;
   - CHECK criado sem nome, reconhecido pelo conteúdo.

   As sementes entram uma a uma, com `WHERE NOT EXISTS` pelo código. Linhas já cadastradas não são alteradas.
3. **A migração não compara a definição de um objeto que já existe**, como a regra ON DELETE/ON UPDATE de uma FK ou a
   faixa de um CHECK. Isso aparece na conferência antes do deploy, logo abaixo.
4. **O `MigrationIdempotencyTest` barra no CI** os seguintes casos:
   - DDL sem guarda, inclusive em `PREPARE` de texto fixo, em comentário executável `/*! */` e em versões `V113_1__`;
   - `REPLACE`;
   - `INSERT` sem proteção contra duplicata;
   - `UPDATE`/`DELETE` sem `WHERE`.
5. **Migração já aplicada no Railway não é editada.** O checksum muda e o Flyway recusa subir a API. Uma correção vira
   uma versão nova.
6. **A versão menor entra antes.** O `out-of-order` está desligado, então uma V111 que chegue depois de uma V112
   aplicada faz a validação falhar. Por isso a V111 e a V112 estão no mesmo PR.

## Exercício → migração

| Nº | Exercício | Objetos | Migração | Situação |
|---|---|---|---|---|
| 01 | Tipo de look | `TipoLook`; `mirror_states.tipo_look_id` (`fk_mirror_tipo_look`); `schemes.tipo_look_id` (`fk_scheme_tipo_look`); `user_preferences.default_tipo_look_id` (`fk_preferences_default_tipo_look`, SET NULL) | V60, V107 | aplicadas. A V107 não tem guardas, mas já rodou e não deve ser editada |
| 02 | Estado de conservação | `EstadoConservacao`; `wardrobe_items.estado_de_conservacao` (`fk_wardrobe_items_estado_conservacao`, SET NULL / CASCADE) | V77 | aplicada |
| 03 | Instrução de lavagem | `TipoLavagem`; `wardrobe_items.tipo_lavagem_id` (`fk_wardrobe_items_tipo_lavagem`, SET NULL / CASCADE) | V77 | aplicada |
| 04 | Nível térmico do look | `niveis_termicos`; `schemes.nivel_termico_id` (`fk_schemes_nivel_termico`, RESTRICT / RESTRICT) | V110 | aplicada |
| 05 | Origem da peça | `origem` (+ `nome`, `ativo`); `wardrobe_items.origem_id` (`fk_wardrobe_items_origem`, SET NULL / CASCADE) | V105, V106 | aplicadas. `origem.codigo` é `ENUM('ADQUIRIDA','HERDADA','TROCADA')` no banco, e a entidade mapeia texto de até 30: uma origem nova exige migração que amplie o ENUM |
| 06 | Estação do look | `estacoes` (chave `codigo` = texto do enum `Season`); `fk_schemes_estacao`, `fk_moments_estacao`, `fk_dna_schemes_estacao` (RESTRICT / RESTRICT) | **V111** | criada à mão no Railway; a V111 só cria o que faltar |
| 13 | Marca exigida pela política do selo | nenhum objeto novo: `brandReference {kind, id, nome}` dentro do JSON `seals.background_config_json`; o serviço confere o ID em `brands` ou `brand_profiles` (não há FK) | — (V118 sem uso) | nada a rodar no Railway |
| 14 | Canal de utilização do cupom | `canais_cupom` (`uq_canais_cupom_codigo`); `canal_cupom_id` em `promotions`, `flair_combinations`, `promotion_redemptions`, `flair_redemptions` (`fk_<tabela>_canal_cupom`, RESTRICT / RESTRICT); `canal_codigo_snapshot` nos dois resgates | **V119** | SQL manual em `solucoes/sql/railway/14-canal-cupom.sql`; a V119 só cria o que faltar |
| 15 | Valor mínimo de compra do cupom | `promotions.min_purchase`, `min_purchase_currency`; `flair_combinations.min_purchase_currency`; `min_purchase_snapshot` e `min_purchase_currency_snapshot` nos dois resgates; CHECKs `ck_flair_min_purchase`, `ck_promotion_min_purchase`, `ck_pr_min_snapshot`, `ck_fr_min_snapshot` | **V120** | SQL manual em `solucoes/sql/railway/15-minimo-compra.sql`; a V120 só cria o que faltar. Mínimo negativo antigo em `flair_combinations` faz o CHECK falhar (3819) |
| 16 | CBC: cenário preferido | `cbc_scenarios` (`uq_cbc_scenarios_codigo`); `cbc_challenge_scenarios` (`fk_ccs_challenge` CASCADE, `fk_ccs_scenario` RESTRICT); `cbc_preferences` (`fk_cbcp_user` CASCADE, `fk_cbcp_allowed` composta, RESTRICT) | **V121** | SQL manual em `solucoes/sql/railway/16-preferencia-cbc.sql`; a V121 só cria o que faltar |
| 17 | Tipo de dinâmica da Trend | nenhum objeto novo: `community_trends.kind` (V63) segue VARCHAR validado pelo serviço, sem FK nem CHECK | — (V122 sem uso) | nada a rodar no Railway |
| 19 | Modalidade visual da peça na AURA | nenhum objeto novo: `aura.format` (`IMAGEM_UNICA` / `MOSAICO`) dentro do JSON `wardrobe_items.background_config_json`, validado pelo serviço (sem CHECK no banco) | — (V124 sem uso) | nada a rodar no Railway |
| 20 | Variante do catálogo por SKU e cor | nenhum objeto novo: `catalog_variants` (`sku`, `color`) e `wardrobe_items.catalog_product_id` / `catalog_variant_id` (V30/V34) já existem; a variante pertencer ao produto é conferida no serviço | — (V125 sem uso) | nada a rodar no Railway |
| 07 | Iluminação e temperatura (no acervo, porque o quarto saiu do app) | `tipos_iluminacao` (`uq_tipos_iluminacao_codigo`); `acervo_ambientes.tipo_iluminacao_id` e `temperatura_kelvin`; `fk_acervo_ambientes_tipo_iluminacao` (RESTRICT / RESTRICT); `ck_acervo_ambientes_kelvin` (2700–6500 K ou NULL) | **V112** | criada à mão no Railway; a V112 só cria o que faltar |
| 08 | Nome do módulo de armazenamento (no acervo, porque o quarto saiu do app) | nenhum objeto novo: o nome é `acervo_compartimentos.nome` e o endereço da peça é `acervo_pecas.compartimento_id` (V102) | — (V113 sem uso) | sem mudança de schema |
| 09 | Categoria principal da marca | `categorias_marca` (`uq_categorias_marca_codigo`); `brand_profiles.categoria_marca_id` (`fk_brand_profiles_categoria_marca`, RESTRICT / RESTRICT). O texto `brand_profiles.fashion_category` continua | **V114** | a criar à mão no Railway com `solucoes/sql/railway/09-categoria-marca.sql`; a V114 só cria o que faltar |
| 10 | Área artística principal da celebridade | `areas_artisticas` (`uq_areas_artisticas_codigo`); `celebrity_profiles.area_artistica_principal_id` (`fk_celebrity_area_principal`, RESTRICT / RESTRICT). A lista `celebrity_profiles.areas_json` continua | **V115** | a criar à mão no Railway com `solucoes/sql/railway/10-area-artistica.sql`; a V115 só cria o que faltar |
| 11 | Prazo de disponibilidade do selo | `ck_seals_availability_order` em `seals` (fim ≥ início, ou um dos dois NULL). As colunas `available_from` / `available_until` são da V2/V20 | **V116** | a criar à mão no Railway com `solucoes/sql/railway/11-prazo-selo.sql`; a V116 só cria se faltar e se não houver selo com o período invertido |
| 12 | Política do selo: quantidade mínima por cor | nenhum objeto novo: a regra fica em `seals.background_config_json` (`$.policy.rules[*]`) | — (V117 sem uso) | sem mudança de schema |

FK entre colunas de texto exige o mesmo charset e a mesma collation dos dois lados; se não forem iguais, o MySQL dá o
erro 3780. Por isso as migrações alinham as colunas:
- na V111, `estacoes.codigo` segue `schemes.season`;
- na V112, `acervo_ambientes.tipo_iluminacao_id` segue `tipos_iluminacao.id`.
- na V114, `brand_profiles.categoria_marca_id` segue `categorias_marca.id`;
- na V115, `celebrity_profiles.area_artistica_principal_id` segue `areas_artisticas.id`.

## Conferência antes do deploy (só leitura, no console do Railway)

Rode no banco da API (`fashionai`). O primeiro `SELECT` confirma isso; se não for, use `USE fashionai;` antes.

```sql
SELECT DATABASE() AS banco;
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;

-- objetos
SELECT 'tabela' AS tipo, TABLE_NAME AS objeto FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('estacoes', 'tipos_iluminacao')
UNION ALL
SELECT 'coluna', CONCAT(TABLE_NAME, '.', COLUMN_NAME) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME IN ('tipo_iluminacao_id', 'temperatura_kelvin')
UNION ALL
SELECT 'fk', CONCAT(CONSTRAINT_NAME, ': ', TABLE_NAME, '.', COLUMN_NAME, ' -> ', REFERENCED_TABLE_NAME) FROM information_schema.KEY_COLUMN_USAGE
 WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN ('estacoes', 'tipos_iluminacao')
UNION ALL
SELECT 'check', CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND CONSTRAINT_TYPE = 'CHECK'
ORDER BY 1, 2;

-- definição: regras das FKs, faixa do CHECK e collations
SELECT CONSTRAINT_NAME, TABLE_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN ('estacoes', 'tipos_iluminacao') ORDER BY 1;
SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc
 JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'acervo_ambientes' AND tc.CONSTRAINT_TYPE = 'CHECK';
SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND (
 (TABLE_NAME IN ('schemes', 'moments') AND COLUMN_NAME = 'season') OR (TABLE_NAME = 'dna_schemes' AND COLUMN_NAME = 'seasonal_theme')
 OR (TABLE_NAME = 'estacoes' AND COLUMN_NAME = 'codigo') OR (TABLE_NAME = 'tipos_iluminacao' AND COLUMN_NAME = 'id')
 OR (TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'tipo_iluminacao_id')) ORDER BY 1, 2;

-- as opções: colunas e linhas
SELECT TABLE_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) AS colunas FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('estacoes', 'tipos_iluminacao') GROUP BY TABLE_NAME;
SELECT e.*, HEX(e.nome) AS bytes_do_nome FROM estacoes e;
SELECT codigo, COUNT(*) AS linhas FROM tipos_iluminacao GROUP BY codigo ORDER BY codigo;
```

Resultado esperado antes do deploy:
- **Banco e histórico:** o banco é `fashionai`, e o histórico do Flyway termina em `110`.
- **Objetos:** 2 tabelas, 2 colunas, 4 FKs e 1 CHECK (`ck_acervo_ambientes_kelvin`).
- **FKs:** as 4 com `DELETE_RULE` e `UPDATE_RULE` = `RESTRICT`.
- **CHECK:** `((temperatura_kelvin is null) or (temperatura_kelvin between 2700 and 6500))`.
- **Collations:**
  - `estacoes.codigo` igual às três colunas de estação;
  - `tipos_iluminacao.id` igual a `acervo_ambientes.tipo_iluminacao_id`.
- **Colunas:** as duas tabelas têm `codigo`, `nome`, `ativo`, `created_at`, `updated_at`, `created_by` e
  `last_modified_by`. `estacoes` tem também `ordem`, e `tipos_iluminacao` tem `id`.
- **Linhas:** as 4 estações; em `tipos_iluminacao`, **1 linha por código** (QUENTE, NEUTRA, FRIA, NATURAL).

Com isso a V111 e a V112 não mudam nada. Se algo vier diferente:

| O que a conferência mostra | O que acontece no deploy |
|---|---|
| Falta tabela, coluna, FK, CHECK ou o UNIQUE de `tipos_iluminacao` | A migração cria. Uma FK só entra se todos os valores já gravados existirem na tabela de opções (valor legado: erro 1452, ver abaixo) |
| Collation diferente e a FK ainda não existe | A migração alinha a coluna e cria a FK |
| FK com outra regra (CASCADE, SET NULL) ou CHECK com outra faixa | A migração **não mexe**, porque o objeto existe. Corrija à mão antes do deploy: `DROP` e `ADD` com a definição do exercício |
| Mais de 1 linha para o mesmo código em `tipos_iluminacao` | A migração não duplica nada e não cria o UNIQUE, que falharia com 1062. Apague a linha repetida que não estiver em uso por `acervo_ambientes` e crie à mão: `ALTER TABLE tipos_iluminacao ADD CONSTRAINT uq_tipos_iluminacao_codigo UNIQUE (codigo);` |
| Códigos do SQL antigo do exercício (`AMBIENTE`, `DIRECIONADA`, `DIFUSA`, de `solucoes/sql/07-iluminacao-quarto.sql`) | Ficam ao lado dos quatro novos. Se não forem usados, desative: `UPDATE tipos_iluminacao SET ativo = FALSE WHERE codigo IN (...)` |

Em `estacoes`, `Verão` deve ter os bytes `566572C3A36F`. Se aparecer `566572C383C2A36F` (exibido como "VerÃ£o"), o
cliente usado no SQL manual não estava em utf8mb4. A migração não corrige o nome de linhas existentes. O app não exibe
esse nome (usa o enum e o i18n), mas ele pode ser corrigido à mão.

Diagnóstico de valor legado fora dos quatro códigos (deve voltar vazio):

```sql
SELECT 'schemes' AS tabela, season AS valor, COUNT(*) AS qtd FROM schemes WHERE season NOT IN ('SPRING','SUMMER','AUTUMN','WINTER') GROUP BY season
UNION ALL SELECT 'moments', season, COUNT(*) FROM moments WHERE season NOT IN ('SPRING','SUMMER','AUTUMN','WINTER') GROUP BY season
UNION ALL SELECT 'dna_schemes', seasonal_theme, COUNT(*) FROM dna_schemes WHERE seasonal_theme NOT IN ('SPRING','SUMMER','AUTUMN','WINTER') GROUP BY seasonal_theme;
```

## Validação feita em laboratório

Ambiente: MySQL 8.0.46 local e descartável, com o mesmo Flyway 12.4.0 da API rodando as migrações reais do
repositório. Nada disso foi executado no Railway. Uma revisão independente tentou quebrar a V111 e a V112 com SQL
manual incompleto ou com erros de digitação. As correções que ela motivou estão nos cenários marcados com *.

| Cenário | Resultado |
|---|---|
| Banco novo, V1 → V112 | 111 migrações aplicadas; V111 e V112 `SUCCESS` |
| Railway simulado: V110 + o SQL manual dos exercícios 06 e 07, depois o deploy | V111 e V112 `SUCCESS` sem alterar nada; `validate` ok; schema idêntico ao do banco novo (FKs, UNIQUE, CHECK, índices, collation) |
| Estado parcial (faltando FKs de `moments`/`dna_schemes` e o CHECK) | a migração cria só o que falta; o schema final é idêntico ao do banco novo |
| \* Tabelas criadas à mão **sem a coluna `ativo`** | a migração cria a coluna e grava as sementes; o schema final é idêntico. Antes da correção: erro 1054 e a versão marcada como falha |
| \* `tipos_iluminacao` criada **sem o UNIQUE** em `codigo` | a migração cria o `uq_tipos_iluminacao_codigo` e não duplica as opções; o schema final é idêntico. Antes: as quatro opções em dobro |
| \* Sem o UNIQUE e com um código **já repetido à mão** | a migração não duplica nada e não cria o UNIQUE; a conferência mostra a linha repetida |
| \* Tabelas do app em `utf8mb4_unicode_ci` e o banco com padrão `utf8mb4_0900_ai_ci`, sem SQL manual | V111 e V112 `SUCCESS`: cada coluna de FK segue a collation da tabela de opções. Antes: erro 3780 na V112 |
| \* `estacoes` criada à mão com a collation padrão, diferente da de `schemes.season`, e sem FKs (a FK manual daria 3780) | a V111 alinha `estacoes.codigo`, cria as 3 FKs e mantém as 4 linhas |
| \* CHECK de kelvin criado à mão sem nome (`acervo_ambientes_chk_1`) | reconhecido pelo conteúdo: a V112 não cria um segundo CHECK |
| Valor legado `VERAO` em `schemes.season` | a V111 para com o erro 1452: não inventa estação nem pula a FK em silêncio |
| Integridade depois da V111/V112 | `'Inverno'` → 1452; apagar ou renomear estação em uso → 1451; 2000 K e 6501 K → 3819; 2700 K e 6500 K aceitos; tipo de iluminação inexistente → 1452; apagar tipo em uso → 1451; desativar (`ativo = FALSE`) é aceito |
| Reexecutar os dois scripts no mesmo banco | nenhum erro, nenhuma linha nova, schema igual; tipo desativado continua desativado |
| A própria API (o Flyway dela e o Hibernate) num banco novo, com o código do exercício 07 | 111 migrações aplicadas e a API sobe. O script de atualização do Hibernate não pede nenhuma tabela nem coluna: tudo o que as entidades dos exercícios 01 a 07 usam está versionado. As diferenças restantes ficam fora dos exercícios: tipos (tinyint × integer, precisão de decimal) e nomes de UNIQUE gerados pelo Hibernate |

O teste com o binário do MySQL 9.7 não foi feito localmente.
- **Já rodou no Railway em 9.7:** o padrão base da V110 (`IF NOT EXISTS`, guardas no `information_schema`, `PREPARE`).
- **Ainda não rodou lá:** o `CREATE TABLE` montado com `CONCAT`, o `SET @x = (SELECT ...)` e a junção
  `TABLE_CONSTRAINTS` × `CHECK_CONSTRAINTS`. São recursos padrão do MySQL desde a 8.0.16 e não há mudança conhecida
  deles na 9.x.
- **Regra do 8.4+ atendida:** as FKs apontam para chaves primárias, como exige `restrict_fk_on_non_standard_key`.

## Se uma migração falhar no deploy

1. O log do deploy no Railway mostra a versão, o comando e o código do erro (o Flyway imprime `SQL State` e
   `Error Code`).
2. **1452** em `fk_*_estacao` significa valor legado fora dos quatro códigos. Rode o diagnóstico acima e corrija esses
   registros. Trocar por `NULL` (sem estação) é decisão de quem responde pelos dados.
3. No MySQL a versão que falhou fica com `success = 0` no `flyway_schema_history`, e a API só volta a subir depois que
   esse registro é retirado. Essa decisão é da pessoa dona do projeto e nunca é automatizada (CLAUDE.md:
   nada de `flyway repair`/`clean` por agente). Como cada passo confere antes de criar, rodar a migração de novo depois
   da correção termina o que faltou.

## Exercícios 08 a 12 (26/11/2026)

O SQL simples de cada exercício, para rodar à mão no Railway antes do deploy, fica em `solucoes/sql/railway/`
(`09-categoria-marca.sql`, `10-area-artistica.sql`, `11-prazo-selo.sql`). Cada arquivo começa por uma conferência só
de leitura e usa os mesmos nomes da migração. Os exercícios 08 e 12 não mudam o schema, e as versões 113 e 117
ficaram sem uso (buracos na numeração não incomodam o Flyway).

Conferência antes do deploy (só leitura):

```sql
SELECT 'tabela' AS tipo, TABLE_NAME AS objeto FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('categorias_marca', 'areas_artisticas')
UNION ALL
SELECT 'coluna', CONCAT(TABLE_NAME, '.', COLUMN_NAME, ' ', COLLATION_NAME) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME IN ('categorias_marca', 'areas_artisticas') AND COLUMN_NAME = 'id')
    OR COLUMN_NAME IN ('categoria_marca_id', 'area_artistica_principal_id'))
UNION ALL
SELECT 'fk', CONCAT(CONSTRAINT_NAME, ' ', DELETE_RULE, ' / ', UPDATE_RULE) FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN ('categorias_marca', 'areas_artisticas')
UNION ALL
SELECT 'check', CONCAT(tc.CONSTRAINT_NAME, ' ', cc.CHECK_CLAUSE) FROM information_schema.TABLE_CONSTRAINTS tc
  JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'seals' AND tc.CONSTRAINT_TYPE = 'CHECK'
ORDER BY 1, 2;
SELECT codigo, COUNT(*) AS linhas FROM categorias_marca GROUP BY codigo ORDER BY codigo;
SELECT codigo, COUNT(*) AS linhas FROM areas_artisticas GROUP BY codigo ORDER BY codigo;
-- selos com o período invertido (precisa voltar vazio para o CHECK existir)
SELECT id, name, available_from, available_until FROM seals
 WHERE available_from IS NOT NULL AND available_until IS NOT NULL AND available_until < available_from;
```

Esperado: 2 tabelas; as duas colunas de FK com a mesma collation do `id` da tabela de opções; 2 FKs `RESTRICT / RESTRICT`;
o CHECK `ck_seals_availability_order`; 6 categorias e 6 áreas, 1 linha por código; nenhum selo invertido.

| O que a conferência mostra | O que acontece no deploy |
|---|---|
| Falta tabela, coluna, UNIQUE ou FK | A migração cria |
| Collation da coluna diferente da do `id` e a FK ainda não existe (a FK à mão daria 3780) | A migração alinha a coluna e cria a FK |
| CHECK do período criado à mão sem nome (`seals_chk_1`) | Reconhecido pelo conteúdo: a V116 não cria um segundo |
| Há selo com o fim antes do início | A V116 passa **sem criar o CHECK** (não derruba o deploy). Corrija as datas pela tela do selo e crie o CHECK à mão com o passo 2 de `11-prazo-selo.sql` |
| Mais de 1 linha para o mesmo código | A migração não duplica nada e não cria o UNIQUE; apague a linha repetida que não estiver em uso e crie o UNIQUE à mão |

Validação em laboratório (MySQL 8.0 local e descartável, Flyway 12.4.0 com as migrações reais; nada foi executado no
Railway, e o binário do MySQL 9.7 não foi testado localmente):

| Cenário | Resultado |
|---|---|
| Banco novo, V1 → V116 | V114, V115 e V116 `SUCCESS`; 6 categorias, 6 áreas, 2 FKs, 1 CHECK |
| Railway simulado: V112 + os três SQLs manuais, depois o deploy | os SQLs rodam sem erro; V114, V115 e V116 `SUCCESS` sem alterar nada; schema idêntico ao do banco novo (colunas, collations, constraints, regras das FKs, CHECK, índices e linhas) |
| Reexecutar os três scripts das migrações no mesmo banco | nenhum erro, nenhuma linha nova, schema igual |
| Coluna da FK criada à mão com outra collation e sem a FK (a FK à mão dá 3780) | a migração alinha as duas colunas e cria as duas FKs; schema idêntico ao do banco novo |
| Selo legado com o período invertido | V116 `SUCCESS` sem criar o CHECK |
| CHECK criado à mão sem nome | a V116 não cria um segundo |
| Integridade depois das migrações | categoria ou área inexistente → 1452; apagar opção em uso → 1451; desativar (`ativo = FALSE`) é aceito e o perfil continua lendo a opção; código repetido → 1062; período invertido → 3819; período igual, só início, só fim e sem período são aceitos |
