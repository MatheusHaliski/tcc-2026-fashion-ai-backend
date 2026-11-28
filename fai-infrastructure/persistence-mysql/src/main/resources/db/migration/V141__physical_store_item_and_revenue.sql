ALTER TABLE wardrobe_items
  ADD COLUMN physical_store_item_id CHAR(36),
  ADD INDEX ix_wardrobe_physical_store (physical_store_item_id),
  ADD CONSTRAINT fk_wardrobe_physical_store FOREIGN KEY (physical_store_item_id) REFERENCES physical_stores(id) ON DELETE SET NULL;

UPDATE wardrobe_items w
JOIN (SELECT piece_id, MIN(store_id) AS store_id FROM physical_store_pieces GROUP BY piece_id) placed
  ON placed.piece_id=w.id
SET w.physical_store_item_id=placed.store_id;

DROP TABLE physical_store_pieces;

ALTER TABLE marketplace_sale_reports
  ADD COLUMN points_received BIGINT,
  ADD INDEX ix_marketplace_sales_period (store_id, reported_at),
  ADD CONSTRAINT ck_marketplace_sale_points CHECK (points_received IS NULL OR points_received >= 0);
