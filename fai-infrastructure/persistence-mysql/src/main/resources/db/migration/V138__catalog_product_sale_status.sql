ALTER TABLE catalog_products
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  ADD CONSTRAINT ck_catalog_product_sale_status CHECK (status IN ('AVAILABLE', 'EXPIRED'));

UPDATE catalog_products SET status = 'EXPIRED'
 WHERE source_status IN ('UNAVAILABLE', 'SOURCE_REMOVED') OR ingestion_status = 'REJECTED';
