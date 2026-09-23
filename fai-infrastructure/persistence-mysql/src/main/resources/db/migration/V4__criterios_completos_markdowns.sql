-- V4 — lacunas encontradas no confronto com markdowns/02-rf-reestruturados-e-criterios-aceite.md,
-- HU17–HU20, rf20-rf21-vinculo-marca-celebridade.md e RF11_PROPOSTA_CONTAINER_EDITORIAL_VS_AURA.md.

-- RF3.CA12 — visibilidade do perfil em três níveis (público / somente seguidores / privado); nasce privado (CA19).
ALTER TABLE users ADD COLUMN profile_visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE';
UPDATE users SET profile_visibility = CASE WHEN private_account THEN 'PRIVATE' ELSE 'PUBLIC' END;

-- RF31 / RF6.CA11–CA12 — favoritar esquema próprio e look salvo de terceiro (faixa superior do card).
ALTER TABLE schemes ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE saved_items ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- HU19 — feedback do Look do Dia ("adorei" / "não usei" / "não gostei"); alimenta o pré-requisito do RF13.
ALTER TABLE daily_looks ADD COLUMN feedback VARCHAR(20) NULL;
ALTER TABLE daily_looks ADD COLUMN feedback_at DATETIME(6) NULL;
ALTER TABLE daily_looks ADD COLUMN week_plan_day_id CHAR(36) NULL;

-- HU18 — Semana Planejada (7 looks sem repetição de combinação).
CREATE TABLE week_plans (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  week_start DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  gaps_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_week_plans_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_week_plans_user ON week_plans(user_id, status, week_start);

CREATE TABLE week_plan_days (
  id CHAR(36) PRIMARY KEY,
  week_plan_id CHAR(36) NOT NULL,
  day_date DATE NOT NULL,
  event_label VARCHAR(120) NULL,
  occasion VARCHAR(40) NULL,
  scheme_id CHAR(36) NULL,
  piece_ids_json JSON NULL,
  combination_key VARCHAR(512) NULL,
  rationale VARCHAR(512) NULL,
  edited_manually BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_week_plan_days_plan FOREIGN KEY (week_plan_id) REFERENCES week_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_week_plan_days_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id),
  CONSTRAINT uq_week_plan_day UNIQUE (week_plan_id, day_date)
);

-- RF13 / HU20 — Camada 1 completa, Camada 2 (Identidade de Vida) cifrada em repouso, privacidade por campo,
-- recálculo a cada 10 interações e versionamento por data de geração.
ALTER TABLE style_dna ADD COLUMN silhouette VARCHAR(60) NULL;
ALTER TABLE style_dna ADD COLUMN life_identity_ciphertext TEXT NULL;
ALTER TABLE style_dna ADD COLUMN life_private_fields_json JSON NULL;
ALTER TABLE style_dna ADD COLUMN interactions_at_synthesis INT NOT NULL DEFAULT 0;
ALTER TABLE style_dna ADD COLUMN card_image_url VARCHAR(1024) NULL;
ALTER TABLE style_dna ADD COLUMN card_expires_at DATETIME(6) NULL;
ALTER TABLE style_dna ADD COLUMN phrase_source VARCHAR(20) NULL;

CREATE TABLE style_dna_versions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  snapshot_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_style_dna_versions_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_style_dna_versions_user ON style_dna_versions(user_id, created_at);

-- RF19.CA08/CA09 — compartilhamento no feed interno (publicação referenciando o original) e exportação externa.
CREATE TABLE shares (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id CHAR(36) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  caption VARCHAR(500) NULL,
  export_url VARCHAR(1024) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_shares_target ON shares(target_type, target_id);
CREATE INDEX idx_shares_user ON shares(user_id, created_at);

-- RF20/RF21 — limiar de confiança configurável por perfil emissor (regra 2).
ALTER TABLE brand_profiles ADD COLUMN seal_confidence_threshold DECIMAL(4,3) NOT NULL DEFAULT 0.600;
ALTER TABLE celebrity_profiles ADD COLUMN seal_confidence_threshold DECIMAL(4,3) NOT NULL DEFAULT 0.600;

-- RF20.CA08/CA14/CA16 — selo emitido único e rastreável: origem do vínculo, código, emissão, validade e revisor.
ALTER TABLE seal_bonds ADD COLUMN origin VARCHAR(20) NOT NULL DEFAULT 'AI_SUGGESTION';
ALTER TABLE seal_bonds ADD COLUMN seal_code VARCHAR(40) NULL;
ALTER TABLE seal_bonds ADD COLUMN issued_at DATETIME(6) NULL;
ALTER TABLE seal_bonds ADD COLUMN expires_at DATETIME(6) NULL;
ALTER TABLE seal_bonds ADD COLUMN reviewed_by CHAR(36) NULL;
ALTER TABLE seal_bonds ADD COLUMN era_label VARCHAR(80) NULL;
CREATE UNIQUE INDEX uq_seal_bonds_code ON seal_bonds(seal_code);

-- RF20.CA11–CA13 / CA21–CA23 — promoção passa a ser definição de campanha; resgates em tabela própria.
ALTER TABLE promotions MODIFY COLUMN seal_id CHAR(36) NULL;
ALTER TABLE promotions MODIFY COLUMN code VARCHAR(40) NULL;
ALTER TABLE promotions ADD COLUMN title VARCHAR(160) NULL;
ALTER TABLE promotions ADD COLUMN rules VARCHAR(2048) NULL;
ALTER TABLE promotions ADD COLUMN required_seal_kind VARCHAR(20) NULL;
ALTER TABLE promotions ADD COLUMN starts_at DATETIME(6) NULL;
ALTER TABLE promotions ADD COLUMN total_quota INT NULL;
ALTER TABLE promotions ADD COLUMN per_user_limit INT NOT NULL DEFAULT 1;
ALTER TABLE promotions ADD COLUMN redeemed_count INT NOT NULL DEFAULT 0;

CREATE TABLE promotion_redemptions (
  id CHAR(36) PRIMARY KEY,
  promotion_id CHAR(36) NOT NULL,
  seal_bond_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  issuer_user_id CHAR(36) NOT NULL,
  partner_brand_user_id CHAR(36) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
  redeemed_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_redemptions_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id),
  CONSTRAINT fk_redemptions_bond FOREIGN KEY (seal_bond_id) REFERENCES seal_bonds(id),
  CONSTRAINT fk_redemptions_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_redemptions_user ON promotion_redemptions(user_id, promotion_id);

-- RF11 — container do esquema: origem indefinida/manual/auto + obrigatório (já existem container_origin,
-- container_color e container_mandatory em schemes); a Direção recomendada aplicada fica registrada.
ALTER TABLE schemes ADD COLUMN recommended_direction VARCHAR(40) NULL;
