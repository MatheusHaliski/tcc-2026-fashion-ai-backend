-- SOMENTE LEITURA. Aplicar na conexão explícita ao banco de TESTE desejado.
-- As respostas documentais não executaram nem consultaram o banco real.
SELECT DATABASE() AS banco_atual,VERSION() AS versao_mysql,@@lower_case_table_names AS case_tabelas;
SELECT version,description,success FROM flyway_schema_history ORDER BY installed_rank;

-- Todas as FKs: uma linha por coluna; preservar a ordem para relações compostas.
SELECT k.TABLE_NAME AS tabela_filha,k.CONSTRAINT_NAME,k.ORDINAL_POSITION,
       k.COLUMN_NAME,k.REFERENCED_TABLE_NAME AS tabela_pai,k.REFERENCED_COLUMN_NAME,
       r.UPDATE_RULE,r.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE k
JOIN information_schema.REFERENTIAL_CONSTRAINTS r
  ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
 AND r.TABLE_NAME=k.TABLE_NAME
WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION;

-- Dependências de uma tabela nos dois sentidos: preencher com o nome EXATO.
SET @tabela='wardrobe_items';
SELECT k.TABLE_NAME,k.COLUMN_NAME,k.CONSTRAINT_NAME,k.REFERENCED_TABLE_NAME,
       k.REFERENCED_COLUMN_NAME,r.UPDATE_RULE,r.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE k
JOIN information_schema.REFERENTIAL_CONSTRAINTS r
  ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
 AND r.TABLE_NAME=k.TABLE_NAME
WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
  AND (k.TABLE_NAME=@tabela OR k.REFERENCED_TABLE_NAME=@tabela)
ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION;

-- Tipos, charset e collation devem ser compatíveis ANTES de criar uma FK.
SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,CHARACTER_SET_NAME,COLLATION_NAME
FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME IN ('wardrobe_items','TipoLook','EstadoConservacao','TipoLavagem',
                    'schemes','room_layouts','brand_profiles','celebrity_profiles',
                    'seals','promotions','promotion_redemptions','flair_combinations',
                    'flair_redemptions','flair_challenges','community_trends',
                    'catalog_products','catalog_variants','users')
ORDER BY TABLE_NAME,ORDINAL_POSITION;

SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME
FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX;

SELECT t.TABLE_NAME,t.CONSTRAINT_NAME,c.CHECK_CLAUSE
FROM information_schema.TABLE_CONSTRAINTS t
JOIN information_schema.CHECK_CONSTRAINTS c
  ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME
WHERE t.CONSTRAINT_SCHEMA=DATABASE() AND t.CONSTRAINT_TYPE='CHECK'
ORDER BY t.TABLE_NAME,t.CONSTRAINT_NAME;

-- Órfãos nos campos existentes de conservação/lavagem; não supor que CREATE TABLE IF NOT EXISTS validou a estrutura.
SELECT w.id,w.estado_de_conservacao FROM wardrobe_items w
LEFT JOIN `EstadoConservacao` e ON e.id=w.estado_de_conservacao
WHERE w.estado_de_conservacao IS NOT NULL AND e.id IS NULL;
SELECT w.id,w.tipo_lavagem_id FROM wardrobe_items w
LEFT JOIN `TipoLavagem` t ON t.id=w.tipo_lavagem_id
WHERE w.tipo_lavagem_id IS NOT NULL AND t.id IS NULL;

-- Estes SHOWs devem ser emitidos somente se o inventário confirmar a existência.
SHOW CREATE TABLE wardrobe_items;
SHOW CREATE TABLE `EstadoConservacao`;
SHOW CREATE TABLE `TipoLavagem`;
SHOW CREATE TABLE catalog_variants;
