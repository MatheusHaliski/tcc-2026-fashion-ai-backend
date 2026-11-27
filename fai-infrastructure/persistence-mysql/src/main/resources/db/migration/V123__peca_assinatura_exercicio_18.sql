-- Exercício 18 (Peça Assinatura do perfil e histórico): a pessoa escolhe UMA peça do próprio guarda-roupa para
-- representá-la e o histórico guarda cada mudança (docs/banco-de-dados/solucoes/18-peca-assinatura.md). Não é a
-- assinatura de marca nem o estilo de celebridade.
--   uq_wardrobe_owner_piece  UNIQUE (user_id, id) em wardrobe_items: é a chave que a FK composta referencia;
--   user_signature_pieces    a escolha atual (uma por pessoa), com FK COMPOSTA (user_id, piece_id) para a chave acima:
--                            o banco só aceita peça do mesmo dono;
--   signature_piece_history  uma linha por mudança; apagar a peça zera piece_id (SET NULL) e o retrato fica.
-- Idempotente como a V119–V121: no Railway os objetos são criados à mão
-- (docs/banco-de-dados/solucoes/sql/railway/18-peca-assinatura.sql); aqui cada passo confere o que já existe e só cria
-- o que falta, com os mesmos nomes. As colunas de FK seguem o charset e a collation da coluna referenciada.

-- chave referenciada pela FK composta: só cria se ainda não houver índice único exatamente em (user_id, id)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'wardrobe_items'
            AND s.NON_UNIQUE = 0 AND s.SEQ_IN_INDEX = 1 AND s.COLUMN_NAME = 'user_id'
            AND EXISTS (SELECT 1 FROM information_schema.STATISTICS o WHERE o.TABLE_SCHEMA = s.TABLE_SCHEMA AND o.TABLE_NAME = s.TABLE_NAME
                AND o.INDEX_NAME = s.INDEX_NAME AND o.SEQ_IN_INDEX = 2 AND o.COLUMN_NAME = 'id')
            AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS o WHERE o.TABLE_SCHEMA = s.TABLE_SCHEMA AND o.TABLE_NAME = s.TABLE_NAME
                AND o.INDEX_NAME = s.INDEX_NAME AND o.SEQ_IN_INDEX > 2)) = 0,
    'ALTER TABLE wardrobe_items ADD CONSTRAINT uq_wardrobe_owner_piece UNIQUE (user_id, id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- charset e collation das colunas referenciadas (FK de texto com collations diferentes: erro 3780)
SET @cs_usuario = (SELECT CONCAT(CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id');
SET @cs_peca = (SELECT CONCAT(CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'id');

-- escolha atual: uma linha por pessoa
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_signature_pieces') = 0,
    CONCAT('CREATE TABLE IF NOT EXISTS user_signature_pieces (user_id CHAR(36) CHARACTER SET ', @cs_usuario, ' NOT NULL, piece_id CHAR(36) CHARACTER SET ', @cs_peca,
        ' NOT NULL, version BIGINT NOT NULL DEFAULT 0, updated_at DATETIME(6) NOT NULL, PRIMARY KEY (user_id))'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- tabela criada à mão sem a coluna de revisão que a entidade UserSignaturePiece lê
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_signature_pieces' AND COLUMN_NAME = 'version') = 0,
    'ALTER TABLE user_signature_pieces ADD COLUMN version BIGINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_signature_pieces' AND INDEX_NAME = 'idx_usp_owner_piece') = 0,
    'ALTER TABLE user_signature_pieces ADD INDEX idx_usp_owner_piece (user_id, piece_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_signature_pieces' AND INDEX_NAME = 'idx_usp_piece') = 0,
    'ALTER TABLE user_signature_pieces ADD INDEX idx_usp_piece (piece_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'user_signature_pieces'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_usp_user') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_signature_pieces'
            AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME = 'users') = 0,
    'ALTER TABLE user_signature_pieces ADD CONSTRAINT fk_usp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'user_signature_pieces'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_usp_owned_piece') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_signature_pieces'
            AND COLUMN_NAME = 'piece_id' AND REFERENCED_TABLE_NAME = 'wardrobe_items') = 0,
    'ALTER TABLE user_signature_pieces ADD CONSTRAINT fk_usp_owned_piece FOREIGN KEY (user_id, piece_id) REFERENCES wardrobe_items (user_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- histórico: uma linha por mudança efetiva
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'signature_piece_history') = 0,
    CONCAT('CREATE TABLE IF NOT EXISTS signature_piece_history (id CHAR(36) NOT NULL, user_id CHAR(36) CHARACTER SET ', @cs_usuario, ' NOT NULL, piece_id CHAR(36) CHARACTER SET ', @cs_peca,
        ' NULL, snapshot_json JSON NULL, changed_at DATETIME(6) NOT NULL, PRIMARY KEY (id))'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'signature_piece_history' AND INDEX_NAME = 'idx_sph_user_changed') = 0,
    'ALTER TABLE signature_piece_history ADD INDEX idx_sph_user_changed (user_id, changed_at)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'signature_piece_history' AND INDEX_NAME = 'idx_sph_piece') = 0,
    'ALTER TABLE signature_piece_history ADD INDEX idx_sph_piece (piece_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'signature_piece_history'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_sph_user') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'signature_piece_history'
            AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME = 'users') = 0,
    'ALTER TABLE signature_piece_history ADD CONSTRAINT fk_sph_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'signature_piece_history'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_sph_piece') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'signature_piece_history'
            AND COLUMN_NAME = 'piece_id' AND REFERENCED_TABLE_NAME = 'wardrobe_items') = 0,
    'ALTER TABLE signature_piece_history ADD CONSTRAINT fk_sph_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items (id) ON DELETE SET NULL ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
