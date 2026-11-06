-- Modelo 3D de vitrine do produto do catálogo (etapa 3): o .glb que aparece no manequim, no Meu Quarto 3D, no
-- visualizador da peça e no card expandido de quem escolhe essa peça do catálogo. Não tem esqueleto nem métricas de
-- vestir, então NUNCA veste o avatar: isso continua sendo só o garment_assets_3d APPROVED (V59, GarmentFitGate).
-- Ciclo: DRAFT (importado, a revisar) → PUBLISHED (servido pela API; no máximo um por produto) → RETIRED.
-- Gravado por scripts/catalog/import_meshy_glbs.py --apply; o app só lê.
CREATE TABLE catalog_product_models_3d (
  id CHAR(36) PRIMARY KEY,
  catalog_product_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  source VARCHAR(20) NOT NULL,
  generator VARCHAR(40) NULL,
  sha256 CHAR(64) NOT NULL,
  renditions_json JSON NOT NULL,
  metrics_json JSON NULL,
  review_notes VARCHAR(1000) NULL,
  published_at DATETIME(6) NULL,
  published_by VARCHAR(80) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT ck_catalog_model_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  CONSTRAINT fk_catalog_model_product FOREIGN KEY (catalog_product_id) REFERENCES catalog_products(id) ON DELETE CASCADE,
  CONSTRAINT uq_catalog_model_file UNIQUE (catalog_product_id, sha256),
  INDEX ix_catalog_model_product (catalog_product_id, status)
);
