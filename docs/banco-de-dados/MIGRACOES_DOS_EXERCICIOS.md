# Migrações Flyway dos exercícios de banco de dados

Situação em **25/11/2026**. Produção: MySQL **9.7** no Railway (schema `fashionai`). No último deploy ativo da API
(#564) o Flyway registrou `Current version of schema fashionai: 110`. As versões 111 e 112 entram no próximo deploy.

## Regras

1. **Toda mudança de schema de exercício vira migração versionada** em
   `fai-infrastructure/persistence-mysql/src/main/resources/db/migration`. O SQL rodado à mão no Railway não substitui
   a migração, porque um banco novo (CI, outra máquina, restauração) só tem o que está versionado.
2. **A partir da V110 a migração é idempotente.** Ela confere no `information_schema` e cria só o que falta, com os
   mesmos nomes do SQL entregue no exercício (tabela, FK, UNIQUE, CHECK). Linhas já cadastradas não são alteradas
   (`ON DUPLICATE KEY UPDATE codigo = codigo` / `WHERE NOT EXISTS`). O `MigrationIdempotencyTest` barra no CI um
   `CREATE TABLE` sem `IF NOT EXISTS`, um `ALTER` sem guarda e um `INSERT` sem proteção contra duplicata.
3. **Migração já aplicada no Railway não é editada.** O checksum muda e o Flyway recusa subir a API. Uma correção vira
   uma versão nova.
4. **A versão menor entra antes.** O `out-of-order` está desligado, então uma V111 que chegue depois de uma V112
   aplicada faz a validação falhar. Por isso a V111 e a V112 estão no mesmo PR.

## Exercício → migração

| Nº | Exercício | Objetos | Migração | Situação |
|---|---|---|---|---|
| 01 | Tipo de look | `TipoLook`; `mirror_states.tipo_look_id` (`fk_mirror_tipo_look`); `schemes.tipo_look_id` (`fk_scheme_tipo_look`); `user_preferences.default_tipo_look_id` (`fk_preferences_default_tipo_look`, SET NULL) | V60, V107 | aplicadas. A V107 não tem guardas, mas já rodou e não deve ser editada |
| 02 | Estado de conservação | `EstadoConservacao`; `wardrobe_items.estado_de_conservacao` (`fk_wardrobe_items_estado_conservacao`, SET NULL / CASCADE) | V77 | aplicada |
| 03 | Instrução de lavagem | `TipoLavagem`; `wardrobe_items.tipo_lavagem_id` (`fk_wardrobe_items_tipo_lavagem`, SET NULL / CASCADE) | V77 | aplicada |
| 04 | Nível térmico do look | `niveis_termicos`; `schemes.nivel_termico_id` (`fk_schemes_nivel_termico`, RESTRICT / RESTRICT) | V110 | aplicada |
| 05 | Origem da peça | `origem` (+ `nome`, `ativo`); `wardrobe_items.origem_id` (`fk_wardrobe_items_origem`, SET NULL / CASCADE) | V105, V106 | aplicadas. `origem.codigo` é `ENUM('ADQUIRIDA','HERDADA','TROCADA')` no banco, e a entidade mapeia texto de até 30: uma origem nova exige migração que amplie o ENUM |
| 06 | Estação do look | `estacoes` (chave `codigo` = texto do enum `Season`); `fk_schemes_estacao`, `fk_moments_estacao`, `fk_dna_schemes_estacao` (RESTRICT / RESTRICT) | **V111** | criada à mão no Railway; a V111 confere tudo e não recria nada |
| 07 | Iluminação e temperatura (no acervo, porque o quarto saiu do app) | `tipos_iluminacao` (`uq_tipos_iluminacao_codigo`); `acervo_ambientes.tipo_iluminacao_id` e `temperatura_kelvin`; `fk_acervo_ambientes_tipo_iluminacao` (RESTRICT / RESTRICT); `ck_acervo_ambientes_kelvin` (2700–6500 K ou NULL) | **V112** | criada à mão no Railway; a V112 confere tudo e não recria nada |

Na V111, `estacoes.codigo` copia o charset e a collation de `schemes.season`. FK entre colunas de texto exige os dois
lados iguais; se não forem, o MySQL dá o erro 3780.

## Conferência antes do deploy (só leitura, no console do Railway)

```sql
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;

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

SELECT codigo, nome, HEX(nome) AS bytes_do_nome, ativo FROM estacoes ORDER BY ordem;
```

Resultado esperado antes do deploy:
- o histórico do Flyway termina em `110`;
- 2 tabelas, 2 colunas, 4 FKs e o CHECK `ck_acervo_ambientes_kelvin`.

Com isso a V111 e a V112 não mudam nada. Se algum objeto faltar, a migração o cria no deploy. Uma FK, porém, só entra
se todos os valores já gravados existirem em `estacoes` ou `tipos_iluminacao`.

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
repositório. Nada disso foi executado no Railway.

| Cenário | Resultado |
|---|---|
| Banco novo, V1 → V112 | 111 migrações aplicadas; V111 e V112 `SUCCESS` |
| Railway simulado: V110 + o SQL manual dos exercícios 06 e 07, depois o deploy | V111 e V112 `SUCCESS` sem alterar nada; `validate` ok; schema idêntico ao do banco novo (FKs, UNIQUE, CHECK, índices, collation) |
| Estado parcial (faltando FKs de `moments`/`dna_schemes` e o CHECK) | a migração cria só o que falta; o schema final é idêntico ao do banco novo |
| Valor legado `VERAO` em `schemes.season` | a V111 para com o erro 1452: não inventa estação nem pula a FK em silêncio |
| Integridade depois da V111/V112 | `'Inverno'` → 1452; apagar ou renomear estação em uso → 1451; 2000 K e 6501 K → 3819; 2700 K e 6500 K aceitos; tipo de iluminação inexistente → 1452; apagar tipo em uso → 1451; desativar (`ativo = FALSE`) é aceito |
| Reexecutar os dois scripts no mesmo banco | nenhum erro, nenhuma linha nova, schema igual; tipo desativado continua desativado |
| A própria API (o Flyway dela e o Hibernate) num banco novo, com o código do exercício 07 | 111 migrações aplicadas e a API sobe. O script de atualização do Hibernate não pede nenhuma tabela nem coluna: tudo o que as entidades dos exercícios 01 a 07 usam está versionado. As diferenças restantes ficam fora dos exercícios: tipos (tinyint × integer, precisão de decimal) e nomes de UNIQUE gerados pelo Hibernate |

O teste com o binário do MySQL 9.7 não foi feito localmente. O padrão usado é o mesmo da V110 (`IF NOT EXISTS`, guardas
no `information_schema`, `PREPARE`), que já rodou no Railway em 9.7. As FKs apontam para chaves primárias, o que
atende à regra do 8.4+ (`restrict_fk_on_non_standard_key`).

## Se uma migração falhar no deploy

1. O log do deploy no Railway mostra a versão, o comando e o código do erro (o Flyway imprime `SQL State` e
   `Error Code`).
2. **1452** em `fk_*_estacao` significa valor legado fora dos quatro códigos. Rode o diagnóstico acima e corrija esses
   registros. Trocar por `NULL` (sem estação) é decisão de quem responde pelos dados.
3. No MySQL a versão que falhou fica com `success = 0` no `flyway_schema_history`, e a API só volta a subir depois que
   esse registro é retirado. Essa decisão é da pessoa dona do projeto e nunca é automatizada (CLAUDE.md:
   nada de `flyway repair`/`clean` por agente).
