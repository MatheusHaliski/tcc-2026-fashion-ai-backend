-- Remix de várias peças (RF19.CA13 estendido): de quais peças/looks um look remixado veio. Uma linha por fonte, na
-- ordem da seleção. Não copia nada da fonte (nem @, nem título, nem imagem): o crédito "Remix de @a, @b" é calculado na
-- leitura com a mesma regra de visibilidade que decide se quem vê consegue abrir a fonte. A peça própria usada no lugar
-- de uma peça alheia (correspondência por semelhança) fica em mapped_piece_id. notified_at evita notificar duas vezes.

CREATE TABLE scheme_remix_sources (
  id CHAR(36) PRIMARY KEY,
  scheme_id CHAR(36) NOT NULL,
  position SMALLINT NOT NULL,
  source_type VARCHAR(10) NOT NULL,
  source_piece_id CHAR(36) NULL,
  source_scheme_id CHAR(36) NULL,
  source_owner_id CHAR(36) NULL,
  mapped_piece_id CHAR(36) NULL,
  channel VARCHAR(12) NULL,
  notified_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_scheme_remix_sources_position UNIQUE (scheme_id, position),
  CONSTRAINT ck_scheme_remix_sources_type CHECK (source_type IN ('PIECE', 'SCHEME')),
  CONSTRAINT ck_scheme_remix_sources_channel
    CHECK (channel IS NULL OR channel IN ('PIECE', 'TOP_BAR', 'TRAY', 'LOOK', 'LENS', 'PHOTO')),
  CONSTRAINT fk_srs_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE,
  CONSTRAINT fk_srs_source_piece FOREIGN KEY (source_piece_id) REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_srs_source_scheme FOREIGN KEY (source_scheme_id) REFERENCES schemes(id) ON DELETE SET NULL,
  CONSTRAINT fk_srs_source_owner FOREIGN KEY (source_owner_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_srs_mapped_piece FOREIGN KEY (mapped_piece_id) REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  INDEX idx_srs_source_piece (source_piece_id),
  INDEX idx_srs_source_scheme (source_scheme_id),
  INDEX idx_srs_source_owner (source_owner_id, created_at)
);
