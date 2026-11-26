# Migrações Flyway dos exercícios de banco de dados

Situação em **25/11/2026**. Produção: MySQL **9.7** no Railway (schema `fashionai`). No último deploy ativo da API
(#564) o Flyway registrou `Current version of schema fashionai: 110`. As versões 111 e 112 entram no próximo deploy.

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
| 07 | Iluminação e temperatura (no acervo, porque o quarto saiu do app) | `tipos_iluminacao` (`uq_tipos_iluminacao_codigo`); `acervo_ambientes.tipo_iluminacao_id` e `temperatura_kelvin`; `fk_acervo_ambientes_tipo_iluminacao` (RESTRICT / RESTRICT); `ck_acervo_ambientes_kelvin` (2700–6500 K ou NULL) | **V112** | criada à mão no Railway; a V112 só cria o que faltar |

FK entre colunas de texto exige o mesmo charset e a mesma collation dos dois lados; se não forem iguais, o MySQL dá o
erro 3780. Por isso as migrações alinham as colunas:
- na V111, `estacoes.codigo` segue `schemes.season`;
- na V112, `acervo_ambientes.tipo_iluminacao_id` segue `tipos_iluminacao.id`.

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
