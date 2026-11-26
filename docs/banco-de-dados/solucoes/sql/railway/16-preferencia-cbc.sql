-- Exercício 16 — CBC: cenário preferido. SQL simples para rodar À MÃO no console do Railway (MySQL 9.7), no banco da
-- API. Os nomes são os mesmos da migração V121__cbc_cenario_preferido_exercicio_16.sql, que depois não muda nada.
-- Rode uma vez, de cima para baixo. Comando já executado dá aviso (1050 tabela existe, 1062 código repetido): pule e siga.

-- 1) Diagnóstico (só leitura).
--    a) Cenários usados hoje pelos desafios: todos precisam estar na lista do passo 2 (os 16 abaixo). Um código fora
--       dela só fica sem cenário preferido; nada quebra.
SELECT scenario, COUNT(*) AS desafios FROM flair_challenges GROUP BY scenario ORDER BY scenario;
--    b) As colunas de FK precisam da mesma collation das colunas referenciadas (erro 3780 se não for). As tabelas novas
--       nascem com a collation padrão do banco; ela precisa ser a mesma de flair_challenges.id e users.id.
SELECT @@collation_database AS padrao_do_banco;
SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'flair_challenges' AND COLUMN_NAME IN ('id', 'scenario')) OR (TABLE_NAME = 'users' AND COLUMN_NAME = 'id'));

-- 2) Opções de cenário (o código é o mesmo texto de flair_challenges.scenario).
CREATE TABLE cbc_scenarios (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_cbc_scenarios_codigo UNIQUE (codigo)
);

INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'armario', 'Armário', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'brecho', 'Brechó', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'carnaval', 'Carnaval', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'casamento', 'Casamento', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'desfile', 'Desfile', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'estagio', 'Estágio', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'festival', 'Festival', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'gala', 'Gala', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'halloween', 'Halloween', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'ipanema', 'Ipanema', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'livre', 'Livre', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'paris', 'Paris', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'popup', 'Pop-up', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'primavera', 'Primavera', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'semana', 'Semana de moda', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at) VALUES (UUID(), 'serra', 'Serra', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));

-- 3) Cenários permitidos em cada desafio. Apagar o desafio apaga as linhas dele (CASCADE); o cenário em uso não é apagado.
CREATE TABLE cbc_challenge_scenarios (
    challenge_id CHAR(36) NOT NULL,
    scenario_id CHAR(36) NOT NULL,
    PRIMARY KEY (challenge_id, scenario_id),
    CONSTRAINT fk_ccs_challenge FOREIGN KEY (challenge_id) REFERENCES flair_challenges (id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_ccs_scenario FOREIGN KEY (scenario_id) REFERENCES cbc_scenarios (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

--    Cada desafio existente permite o seu cenário oficial e o "livre" (cena neutra).
INSERT INTO cbc_challenge_scenarios (challenge_id, scenario_id)
SELECT c.id, s.id FROM flair_challenges c JOIN cbc_scenarios s ON CAST(s.codigo AS BINARY) = CAST(c.scenario AS BINARY);
INSERT INTO cbc_challenge_scenarios (challenge_id, scenario_id)
SELECT c.id, s.id FROM flair_challenges c JOIN cbc_scenarios s ON s.codigo = 'livre'
WHERE CAST(c.scenario AS BINARY) <> CAST('livre' AS BINARY);

-- 4) Preferência da pessoa no desafio. A FK composta só aceita cenário permitido naquele desafio.
CREATE TABLE cbc_preferences (
    user_id CHAR(36) NOT NULL,
    challenge_id CHAR(36) NOT NULL,
    scenario_id CHAR(36) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, challenge_id),
    CONSTRAINT fk_cbcp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_cbcp_allowed FOREIGN KEY (challenge_id, scenario_id)
        REFERENCES cbc_challenge_scenarios (challenge_id, scenario_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- 5) Conferência final (só leitura): 16 cenários; cada desafio com 2 cenários permitidos (1 se o oficial já é "livre");
--    4 FKs.
SELECT COUNT(*) AS cenarios FROM cbc_scenarios;
SELECT c.slug, c.scenario AS oficial, GROUP_CONCAT(s.codigo ORDER BY s.codigo) AS permitidos
  FROM flair_challenges c LEFT JOIN cbc_challenge_scenarios x ON x.challenge_id = c.id LEFT JOIN cbc_scenarios s ON s.id = x.scenario_id
 GROUP BY c.id, c.slug, c.scenario ORDER BY c.slug;
SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME IN ('cbc_challenge_scenarios', 'cbc_preferences') ORDER BY 1;
