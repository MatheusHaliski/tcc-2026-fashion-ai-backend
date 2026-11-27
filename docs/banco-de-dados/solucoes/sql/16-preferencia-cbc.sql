-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../16-preferencia-cbc.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

CREATE TABLE `cbc_scenarios` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ipanema','Ipanema',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'gala','Gala',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'livre','Livre',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

CREATE TABLE cbc_challenge_scenarios (
  challenge_id CHAR(36) NOT NULL,scenario_id CHAR(36) NOT NULL,
  PRIMARY KEY(challenge_id,scenario_id),
  CONSTRAINT fk_ccs_challenge FOREIGN KEY(challenge_id) REFERENCES flair_challenges(id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_ccs_scenario FOREIGN KEY(scenario_id) REFERENCES cbc_scenarios(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE cbc_preferences (
  user_id CHAR(36) NOT NULL,challenge_id CHAR(36) NOT NULL,scenario_id CHAR(36) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(user_id,challenge_id),
  CONSTRAINT fk_cbcp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_cbcp_allowed FOREIGN KEY(challenge_id,scenario_id)
    REFERENCES cbc_challenge_scenarios(challenge_id,scenario_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
-- Associar opções a desafios somente depois de conferir compatibilidade com o renderer/regras.
SELECT c.id,c.scenario,c.status FROM flair_challenges c WHERE c.id=@challenge_id;
