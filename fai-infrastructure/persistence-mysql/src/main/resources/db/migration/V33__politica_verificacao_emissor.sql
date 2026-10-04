-- Política de verificação de marcas e celebridades (RF1.CA07–CA09, docs/politicas/VERIFICACAO_MARCAS_E_CELEBRIDADES.md):
-- cada perfil emissor guarda o ciclo da análise — quantos envios, o último envio, os motivos padronizados e a checklist
-- da última decisão e a mensagem de quem reenviou. O status ganha o valor AJUSTES (cabe no VARCHAR(20) existente).
ALTER TABLE brand_profiles
  ADD COLUMN review_attempts INT NOT NULL DEFAULT 1,
  ADD COLUMN review_submitted_at DATETIME(6) NULL,
  ADD COLUMN review_reasons VARCHAR(400) NULL,
  ADD COLUMN review_checklist VARCHAR(1024) NULL,
  ADD COLUMN review_owner_message VARCHAR(600) NULL;

ALTER TABLE celebrity_profiles
  ADD COLUMN review_attempts INT NOT NULL DEFAULT 1,
  ADD COLUMN review_submitted_at DATETIME(6) NULL,
  ADD COLUMN review_reasons VARCHAR(400) NULL,
  ADD COLUMN review_checklist VARCHAR(1024) NULL,
  ADD COLUMN review_owner_message VARCHAR(600) NULL;
