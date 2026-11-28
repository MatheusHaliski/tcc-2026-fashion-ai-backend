CREATE TABLE marketplace_maps (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  kind VARCHAR(24) NOT NULL,
  city VARCHAR(120) NOT NULL,
  region VARCHAR(120) NOT NULL,
  country CHAR(2) NOT NULL,
  image_url VARCHAR(1024),
  CONSTRAINT ck_marketplace_map_kind CHECK (kind IN ('SHOPPING', 'OUTLET', 'SHOPPING_STREET'))
);

CREATE TABLE physical_stores (
  id CHAR(36) PRIMARY KEY,
  brand_id CHAR(36) NOT NULL,
  map_id CHAR(36),
  name VARCHAR(160) NOT NULL,
  address VARCHAR(512) NOT NULL,
  city VARCHAR(120) NOT NULL,
  region VARCHAR(120) NOT NULL,
  country CHAR(2) NOT NULL,
  source_url VARCHAR(1024) NOT NULL,
  source_key CHAR(64) NOT NULL,
  verified_at DATETIME(6) NOT NULL,
  image_url VARCHAR(1024),
  floor_label VARCHAR(40),
  map_x DECIMAL(8,6),
  map_y DECIMAL(8,6),
  CONSTRAINT uq_physical_store_source UNIQUE (brand_id, source_key),
  CONSTRAINT fk_physical_store_brand FOREIGN KEY (brand_id) REFERENCES brands(id),
  CONSTRAINT fk_physical_store_map FOREIGN KEY (map_id) REFERENCES marketplace_maps(id),
  CONSTRAINT ck_physical_store_position CHECK (
    (map_x IS NULL AND map_y IS NULL) OR
    (map_id IS NOT NULL AND map_x IS NOT NULL AND map_y IS NOT NULL
     AND map_x BETWEEN 0 AND 1 AND map_y BETWEEN 0 AND 1)
  ),
  INDEX ix_physical_store_region (country, region, city)
);

ALTER TABLE wardrobe_items ADD COLUMN aura_metamorphose_status VARCHAR(20)
  GENERATED ALWAYS AS (
    CASE
      WHEN JSON_UNQUOTE(JSON_EXTRACT(background_config_json, '$.auraMetamorphosePreset'))
        IN ('NIKE_ORANGE', 'ADIDAS_BLUE', 'ASICS_WHITE') THEN 'SPECIAL'
      ELSE 'STANDARD'
    END
  ) STORED;

CREATE TABLE physical_store_pieces (
  store_id CHAR(36) NOT NULL,
  piece_id CHAR(36) NOT NULL,
  PRIMARY KEY (store_id, piece_id),
  CONSTRAINT fk_physical_store_piece_store FOREIGN KEY (store_id) REFERENCES physical_stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_physical_store_piece_wardrobe FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id) ON DELETE CASCADE
);
