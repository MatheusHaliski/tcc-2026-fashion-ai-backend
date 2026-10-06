-- Catálogo global: variação, atributos, preço (JSON-LD das páginas oficiais) e faixa etária; estilo típico e faixa de
-- preço da marca (docs/taxonomia, seções E, F e H). Aditiva: colunas novas anuláveis e tabelas novas.

ALTER TABLE catalog_products
  ADD COLUMN variation_code VARCHAR(60) NULL AFTER subcategory,
  ADD COLUMN variation_status VARCHAR(16) NULL AFTER variation_code,
  ADD COLUMN variation_confidence DECIMAL(4,3) NULL AFTER variation_status,
  ADD COLUMN age_group VARCHAR(10) NULL AFTER gender,
  ADD COLUMN price_min DECIMAL(12,2) NULL,
  ADD COLUMN price_max DECIMAL(12,2) NULL,
  ADD COLUMN list_price DECIMAL(12,2) NULL,                 -- preço "de" (StrikethroughPrice)
  ADD COLUMN price_currency CHAR(3) NULL,
  ADD COLUMN price_source VARCHAR(20) NULL,                 -- JSONLD_OFFER | JSONLD_AGGREGATE | META | MANUAL
  ADD COLUMN price_checked_at DATETIME(6) NULL;

ALTER TABLE catalog_products
  ADD CONSTRAINT ck_catalog_products_variation_status
    CHECK (variation_status IS NULL OR variation_status IN ('USER_CONFIRMED', 'AI_SUGGESTED', 'NEEDS_REVIEW', 'UNKNOWN')),
  ADD CONSTRAINT ck_catalog_products_age_group CHECK (age_group IS NULL OR age_group IN ('ADULT', 'TEEN', 'KIDS', 'BABY')),
  ADD CONSTRAINT ck_catalog_products_price_source
    CHECK (price_source IS NULL OR price_source IN ('JSONLD_OFFER', 'JSONLD_AGGREGATE', 'META', 'MANUAL'));

CREATE INDEX idx_catalog_products_sub_variation ON catalog_products(subcategory, variation_code);
CREATE INDEX idx_catalog_products_price ON catalog_products(price_min, price_max);

ALTER TABLE catalog_products
  ADD CONSTRAINT fk_catalog_products_variation FOREIGN KEY (subcategory, variation_code)
    REFERENCES taxonomy_subcategory_variations(subcategory_code, variation_code);

ALTER TABLE catalog_variants
  ADD COLUMN price DECIMAL(12,2) NULL,
  ADD COLUMN price_currency CHAR(3) NULL;

CREATE TABLE catalog_product_attributes (
  product_id CHAR(36) NOT NULL,
  dimension_code VARCHAR(30) NOT NULL,
  value_code VARCHAR(60) NOT NULL,
  source VARCHAR(12) NOT NULL,                  -- CATALOG (dado oficial) | RULE | AI | USER (curadoria)
  confidence DECIMAL(4,3) NULL,
  position TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (product_id, dimension_code, value_code),
  CONSTRAINT fk_cpa_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE,
  CONSTRAINT fk_cpa_value FOREIGN KEY (dimension_code, value_code) REFERENCES taxonomy_values(dimension_code, code),
  CONSTRAINT ck_cpa_source CHECK (source IN ('USER', 'AI', 'CATALOG', 'RULE')),
  INDEX idx_cpa_filter (dimension_code, value_code, product_id)
);

-- estilo típico da marca (prior das regras de estilo do catálogo)
CREATE TABLE brand_style_priors (
  brand_id CHAR(36) NOT NULL,
  style_code VARCHAR(60) NOT NULL,
  weight DECIMAL(4,3) NOT NULL,
  dimension_code VARCHAR(30) NOT NULL DEFAULT 'STYLE',
  PRIMARY KEY (brand_id, style_code),
  CONSTRAINT fk_bsp_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
  CONSTRAINT fk_bsp_style FOREIGN KEY (dimension_code, style_code) REFERENCES taxonomy_values(dimension_code, code),
  CONSTRAINT ck_bsp_dimension CHECK (dimension_code = 'STYLE')
);

ALTER TABLE brands
  ADD COLUMN price_tier VARCHAR(10) NULL,
  ADD CONSTRAINT ck_brands_price_tier CHECK (price_tier IS NULL OR price_tier IN ('BUDGET', 'MID', 'PREMIUM', 'LUXURY'));
