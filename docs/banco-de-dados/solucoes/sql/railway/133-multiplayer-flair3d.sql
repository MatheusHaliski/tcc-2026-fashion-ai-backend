-- FLAIR 3D multiplayer (convite por busca na rede FAI e sala de partida). SQL simples para rodar À MÃO no console do
-- Railway (MySQL), no banco da API. Os nomes são os mesmos da migração V133__multiplayer_flair3d.sql, que depois só
-- confere e não muda nada. Rode uma vez, de cima para baixo. Comando já executado dá aviso (1050 tabela existe,
-- 1061 índice repetido, 1826 FK repetida): pule e siga. Não apaga nem altera dados existentes.

-- 1) Diagnóstico (só leitura): collation de users.id (as colunas de FK abaixo usam a mesma) e se a tabela já existe.
SELECT CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id';
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas';

-- 2) Tabela. Se a consulta 1 mostrar outra collation que utf8mb4_0900_ai_ci, troque nas duas colunas de pessoa.
CREATE TABLE flair3d_salas (
  id CHAR(36) NOT NULL PRIMARY KEY,
  jogo VARCHAR(32) NOT NULL,
  rodada VARCHAR(48) NULL,
  modo VARCHAR(16) NOT NULL,
  semente BIGINT NOT NULL,
  de_user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  para_user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  estado VARCHAR(16) NOT NULL,
  prazo DATETIME(6) NOT NULL,
  partida_de CHAR(36) NULL,
  partida_para CHAR(36) NULL,
  deck_de_json JSON NULL,
  deck_para_json JSON NULL,
  turnos_json JSON NULL,
  resultado_json JSON NULL,
  vencedor_user_id CHAR(36) NULL,
  revanche_de CHAR(36) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT ck_flair3d_sala_estado CHECK (estado IN ('CONVIDADO','JOGANDO','FECHADO','RECUSADO','CANCELADO','EXPIRADO')),
  CONSTRAINT ck_flair3d_sala_modo CHECK (modo IN ('ASSINCRONO','TURNOS','COOP'))
);

-- 3) Índices da caixa de convites e do histórico entre duas pessoas.
ALTER TABLE flair3d_salas ADD INDEX ix_flair3d_sala_para_estado (para_user_id, estado, created_at);
ALTER TABLE flair3d_salas ADD INDEX ix_flair3d_sala_de_estado (de_user_id, estado, created_at);
ALTER TABLE flair3d_salas ADD INDEX ix_flair3d_sala_par (de_user_id, para_user_id, created_at);

-- 4) FKs para users (apagar a conta apaga as salas dela).
ALTER TABLE flair3d_salas ADD CONSTRAINT fk_flair3d_sala_de FOREIGN KEY (de_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE flair3d_salas ADD CONSTRAINT fk_flair3d_sala_para FOREIGN KEY (para_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE;
