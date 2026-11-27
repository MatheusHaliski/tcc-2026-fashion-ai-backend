-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../18-peca-assinatura.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

-- Índice redundante ao PK global, mas necessário como chave referenciada na ordem owner+piece.
-- Conferir se já existe índice UNIQUE equivalente antes de adicionar.
ALTER TABLE wardrobe_items ADD CONSTRAINT uq_wardrobe_owner_piece UNIQUE(user_id,id);
CREATE TABLE user_signature_pieces (
  user_id CHAR(36) NOT NULL PRIMARY KEY,piece_id CHAR(36) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_usp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_usp_owned_piece FOREIGN KEY(user_id,piece_id)
    REFERENCES wardrobe_items(user_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE signature_piece_history (
  id CHAR(36) NOT NULL PRIMARY KEY,user_id CHAR(36) NOT NULL,piece_id CHAR(36) NULL,
  snapshot_json JSON NULL,changed_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_sph_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sph_piece FOREIGN KEY(piece_id) REFERENCES wardrobe_items(id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB;
SELECT u.user_id,u.piece_id,w.name FROM user_signature_pieces u
JOIN wardrobe_items w ON w.id=u.piece_id AND w.user_id=u.user_id WHERE u.user_id=@owner_id;
