-- FLAIR 3D multiplayer (frente A1 da auditoria de 27/11/2026): convite por busca na rede FAI e sala de partida entre
-- duas pessoas. Uma linha por convite/sala: jogo e rodada, modo (ASSINCRONO = mesma semente; TURNOS = lance a lance
-- julgado no servidor; COOP = próximo passo), semente comum, quem convidou e quem foi convidado, estado
-- (CONVIDADO, JOGANDO, FECHADO, RECUSADO, CANCELADO, EXPIRADO), prazo de aceite, as partidas de cada lado, os decks e
-- turnos do modo TURNOS, o resultado dos dois lados e a revanche. version = trava otimista (dois lances ao mesmo tempo).
-- Idempotente (MigrationIdempotencyTest): no Railway a tabela pode ter sido criada à mão
-- (docs/banco-de-dados/solucoes/sql/railway/133-multiplayer-flair3d.sql); cada passo confere antes de criar. As colunas
-- de FK seguem o charset e a collation de users.id (erro 3780 com collations diferentes). "de <> para" fica no serviço:
-- coluna com FK em cascata não pode entrar em CHECK no MySQL (erro 3823).

SET @cs_usuario = (SELECT CONCAT(CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id');

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas') = 0,
    CONCAT('CREATE TABLE IF NOT EXISTS flair3d_salas (id CHAR(36) NOT NULL PRIMARY KEY, jogo VARCHAR(32) NOT NULL, rodada VARCHAR(48) NULL, ',
        'modo VARCHAR(16) NOT NULL, semente BIGINT NOT NULL, de_user_id CHAR(36) CHARACTER SET ', @cs_usuario, ' NOT NULL, ',
        'para_user_id CHAR(36) CHARACTER SET ', @cs_usuario, ' NOT NULL, estado VARCHAR(16) NOT NULL, prazo DATETIME(6) NOT NULL, ',
        'partida_de CHAR(36) NULL, partida_para CHAR(36) NULL, deck_de_json JSON NULL, deck_para_json JSON NULL, turnos_json JSON NULL, ',
        'resultado_json JSON NULL, vencedor_user_id CHAR(36) NULL, revanche_de CHAR(36) NULL, version BIGINT NOT NULL DEFAULT 0, ',
        'created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, ',
        'CONSTRAINT ck_flair3d_sala_estado CHECK (estado IN (''CONVIDADO'',''JOGANDO'',''FECHADO'',''RECUSADO'',''CANCELADO'',''EXPIRADO'')), ',
        'CONSTRAINT ck_flair3d_sala_modo CHECK (modo IN (''ASSINCRONO'',''TURNOS'',''COOP'')))'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tabela criada à mão sem a trava otimista que a entidade Flair3dSala lê
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas' AND COLUMN_NAME = 'version') = 0,
    'ALTER TABLE flair3d_salas ADD COLUMN version BIGINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- caixa de convites (recebidos/enviados por estado) e histórico entre duas pessoas
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas'
            AND INDEX_NAME = 'ix_flair3d_sala_para_estado') = 0,
    'ALTER TABLE flair3d_salas ADD INDEX ix_flair3d_sala_para_estado (para_user_id, estado, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas'
            AND INDEX_NAME = 'ix_flair3d_sala_de_estado') = 0,
    'ALTER TABLE flair3d_salas ADD INDEX ix_flair3d_sala_de_estado (de_user_id, estado, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas'
            AND INDEX_NAME = 'ix_flair3d_sala_par') = 0,
    'ALTER TABLE flair3d_salas ADD INDEX ix_flair3d_sala_par (de_user_id, para_user_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- as duas pessoas são contas: apagar a conta apaga as salas dela (LGPD, como as demais tabelas por pessoa)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_flair3d_sala_de') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas'
            AND COLUMN_NAME = 'de_user_id' AND REFERENCED_TABLE_NAME = 'users') = 0,
    'ALTER TABLE flair3d_salas ADD CONSTRAINT fk_flair3d_sala_de FOREIGN KEY (de_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_flair3d_sala_para') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair3d_salas'
            AND COLUMN_NAME = 'para_user_id' AND REFERENCED_TABLE_NAME = 'users') = 0,
    'ALTER TABLE flair3d_salas ADD CONSTRAINT fk_flair3d_sala_para FOREIGN KEY (para_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
