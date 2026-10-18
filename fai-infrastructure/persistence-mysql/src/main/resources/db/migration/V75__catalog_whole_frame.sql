-- Peça inteira (Total frame): a peça recortada sem pessoa, centralizada em 900×1200 (scripts/catalog/process_whole_frames.py).
-- Ciclo de vida próprio, independente do enquadramento de Tecido (stored_url/assets_json).
ALTER TABLE catalog_images
  ADD COLUMN whole_url VARCHAR(1024) NULL,
  ADD COLUMN whole_json JSON NULL,
  ADD COLUMN whole_status VARCHAR(24) NULL,
  ADD COLUMN whole_pipeline_version VARCHAR(40) NULL;
CREATE INDEX idx_catalog_images_whole ON catalog_images (whole_pipeline_version, whole_status);
