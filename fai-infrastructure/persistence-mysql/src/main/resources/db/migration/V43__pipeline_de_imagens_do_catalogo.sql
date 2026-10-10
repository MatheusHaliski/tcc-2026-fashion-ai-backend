-- Renumerada para V43: nasceu V38 em paralelo com V38__peca_para_doar (main); o Flyway recusa versões repetidas.
-- Pipeline de imagens da Busca Catalogada (CATALOG_IMAGE_PIPELINE_V2 · docs/catalogo/PIPELINE_IMAGENS_CATALOGO.md).
-- Dois níveis (RN47.03): sem permissão de persistência a foto continua só como URL (REFERENCE_ONLY) e aqui ficam só os
-- metadados da análise — recorte semântico 4:5, região de foco, métricas e veredito —; o card mostra a URL original
-- com esse recorte. Com allows_image_persistence o master processado vai para o storage (stored_url / assets_json).
-- processing_status é também o estado do job assíncrono: PENDING → DOWNLOADING → (ANALYZING…VALIDATING, no log)
-- → APPROVED | NEEDS_REPROCESSING | REJECTED | FAILED. Idempotência: image_url_hash + pipeline_version.
-- O produto não ganha colunas: a canônica é a imagem com is_canonical (sem estrutura duplicada).
ALTER TABLE catalog_images
  ADD COLUMN width INT NULL AFTER stored_url,
  ADD COLUMN height INT NULL AFTER width,
  ADD COLUMN mime VARCHAR(20) NULL AFTER height,
  ADD COLUMN source_sha256 CHAR(64) NULL AFTER mime,
  ADD COLUMN phash CHAR(16) NULL AFTER source_sha256,
  ADD COLUMN processing_status VARCHAR(24) NOT NULL DEFAULT 'PENDING' AFTER phash,
  ADD COLUMN pipeline_version VARCHAR(40) NULL AFTER processing_status,
  ADD COLUMN quality_score DECIMAL(5,4) NULL AFTER pipeline_version,
  ADD COLUMN gate_reasons VARCHAR(500) NULL AFTER quality_score,
  ADD COLUMN view_role VARCHAR(20) NULL AFTER gate_reasons,
  ADD COLUMN is_canonical BOOLEAN NOT NULL DEFAULT FALSE AFTER view_role,
  ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT 'NONE' AFTER is_canonical,
  ADD COLUMN crop_json JSON NULL AFTER review_status,
  ADD COLUMN metrics_json JSON NULL AFTER crop_json,
  ADD COLUMN assets_json JSON NULL AFTER metrics_json,
  ADD COLUMN attempts INT NOT NULL DEFAULT 0 AFTER assets_json,
  ADD COLUMN processed_at DATETIME(6) NULL AFTER attempts,
  ADD INDEX idx_catalog_images_processing (processing_status, attempts),
  ADD INDEX idx_catalog_images_canonical (product_id, is_canonical),
  ADD INDEX idx_catalog_images_review (review_status),
  ADD INDEX idx_catalog_images_phash (phash);
