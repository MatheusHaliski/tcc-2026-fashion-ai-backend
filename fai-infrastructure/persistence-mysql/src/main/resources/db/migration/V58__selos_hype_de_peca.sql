-- Selos de Hype também podem ser solicitados para peças que ainda não compõem um look.
-- Os vínculos existentes permanecem ligados a scheme_id; o alvo é exclusivo.
ALTER TABLE seal_bonds
  MODIFY COLUMN scheme_id CHAR(36) NULL,
  ADD COLUMN piece_id CHAR(36) NULL,
  ADD CONSTRAINT fk_seal_bonds_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id),
  ADD CONSTRAINT ck_seal_bonds_target CHECK (
    (scheme_id IS NOT NULL AND piece_id IS NULL) OR
    (scheme_id IS NULL AND piece_id IS NOT NULL AND tier = 'PECA')
  );
CREATE INDEX idx_seal_bonds_piece_status ON seal_bonds(piece_id, status);
