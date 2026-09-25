-- Contas criadas pelas suítes E2E (username com prefixo "e2e_") ficam marcadas e fora da vitrine pública:
-- feed, busca, passarela e peças públicas só mostram esse conteúdo para outras contas de teste.
ALTER TABLE users ADD COLUMN test_account BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET test_account = TRUE WHERE username LIKE 'e2e\_%';
CREATE INDEX ix_users_test_account ON users (test_account);
