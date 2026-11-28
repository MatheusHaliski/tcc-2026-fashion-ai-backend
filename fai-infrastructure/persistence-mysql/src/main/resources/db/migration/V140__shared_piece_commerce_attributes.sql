ALTER TABLE wardrobe_items
  ADD COLUMN negotiation_id CHAR(36),
  ADD COLUMN negotiation_started_at DATETIME(6),
  ADD COLUMN try_on_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN sales_count BIGINT;

ALTER TABLE catalog_products
  ADD COLUMN expires_at DATETIME(6),
  ADD COLUMN negotiation_id CHAR(36),
  ADD COLUMN negotiation_started_at DATETIME(6),
  ADD COLUMN try_on_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN sales_count BIGINT;

CREATE TABLE marketplace_sale_reports (
  id CHAR(36) PRIMARY KEY,
  store_id CHAR(36) NOT NULL,
  piece_id CHAR(36) NOT NULL,
  reported_at DATETIME(6) NOT NULL,
  reference_hash CHAR(64) NOT NULL,
  CONSTRAINT uq_marketplace_sale_reference UNIQUE (store_id, reference_hash),
  CONSTRAINT fk_marketplace_sale_store FOREIGN KEY (store_id) REFERENCES physical_stores(id),
  CONSTRAINT fk_marketplace_sale_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id)
);
