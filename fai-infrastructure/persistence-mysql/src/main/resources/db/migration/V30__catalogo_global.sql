-- RF47 · Acervo & Busca Catalogada (catalog-first). O catálogo é GLOBAL e separado do guarda-roupa: CatalogProduct é o
-- produto conhecido pelo FashionAI; WardrobeItem é a posse desse produto por uma pessoa (por referência, sem cópias).
-- Reaproveita a tabela `brands` (V2/V3) como entidade Brand. docs/catalogo/RF47_ACERVO_BUSCA_CATALOGADA.md

-- Apelidos de marca ("PRL" → Ralph Lauren, "Levis" → Levi's): a busca e a ingestão nunca criam marca duplicada.
CREATE TABLE brand_aliases (
  id CHAR(36) PRIMARY KEY,
  brand_id CHAR(36) NOT NULL,
  alias VARCHAR(160) NOT NULL,
  alias_norm VARCHAR(160) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_brand_aliases_norm UNIQUE (alias_norm),
  CONSTRAINT fk_brand_aliases_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- Fontes oficiais por marca: a busca externa só aceita resultados destes domínios (nunca Pinterest, blogs, fóruns…).
CREATE TABLE catalog_sources (
  id CHAR(36) PRIMARY KEY,
  brand_id CHAR(36) NOT NULL,
  domain VARCHAR(160) NOT NULL,
  source_type VARCHAR(30) NOT NULL,
  country CHAR(2) NULL,
  allows_image_persistence BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes VARCHAR(512) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_catalog_sources UNIQUE (brand_id, domain),
  CONSTRAINT fk_catalog_sources_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- Produto global. dedup_key = identificador forte mais confiável disponível (gtin > ean > upc > sku > código >
-- URL canônica > marca+modelo+variante > marca+título+cor), garantido único: a ingestão é idempotente.
CREATE TABLE catalog_products (
  id CHAR(36) PRIMARY KEY,
  brand_id CHAR(36) NOT NULL,
  category VARCHAR(80) NOT NULL,
  subcategory VARCHAR(120) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  model_name VARCHAR(160) NULL,
  product_code VARCHAR(80) NULL,
  sku VARCHAR(80) NULL,
  gtin VARCHAR(20) NULL,
  ean VARCHAR(20) NULL,
  upc VARCHAR(20) NULL,
  color VARCHAR(80) NULL,
  color_name VARCHAR(120) NULL,
  material VARCHAR(40) NULL,
  collection VARCHAR(160) NULL,
  gender VARCHAR(20) NULL,
  official_product_url VARCHAR(1024) NULL,
  canonical_url VARCHAR(512) NULL,
  source_type VARCHAR(30) NOT NULL,
  source_domain VARCHAR(160) NULL,
  source_status VARCHAR(30) NOT NULL,
  ingestion_status VARCHAR(30) NOT NULL,
  dedup_key VARCHAR(255) NOT NULL,
  search_text TEXT NOT NULL,
  metadata_json JSON NULL,
  owners_count INT NOT NULL DEFAULT 0,
  first_seen_at DATETIME(6) NOT NULL,
  last_verified_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_catalog_products_dedup UNIQUE (dedup_key),
  CONSTRAINT fk_catalog_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id)
);
CREATE INDEX idx_catalog_products_lookup ON catalog_products(brand_id, subcategory, ingestion_status);
CREATE INDEX idx_catalog_products_category ON catalog_products(category, subcategory);
CREATE INDEX idx_catalog_products_gtin ON catalog_products(gtin);
CREATE INDEX idx_catalog_products_sku ON catalog_products(sku);
CREATE INDEX idx_catalog_products_code ON catalog_products(product_code);
CREATE INDEX idx_catalog_products_canonical ON catalog_products(canonical_url);
CREATE INDEX idx_catalog_products_status ON catalog_products(source_status, last_verified_at);
-- índice de busca textual (marca, nome, modelo, cor, coleção, códigos, apelidos) — InnoDB FULLTEXT com parser ngram
-- (aceita prefixos curtos como "air f"); o OpenSearch opcional pode assumir depois sem mudar a API.
CREATE FULLTEXT INDEX ftx_catalog_products_search ON catalog_products(search_text) WITH PARSER ngram;

CREATE TABLE catalog_product_aliases (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  alias VARCHAR(160) NOT NULL,
  alias_norm VARCHAR(160) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_catalog_product_aliases UNIQUE (product_id, alias_norm),
  CONSTRAINT fk_catalog_product_aliases_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE
);

-- Variantes (cor/código): "Air Force 1 '07" → White/White, Black/Black…
CREATE TABLE catalog_variants (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  variant_key VARCHAR(160) NOT NULL,
  color VARCHAR(80) NULL,
  color_name VARCHAR(120) NULL,
  variant_code VARCHAR(80) NULL,
  sku VARCHAR(80) NULL,
  gtin VARCHAR(20) NULL,
  availability VARCHAR(30) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_catalog_variants UNIQUE (product_id, variant_key),
  CONSTRAINT fk_catalog_variants_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE
);

-- Fotos oficiais com proveniência. usage_status separa "descoberta" de "permitida": REFERENCE_ONLY guarda só a URL
-- autorizada (nenhuma cópia local); PERSISTED só quando a fonte permite (catalog_sources.allows_image_persistence).
CREATE TABLE catalog_images (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NULL,
  image_url VARCHAR(1024) NOT NULL,
  image_url_hash CHAR(64) NOT NULL,
  image_type VARCHAR(20) NOT NULL,
  source_url VARCHAR(1024) NULL,
  source_domain VARCHAR(160) NULL,
  source_type VARCHAR(30) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  usage_status VARCHAR(30) NOT NULL,
  stored_url VARCHAR(1024) NULL,
  retrieved_at DATETIME(6) NOT NULL,
  last_verified_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_catalog_images UNIQUE (product_id, image_url_hash),
  CONSTRAINT fk_catalog_images_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_images_variant FOREIGN KEY (variant_id) REFERENCES catalog_variants(id) ON DELETE SET NULL
);
CREATE INDEX idx_catalog_images_product ON catalog_images(product_id, is_primary);

-- Execuções do pipeline de ingestão (bootstrap, incremental, manutenção, seleção do usuário) — auditoria.
CREATE TABLE catalog_ingestion_runs (
  id CHAR(36) PRIMARY KEY,
  kind VARCHAR(30) NOT NULL,
  source VARCHAR(255) NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  total_read INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  duplicates_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  report_json JSON NULL,
  started_at DATETIME(6) NOT NULL,
  finished_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);

-- Peça pessoal referencia o produto global; a imagem principal pode ser a oficial (CATALOG) ou a foto da pessoa.
ALTER TABLE wardrobe_items
  ADD COLUMN catalog_product_id CHAR(36) NULL AFTER capture_session_id,
  ADD COLUMN catalog_variant_id CHAR(36) NULL AFTER catalog_product_id,
  ADD COLUMN image_origin VARCHAR(20) NULL AFTER catalog_variant_id,
  ADD COLUMN user_image_url VARCHAR(1024) NULL AFTER image_origin;
CREATE INDEX idx_wardrobe_items_catalog ON wardrobe_items(catalog_product_id);

-- Tutorial "Como fotografar" por guia (parte de cima, calçados, relógio…): "Não mostrar novamente" sincronizado na conta.
ALTER TABLE user_preferences ADD COLUMN capture_tutorial_json JSON NULL;

-- Domínios oficiais das marcas já semeadas (V3). Imagens oficiais ficam REFERENCE_ONLY por padrão.
INSERT INTO catalog_sources (id, brand_id, domain, source_type, country, allows_image_persistence, active, version, created_at, updated_at)
SELECT UUID(), b.id, LOWER(REPLACE(REPLACE(REPLACE(b.website, 'https://', ''), 'http://', ''), 'www.', '')), 'OFFICIAL_BRAND', b.country, FALSE, TRUE, 0, NOW(6), NOW(6)
FROM brands b WHERE b.website IS NOT NULL AND b.website <> '';
