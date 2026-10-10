-- Demo/Test Data Pipeline (docs/banco/integridade/AUDITORIA_FKS_E_PIPELINE_DEMO.md §6.2).
-- account_origin diz de onde a conta veio; só TEST_SEED e DEMO entram no reset do ambiente demo. fixture_key é a chave
-- imutável da fixture (ex.: USER_PUBLIC): o seed acha a conta por ela, nunca pelo nome ou e-mail.
ALTER TABLE users
  ADD COLUMN account_origin VARCHAR(20) NOT NULL DEFAULT 'REAL',
  ADD COLUMN fixture_key VARCHAR(80) NULL,
  ADD CONSTRAINT ck_users_account_origin CHECK (account_origin IN ('REAL', 'TEST_SEED', 'DEMO', 'SYSTEM')),
  ADD CONSTRAINT ux_users_fixture_key UNIQUE (fixture_key);

-- as contas e2e_* de hoje (V22) passam a ser TEST_SEED
UPDATE users SET account_origin = 'TEST_SEED' WHERE test_account = TRUE;

-- test_account deixa de ser gravado pela aplicação: vira coluna GERADA da origem (sem redundância). As consultas e o
-- índice que já usam test_account continuam iguais.
ALTER TABLE users DROP INDEX ix_users_test_account;
ALTER TABLE users DROP COLUMN test_account;
ALTER TABLE users ADD COLUMN test_account BOOLEAN GENERATED ALWAYS AS (account_origin IN ('TEST_SEED', 'DEMO')) STORED;
CREATE INDEX ix_users_test_account ON users (test_account);
CREATE INDEX ix_users_account_origin ON users (account_origin);

-- Catálogo global: o reset de usuários demo NUNCA apaga marca. Marca só de QA leva catalog_origin = DEMO e só sai pelo
-- reset de catálogo demo, e ainda assim só sem referências (RESTRICT).
ALTER TABLE brands
  ADD COLUMN catalog_origin VARCHAR(20) NOT NULL DEFAULT 'REAL',
  ADD COLUMN fixture_key VARCHAR(80) NULL,
  ADD CONSTRAINT ck_brands_catalog_origin CHECK (catalog_origin IN ('REAL', 'SEED', 'DEMO')),
  ADD CONSTRAINT ux_brands_fixture_key UNIQUE (fixture_key);
