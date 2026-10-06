-- Proveniência da taxonomia (docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md, C.6): de onde veio a variação gravada na peça
-- e no produto (USER = a pessoa escolheu/confirmou; AI = sugestão da IA; CATALOG = dado oficial do produto; RULE =
-- regra determinística, inclusive o valor padrão aplicado por falta de dado). O status (USER_CONFIRMED, AI_SUGGESTED,
-- NEEDS_REVIEW, UNKNOWN) continua dizendo o quanto o valor é confiável; a origem diz quem o escreveu.
-- Enriquecimento do catálogo fora do Flyway (job com dry-run): versão das regras que derivaram variação/atributos.
-- Fila de revisão da IA passa a aceitar produto do catálogo (o backfill não tem usuária dona do item).
-- Aditiva: colunas novas anuláveis; ai_review_items.user_id passa a aceitar NULL (nenhum dado muda).

ALTER TABLE wardrobe_items
  ADD COLUMN variation_source VARCHAR(12) NULL AFTER variation_confidence;

ALTER TABLE wardrobe_items
  ADD CONSTRAINT ck_wardrobe_items_variation_source
    CHECK (variation_source IS NULL OR variation_source IN ('USER', 'AI', 'CATALOG', 'RULE'));

ALTER TABLE catalog_products
  ADD COLUMN variation_source VARCHAR(12) NULL AFTER variation_confidence,
  ADD COLUMN enrichment_version VARCHAR(40) NULL,
  ADD COLUMN enriched_at DATETIME(6) NULL;

ALTER TABLE catalog_products
  ADD CONSTRAINT ck_catalog_products_variation_source
    CHECK (variation_source IS NULL OR variation_source IN ('USER', 'AI', 'CATALOG', 'RULE'));

CREATE INDEX idx_catalog_products_enrichment ON catalog_products(enrichment_version);

ALTER TABLE ai_review_items
  MODIFY COLUMN user_id CHAR(36) NULL,
  ADD COLUMN target_type VARCHAR(20) NOT NULL DEFAULT 'PIECE' AFTER kind,
  ADD COLUMN product_id CHAR(36) NULL AFTER piece_id;

ALTER TABLE ai_review_items
  ADD CONSTRAINT ck_ai_review_items_target CHECK (target_type IN ('PIECE', 'CATALOG_PRODUCT')),
  ADD CONSTRAINT fk_ai_review_items_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE;

CREATE INDEX idx_ai_review_items_target ON ai_review_items(target_type, status, created_at);
