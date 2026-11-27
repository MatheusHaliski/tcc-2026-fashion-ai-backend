-- Flat lay da peça gerado na nossa GPU (services/garment_gpu, Fase 2 no RunPod) e aprovado por uma pessoa.
-- É reconstrução por IA, não pixels fotografados: fica em colunas próprias, separado da Peça inteira real (whole_*,
-- V75), que continua sendo o fallback do Total frame. Gravado só por scripts/catalog/apply_flat_lays.py --apply.
ALTER TABLE catalog_images
  ADD COLUMN flat_lay_url VARCHAR(1024) NULL,
  ADD COLUMN flat_lay_back_url VARCHAR(1024) NULL,
  ADD COLUMN flat_lay_json JSON NULL,
  ADD COLUMN flat_lay_status VARCHAR(24) NULL;
