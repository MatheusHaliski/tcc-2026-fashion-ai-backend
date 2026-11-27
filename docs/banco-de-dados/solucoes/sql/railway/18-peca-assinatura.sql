-- Exercício 18 — Peça Assinatura do perfil e histórico. SQL simples para rodar À MÃO no console do Railway (MySQL 9.7),
-- no banco da API. Os nomes são os mesmos da migração V123__peca_assinatura_exercicio_18.sql, que depois não muda nada.
-- Rode uma vez, de cima para baixo. Comando já executado dá aviso (1050 tabela existe, 1061 índice existe): pule e siga.

-- 1) Diagnóstico (só leitura).
--    a) Já existe índice único em wardrobe_items (user_id, id)? Se a consulta devolver uma linha, pule o passo 2.
SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS colunas FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND NON_UNIQUE = 0
 GROUP BY INDEX_NAME HAVING colunas = 'user_id,id';
--    b) As colunas de FK precisam da mesma collation das colunas referenciadas (erro 3780 se não for). As tabelas novas
--       nascem com a collation padrão do banco; ela precisa ser a mesma das três colunas abaixo.
SELECT @@collation_database AS padrao_do_banco;
SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME IN ('id', 'user_id')) OR (TABLE_NAME = 'users' AND COLUMN_NAME = 'id'));
--    c) As tabelas ainda não existem? (deve voltar vazio)
SELECT TABLE_NAME FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('user_signature_pieces', 'signature_piece_history');

-- 2) Chave que a FK composta referencia. O id já é único sozinho; este índice existe para a FK poder apontar para o
--    par (dono, peça). Em tabela grande a criação do índice pode levar alguns segundos.
ALTER TABLE wardrobe_items ADD CONSTRAINT uq_wardrobe_owner_piece UNIQUE (user_id, id);

-- 3) Escolha atual: uma linha por pessoa. A FK composta só aceita peça do mesmo dono. Apagar a conta apaga a escolha
--    (CASCADE); a peça que é a assinatura atual não pode ser apagada do banco (RESTRICT) — o app arquiva a peça e
--    remove a escolha antes.
CREATE TABLE user_signature_pieces (
    user_id CHAR(36) NOT NULL,
    piece_id CHAR(36) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id),
    INDEX idx_usp_owner_piece (user_id, piece_id),
    INDEX idx_usp_piece (piece_id),
    CONSTRAINT fk_usp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_usp_owned_piece FOREIGN KEY (user_id, piece_id)
        REFERENCES wardrobe_items (user_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- 4) Histórico: uma linha por mudança. Apagar a peça zera piece_id (SET NULL) e o retrato (snapshot_json) continua.
CREATE TABLE signature_piece_history (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    piece_id CHAR(36) NULL,
    snapshot_json JSON NULL,
    changed_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_sph_user_changed (user_id, changed_at),
    INDEX idx_sph_piece (piece_id),
    CONSTRAINT fk_sph_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_sph_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items (id) ON DELETE SET NULL ON UPDATE RESTRICT
);

-- 5) Conferência final (só leitura): o índice único, 4 FKs com as regras abaixo e as duas tabelas vazias.
--    fk_usp_user CASCADE/RESTRICT · fk_usp_owned_piece RESTRICT/RESTRICT · fk_sph_user CASCADE/RESTRICT · fk_sph_piece SET NULL/RESTRICT
SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS colunas FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND INDEX_NAME = 'uq_wardrobe_owner_piece' GROUP BY INDEX_NAME;
SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME IN ('user_signature_pieces', 'signature_piece_history') ORDER BY 1;
SELECT (SELECT COUNT(*) FROM user_signature_pieces) AS escolhas, (SELECT COUNT(*) FROM signature_piece_history) AS historico;
