-- ============================================================================================
-- V2 — Modelo completo das interfaces RF1–RF26 / RNF1–RNF12 (classes v3 + RFC RF4/RF18 + taxonomia)
-- MySQL continua como fonte da verdade (arquitetura poliglota); Cassandra/Redis/OpenSearch/S3 são
-- projeções derivadas. Todas as tabelas novas seguem o padrão id CHAR(36) + auditoria (RNF5).
-- ============================================================================================

-- ---------- users (RF1/RF2/RF3/RF23) ----------
ALTER TABLE users
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN phone_ciphertext VARCHAR(512) NULL,
  ADD COLUMN birth_date_ciphertext VARCHAR(512) NULL,
  ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
  ADD COLUMN cover_url VARCHAR(1024) NULL,
  ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN last_login_at DATETIME(6) NULL,
  ADD COLUMN terms_accepted_at DATETIME(6) NULL,
  ADD COLUMN terms_version VARCHAR(20) NULL,
  ADD COLUMN deletion_requested_at DATETIME(6) NULL,
  ADD COLUMN deletion_scheduled_for DATETIME(6) NULL,
  MODIFY COLUMN private_account BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_country ON users(country);

-- ---------- user_preferences (RF23) ----------
CREATE TABLE user_preferences (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  theme VARCHAR(10) NOT NULL DEFAULT 'AUTO',
  language VARCHAR(10) NOT NULL DEFAULT 'PT_BR',
  density VARCHAR(20) NOT NULL DEFAULT 'COMFORTABLE',
  font_scale INT NOT NULL DEFAULT 100,
  high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
  chrome_background_id VARCHAR(80) NULL,
  size_system VARCHAR(4) NOT NULL DEFAULT 'BR',
  unit_system VARCHAR(4) NOT NULL DEFAULT 'CM',
  mannequin_sex VARCHAR(20) NULL,
  mannequin_skin_tone VARCHAR(20) NULL,
  mannequin_build VARCHAR(20) NULL,
  default_card_skin VARCHAR(20) NULL,
  notification_push_master BOOLEAN NOT NULL DEFAULT TRUE,
  notification_prefs_json JSON NULL,
  client_updated_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ---------- user_consents (RF3.CA16-CA21, RF24.CA15) ----------
CREATE TABLE user_consents (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT FALSE,
  legal_basis VARCHAR(120) NOT NULL,
  policy_version VARCHAR(20) NOT NULL,
  granted_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_user_consents_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_user_consents_purpose UNIQUE (user_id, purpose)
);

-- ---------- verification_codes (RF1.CA05, RF2, RF3.CA08-CA11/CA29-CA30) ----------
CREATE TABLE verification_codes (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  code_hash VARCHAR(128) NOT NULL,
  target_ciphertext VARCHAR(1024) NULL,
  expires_at DATETIME(6) NOT NULL,
  consumed_at DATETIME(6) NULL,
  attempts INT NOT NULL DEFAULT 0,
  send_count INT NOT NULL DEFAULT 1,
  last_sent_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_verification_codes_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_verification_codes_user_purpose ON verification_codes(user_id, purpose, created_at);
CREATE INDEX idx_verification_codes_hash ON verification_codes(code_hash);

-- ---------- data_export_requests (RF3.CA22-CA23) ----------
CREATE TABLE data_export_requests (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
  file_key VARCHAR(512) NULL,
  ready_at DATETIME(6) NULL,
  expires_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_data_export_requests_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ---------- refresh_tokens (RNF2, RF3.CA31-CA32) ----------
ALTER TABLE refresh_tokens
  ADD COLUMN device_name VARCHAR(160) NULL,
  ADD COLUMN location_approx VARCHAR(120) NULL,
  ADD COLUMN last_used_at DATETIME(6) NULL,
  ADD COLUMN persistent BOOLEAN NOT NULL DEFAULT TRUE;

-- ---------- brand_profiles / celebrity_profiles (RF1.CA06-CA10, RF14, RF20/21, RF22) ----------
ALTER TABLE brand_profiles
  ADD COLUMN cover_url VARCHAR(1024) NULL,
  ADD COLUMN cnpj_ciphertext VARCHAR(512) NULL,
  ADD COLUMN razao_social VARCHAR(200) NULL,
  ADD COLUMN nome_fantasia VARCHAR(200) NULL,
  ADD COLUMN fashion_category VARCHAR(80) NULL,
  ADD COLUMN commercial_contact_ciphertext VARCHAR(1024) NULL,
  ADD COLUMN official_hashtag VARCHAR(80) NULL,
  ADD COLUMN activity_proof_url VARCHAR(1024) NULL,
  ADD COLUMN verification_score DECIMAL(5,2) NULL,
  ADD COLUMN verification_notes VARCHAR(1024) NULL,
  ADD COLUMN approved_by CHAR(36) NULL,
  ADD COLUMN approved_at DATETIME(6) NULL,
  ADD COLUMN identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN document_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN requires_seal_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN country CHAR(2) NULL;

ALTER TABLE celebrity_profiles
  ADD COLUMN cover_url VARCHAR(1024) NULL,
  ADD COLUMN real_name_ciphertext VARCHAR(1024) NULL,
  ADD COLUMN areas_json JSON NULL,
  ADD COLUMN verifiable_followers_json JSON NULL,
  ADD COLUMN identity_proof_url VARCHAR(1024) NULL,
  ADD COLUMN verification_url VARCHAR(1024) NULL,
  ADD COLUMN professional_history VARCHAR(2048) NULL,
  ADD COLUMN representation_contact_ciphertext VARCHAR(1024) NULL,
  ADD COLUMN fashion_interests_json JSON NULL,
  ADD COLUMN style_signature_json JSON NULL,
  ADD COLUMN verification_score DECIMAL(5,2) NULL,
  ADD COLUMN verification_notes VARCHAR(1024) NULL,
  ADD COLUMN approved_by CHAR(36) NULL,
  ADD COLUMN approved_at DATETIME(6) NULL,
  ADD COLUMN identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN requires_seal_review BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------- brands (taxonomia §brand — SEEDED / AUTO_DETECTED via Brand Resolver) ----------
CREATE TABLE brands (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  logo_url VARCHAR(1024) NULL,
  website VARCHAR(1024) NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'SEEDED',
  source_confidence DECIMAL(5,4) NULL,
  verified_at DATETIME(6) NULL,
  country CHAR(2) NULL,
  brand_profile_id CHAR(36) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_brands_profile FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id)
);
CREATE INDEX idx_brands_name ON brands(name);

-- ---------- wardrobe_items (RF4/RF6/RF7/RF9/RF18/RF19, taxonomia §02) ----------
ALTER TABLE wardrobe_items
  ADD COLUMN brand_id CHAR(36) NULL,
  ADD COLUMN seal_ids_json JSON NULL,
  ADD COLUMN original_image_url VARCHAR(1024) NULL,
  ADD COLUMN thumbnail_url VARCHAR(1024) NULL,
  ADD COLUMN is_default_image BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN image_mimetype VARCHAR(60) NULL,
  ADD COLUMN image_file_size BIGINT NULL,
  ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN disponivel BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN availability_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN item_condition VARCHAR(20) NULL,
  ADD COLUMN for_sale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN wear_count INT NOT NULL DEFAULT 0,
  ADD COLUMN last_worn_date DATE NULL,
  ADD COLUMN look_do_dia_count INT NOT NULL DEFAULT 0,
  ADD COLUMN scheme_usage_count INT NOT NULL DEFAULT 0,
  ADD COLUMN likes_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN shares_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN remixes_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN comment_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN moderation_reasons_json JSON NULL,
  ADD COLUMN background_config_json JSON NULL,
  ADD COLUMN hype_group_id CHAR(36) NULL,
  ADD COLUMN remixed_from_piece_id CHAR(36) NULL,
  ADD COLUMN grouping_id CHAR(36) NULL,
  ADD COLUMN tags VARCHAR(512) NULL,
  ADD COLUMN notes VARCHAR(1024) NULL,
  ADD COLUMN purchase_date DATE NULL,
  ADD COLUMN purchase_location VARCHAR(160) NULL,
  ADD COLUMN sku VARCHAR(80) NULL,
  ADD COLUMN care_instructions VARCHAR(512) NULL,
  ADD COLUMN model3d_status VARCHAR(20) NULL,
  ADD COLUMN model3d_url VARCHAR(1024) NULL,
  ADD COLUMN model3d_generated_at DATETIME(6) NULL,
  ADD COLUMN last_viewed_at DATETIME(6) NULL,
  ADD CONSTRAINT fk_wardrobe_items_brand FOREIGN KEY (brand_id) REFERENCES brands(id);

CREATE INDEX idx_wardrobe_items_visibility ON wardrobe_items(visibility, moderation_status, created_at);
CREATE INDEX idx_wardrobe_items_category ON wardrobe_items(category, subcategory);
CREATE INDEX idx_wardrobe_items_processing ON wardrobe_items(photo_processing_status);

-- ---------- schemes (RF5/RF6/RF11/RF18, taxonomia §03) ----------
ALTER TABLE schemes
  DROP COLUMN seals,
  ADD COLUMN origin VARCHAR(20) NOT NULL DEFAULT 'CRIAR_LOOK',
  ADD COLUMN season VARCHAR(10) NULL,
  ADD COLUMN mood VARCHAR(20) NULL,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN display_mode VARCHAR(20) NOT NULL DEFAULT 'GRID',
  ADD COLUMN disponivel BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN look_do_dia BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN look_do_dia_count INT NOT NULL DEFAULT 0,
  ADD COLUMN background_color VARCHAR(20) NULL,
  ADD COLUMN background_gradient VARCHAR(512) NULL,
  ADD COLUMN background_animation_type VARCHAR(20) NOT NULL DEFAULT 'NONE',
  ADD COLUMN studio_config_json JSON NULL,
  ADD COLUMN card_skin VARCHAR(20) NULL,
  ADD COLUMN layout_anatomy VARCHAR(40) NULL,
  ADD COLUMN layout_density VARCHAR(20) NULL,
  ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN save_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN seal_ids_json JSON NULL,
  ADD COLUMN tags VARCHAR(512) NULL,
  ADD COLUMN hype_group_id CHAR(36) NULL,
  ADD COLUMN grouping_id CHAR(36) NULL,
  ADD COLUMN revalidation_pending BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN published_at DATETIME(6) NULL;

UPDATE schemes SET visibility = 'PRIVATE' WHERE visibility = 'PRIVADO';
UPDATE schemes SET visibility = 'PUBLIC' WHERE visibility = 'PUBLICO';
UPDATE schemes SET creation_mode = 'AI_ASSISTED' WHERE creation_mode = 'IA';
CREATE INDEX idx_schemes_status_visibility ON schemes(status, visibility, published_at);

-- ---------- scheme_items (SchemeItem — transformação + filtros do pipeline RF5) ----------
ALTER TABLE scheme_items
  ADD COLUMN try_on_layer VARCHAR(20) NULL,
  ADD COLUMN z_index INT NOT NULL DEFAULT 0,
  ADD COLUMN position_x DECIMAL(8,3) NULL,
  ADD COLUMN position_y DECIMAL(8,3) NULL,
  ADD COLUMN scale_factor DECIMAL(6,3) NULL,
  ADD COLUMN rotation_deg DECIMAL(7,2) NULL,
  ADD COLUMN opacity DECIMAL(4,3) NULL,
  ADD COLUMN filters_json JSON NULL,
  ADD COLUMN snapshot_json JSON NULL;

-- ---------- dna_schemes / dna_scheme_items (RF13, taxonomia §04) ----------
CREATE TABLE dna_schemes (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  identity_phrase_ciphertext VARCHAR(2048) NULL,
  archetype VARCHAR(20) NULL,
  boldness_index INT NULL,
  icon_scheme_id CHAR(36) NULL,
  color_palette_json JSON NULL,
  narrative_type VARCHAR(40) NOT NULL DEFAULT 'TIMELINE',
  seasonal_theme VARCHAR(10) NULL,
  occasion VARCHAR(160) NULL,
  style VARCHAR(160) NULL,
  seal_ids_json JSON NULL,
  background_color VARCHAR(20) NULL,
  background_gradient VARCHAR(512) NULL,
  background_image_url VARCHAR(1024) NULL,
  background_animation_type VARCHAR(20) NOT NULL DEFAULT 'NONE',
  studio_config_json JSON NULL,
  card_image_url VARCHAR(1024) NULL,
  creation_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  disponivel BOOLEAN NOT NULL DEFAULT TRUE,
  grouping_id CHAR(36) NULL,
  is_remixed_from CHAR(36) NULL,
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  share_count BIGINT NOT NULL DEFAULT 0,
  remix_count BIGINT NOT NULL DEFAULT 0,
  hype_score DECIMAL(6,2) NULL,
  ai_explanation_json JSON NULL,
  published_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_dna_schemes_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_dna_schemes_user ON dna_schemes(user_id, created_at);

CREATE TABLE dna_scheme_items (
  id CHAR(36) PRIMARY KEY,
  dna_scheme_id CHAR(36) NOT NULL,
  scheme_id CHAR(36) NOT NULL,
  cell VARCHAR(10) NOT NULL,
  era_label VARCHAR(120) NULL,
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  source_scheme_id CHAR(36) NULL,
  applied_to_original BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_dna_scheme_items_dna FOREIGN KEY (dna_scheme_id) REFERENCES dna_schemes(id) ON DELETE CASCADE,
  CONSTRAINT fk_dna_scheme_items_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id)
);

-- ---------- style_dna → resumo vigente por usuário ----------
ALTER TABLE style_dna
  DROP COLUMN narrative_type,
  DROP COLUMN visibility,
  DROP COLUMN card_image_url,
  MODIFY COLUMN archetype VARCHAR(20) NOT NULL DEFAULT 'CLASSIC',
  ADD COLUMN boldness_index INT NOT NULL DEFAULT 0,
  ADD COLUMN style_keywords VARCHAR(512) NULL,
  ADD COLUMN occasion_keywords VARCHAR(512) NULL,
  ADD COLUMN icon_piece_name VARCHAR(180) NULL,
  ADD COLUMN latest_dna_scheme_id CHAR(36) NULL,
  ADD COLUMN synthesized_at DATETIME(6) NULL;

-- ---------- comments (RF19 — alvo polimórfico + respostas) ----------
ALTER TABLE comments DROP FOREIGN KEY fk_comments_scheme;
ALTER TABLE comments DROP FOREIGN KEY fk_comments_wardrobe_item;
DROP INDEX idx_comments_scheme_created ON comments;
ALTER TABLE comments
  DROP COLUMN scheme_id,
  DROP COLUMN wardrobe_item_id,
  ADD COLUMN target_type VARCHAR(20) NOT NULL DEFAULT 'SCHEME',
  ADD COLUMN target_id CHAR(36) NOT NULL DEFAULT '',
  ADD COLUMN parent_comment_id CHAR(36) NULL;
CREATE INDEX idx_comments_target ON comments(target_type, target_id, created_at);

-- ---------- reactions (RF19 — LIKE/TREND/ELEGANTE/CRIATIVO) ----------
DELETE FROM reactions WHERE reaction_type IN ('SAVE', 'FAVORITE', 'SHARE');
UPDATE reactions SET target_type = 'PIECE' WHERE target_type = 'WARDROBE_ITEM';
UPDATE reactions SET target_type = 'DNA' WHERE target_type = 'STYLE_DNA';
DELETE FROM reactions WHERE target_type = 'COMMENT';

-- ---------- saved_items (RF19 "Adicionar ao guarda-roupa" → RF6 Looks/Peças Salvas) ----------
CREATE TABLE saved_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id CHAR(36) NOT NULL,
  saved_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_saved_items_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_saved_items UNIQUE (user_id, target_type, target_id)
);

-- ---------- follows / notifications (RNF10) ----------
ALTER TABLE follows ADD COLUMN responded_at DATETIME(6) NULL;

ALTER TABLE notifications
  ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN resource_type VARCHAR(30) NULL,
  ADD COLUMN payload_json JSON NULL,
  ADD COLUMN read_at DATETIME(6) NULL,
  ADD COLUMN delivered BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE notifications SET type = 'NEW_LIKE' WHERE type = 'LIKE_RECEIVED';
UPDATE notifications SET type = 'NEW_COMMENT' WHERE type = 'COMMENT_RECEIVED';
UPDATE notifications SET type = 'NEW_REMIX' WHERE type = 'REMIX_CREATED';
UPDATE notifications SET type = 'SCHEME_CREATED' WHERE type = 'SCHEME_PUBLISHED';
UPDATE notifications SET type = 'SEAL_GRANTED' WHERE type = 'BRAND_LINK_STATUS_CHANGED';
UPDATE notifications SET type = 'NEW_LOGIN_DEVICE' WHERE type = 'SECURITY_ALERT';

-- ---------- photos (RF12/RF15) ----------
ALTER TABLE photos
  ADD COLUMN original_url VARCHAR(1024) NULL,
  ADD COLUMN thumbnail_url VARCHAR(1024) NULL,
  ADD COLUMN mime_type VARCHAR(60) NULL,
  ADD COLUMN width INT NULL,
  ADD COLUMN height INT NULL,
  ADD COLUMN bytes_size BIGINT NULL,
  ADD COLUMN quality_score DECIMAL(5,4) NULL,
  ADD COLUMN moderation_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN key_moment BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN edited_from_photo_id CHAR(36) NULL,
  ADD COLUMN last_viewed_at DATETIME(6) NULL,
  ADD COLUMN deleted_at DATETIME(6) NULL;

-- ---------- pipeline_jobs + quality_scores + logs (RFC RF4/RF18) ----------
ALTER TABLE pipeline_jobs
  ADD COLUMN target_type VARCHAR(30) NULL,
  ADD COLUMN input_json JSON NULL,
  ADD COLUMN result_json JSON NULL,
  ADD COLUMN stages_json JSON NULL,
  ADD COLUMN quality_score DECIMAL(5,4) NULL,
  ADD COLUMN total_cost_usd DECIMAL(10,5) NULL,
  ADD COLUMN total_time_ms INT NULL,
  ADD COLUMN fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN queued_at DATETIME(6) NULL;

CREATE TABLE quality_scores (
  id CHAR(36) PRIMARY KEY,
  wardrobe_item_id CHAR(36) NULL,
  pipeline_job_id CHAR(36) NOT NULL,
  metrics_json JSON NULL,
  overall DECIMAL(5,4) NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  acceptance_threshold DECIMAL(5,4) NOT NULL,
  issues_json JSON NULL,
  recommendations_json JSON NULL,
  expires_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);
CREATE INDEX idx_quality_scores_item ON quality_scores(wardrobe_item_id, created_at);

CREATE TABLE processing_jobs_log (
  id CHAR(36) PRIMARY KEY,
  pipeline_job_id CHAR(36) NOT NULL,
  wardrobe_item_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  job_type VARCHAR(50) NULL,
  status VARCHAR(50) NULL,
  total_processing_time_ms INT NULL,
  stage_times_json JSON NULL,
  final_quality_score DECIMAL(5,4) NULL,
  total_cost_usd DECIMAL(10,5) NULL,
  was_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  retry_count INT NOT NULL DEFAULT 0,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL
);
CREATE INDEX idx_processing_jobs_log_user ON processing_jobs_log(user_id, created_at);
CREATE INDEX idx_processing_jobs_log_quality ON processing_jobs_log(final_quality_score);

CREATE TABLE render_jobs_log (
  id CHAR(36) PRIMARY KEY,
  pipeline_job_id CHAR(36) NOT NULL,
  scheme_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  rendering_type VARCHAR(50) NULL,
  status VARCHAR(50) NULL,
  total_processing_time_ms INT NULL,
  stage_times_json JSON NULL,
  final_quality_score DECIMAL(5,4) NULL,
  cost_fashn_ai DECIMAL(10,5) NULL,
  cost_cleanup_ai DECIMAL(10,5) NULL,
  cost_rembg DECIMAL(10,5) NULL,
  total_cost DECIMAL(10,5) NULL,
  retry_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL
);
CREATE INDEX idx_render_jobs_log_user ON render_jobs_log(user_id, created_at);
CREATE INDEX idx_render_jobs_log_cost ON render_jobs_log(total_cost);

CREATE TABLE metric_snapshots (
  id CHAR(36) PRIMARY KEY,
  kind VARCHAR(30) NOT NULL,
  period_start DATETIME(6) NOT NULL,
  period_end DATETIME(6) NOT NULL,
  values_json JSON NULL,
  created_at DATETIME(6) NOT NULL
);
CREATE INDEX idx_metric_snapshots_kind ON metric_snapshots(kind, period_end);

-- ---------- seals / seal_bonds / promotions / scheme_groupings (RF14/RF20/RF21/RF22/RF25/RNF12) ----------
DROP TABLE scheme_brand_links;

CREATE TABLE seals (
  id CHAR(36) PRIMARY KEY,
  owner_user_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  tier VARCHAR(10) NOT NULL DEFAULT 'LOOK',
  policy_text VARCHAR(2048) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  icon_url VARCHAR(1024) NULL,
  premium BOOLEAN NOT NULL DEFAULT FALSE,
  background_config_json JSON NULL,
  available_from DATETIME(6) NULL,
  available_until DATETIME(6) NULL,
  usage_limit INT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  auto_issued BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_seals_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
CREATE INDEX idx_seals_owner_status ON seals(owner_user_id, status);

CREATE TABLE seal_bonds (
  id CHAR(36) PRIMARY KEY,
  scheme_id CHAR(36) NOT NULL,
  target_owner_user_id CHAR(36) NOT NULL,
  requested_by_user_id CHAR(36) NOT NULL,
  tier VARCHAR(10) NOT NULL,
  linked_piece_ids_json JSON NULL,
  confidence DECIMAL(5,4) NULL,
  justification VARCHAR(1024) NULL,
  basis VARCHAR(30) NOT NULL DEFAULT 'BRAND_MATCH',
  status VARCHAR(20) NOT NULL DEFAULT 'SUGGESTED',
  requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  seal_id CHAR(36) NULL,
  image_rights_consent BOOLEAN NULL,
  ai_inference_id CHAR(36) NULL,
  responded_at DATETIME(6) NULL,
  reviewed_at DATETIME(6) NULL,
  review_note VARCHAR(1024) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_seal_bonds_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id),
  CONSTRAINT fk_seal_bonds_target FOREIGN KEY (target_owner_user_id) REFERENCES users(id),
  CONSTRAINT fk_seal_bonds_requester FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_seal_bonds_seal FOREIGN KEY (seal_id) REFERENCES seals(id)
);
CREATE INDEX idx_seal_bonds_target_status ON seal_bonds(target_owner_user_id, status, created_at);
CREATE INDEX idx_seal_bonds_scheme ON seal_bonds(scheme_id);

CREATE TABLE promotions (
  id CHAR(36) PRIMARY KEY,
  seal_id CHAR(36) NOT NULL,
  seal_bond_id CHAR(36) NULL,
  type VARCHAR(30) NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  description VARCHAR(512) NULL,
  discount_percent INT NULL,
  partner_brand_user_id CHAR(36) NULL,
  campaign_id CHAR(36) NULL,
  campaign_limit INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
  owner_user_id CHAR(36) NOT NULL,
  expires_at DATETIME(6) NULL,
  redeemed_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_promotions_seal FOREIGN KEY (seal_id) REFERENCES seals(id),
  CONSTRAINT fk_promotions_bond FOREIGN KEY (seal_bond_id) REFERENCES seal_bonds(id)
);
CREATE INDEX idx_promotions_owner ON promotions(owner_user_id, status);

CREATE TABLE scheme_groupings (
  id CHAR(36) PRIMARY KEY,
  owner_user_id CHAR(36) NOT NULL,
  type VARCHAR(30) NOT NULL,
  label VARCHAR(160) NOT NULL,
  description VARCHAR(1024) NULL,
  cover_url VARCHAR(1024) NULL,
  atmosphere_prompt VARCHAR(1024) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_scheme_groupings_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

-- ---------- hype_groups / acervo_groups / item_embeddings (RF6 §9, RF24 #13/#14/#19) ----------
CREATE TABLE hype_groups (
  id CHAR(36) PRIMARY KEY,
  entity_type VARCHAR(10) NOT NULL,
  signature_style VARCHAR(80) NULL,
  signature_occasion VARCHAR(80) NULL,
  signature_brands_json JSON NULL,
  signature_colors_json JSON NULL,
  signature_piece_types_json JSON NULL,
  member_ids_json JSON NULL,
  member_count INT NOT NULL DEFAULT 0,
  hype_score_global DECIMAL(6,2) NULL,
  computed_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);

CREATE TABLE acervo_groups (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  entity_type VARCHAR(10) NOT NULL,
  label VARCHAR(120) NOT NULL,
  member_ids_json JSON NULL,
  centroid_json JSON NULL,
  member_count INT NOT NULL DEFAULT 0,
  computed_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_acervo_groups_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_acervo_groups_user ON acervo_groups(user_id, entity_type);

CREATE TABLE item_embeddings (
  id CHAR(36) PRIMARY KEY,
  entity_type VARCHAR(10) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  provider VARCHAR(60) NOT NULL,
  dimensions INT NOT NULL,
  vector_json JSON NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_item_embeddings UNIQUE (entity_type, entity_id)
);
CREATE INDEX idx_item_embeddings_user ON item_embeddings(user_id, entity_type);

-- ---------- ai_inference_log (RF24.CA16) / moderation_queue (RN11) ----------
CREATE TABLE ai_inference_log (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  capability VARCHAR(50) NOT NULL,
  host_rf VARCHAR(10) NULL,
  provider VARCHAR(60) NOT NULL,
  model VARCHAR(120) NULL,
  latency_ms BIGINT NOT NULL,
  estimated_cost_usd DECIMAL(10,6) NULL,
  result VARCHAR(30) NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  input_summary_json JSON NULL,
  output_summary VARCHAR(1024) NULL,
  consent_state VARCHAR(40) NULL,
  correlation_id VARCHAR(120) NOT NULL,
  created_at DATETIME(6) NOT NULL
);
CREATE INDEX idx_ai_inference_log_user ON ai_inference_log(user_id, capability, created_at);

CREATE TABLE moderation_queue (
  id CHAR(36) PRIMARY KEY,
  target_type VARCHAR(30) NOT NULL,
  target_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  content_excerpt VARCHAR(512) NULL,
  categories_json JSON NULL,
  confidence DECIMAL(5,4) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME(6) NULL,
  reason VARCHAR(512) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);
CREATE INDEX idx_moderation_queue_status ON moderation_queue(status, created_at);

-- ---------- asset_presets (RF11/RF23) / backup_records (RNF4) ----------
CREATE TABLE asset_presets (
  id VARCHAR(120) PRIMARY KEY,
  kind VARCHAR(40) NOT NULL,
  label VARCHAR(160) NOT NULL,
  preset_group VARCHAR(120) NULL,
  static_url VARCHAR(1024) NULL,
  preview_url VARCHAR(1024) NULL,
  animated_url VARCHAR(1024) NULL,
  poster_url VARCHAR(1024) NULL,
  palette_json JSON NULL,
  metadata_json JSON NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ASSET',
  sort_order INT NOT NULL DEFAULT 0,
  rf_tags VARCHAR(60) NULL,
  synced_at DATETIME(6) NOT NULL
);
CREATE INDEX idx_asset_presets_kind ON asset_presets(kind, sort_order);

CREATE TABLE backup_records (
  id CHAR(36) PRIMARY KEY,
  kind VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  file_key VARCHAR(512) NULL,
  size_bytes BIGINT NULL,
  checksum VARCHAR(128) NULL,
  started_at DATETIME(6) NOT NULL,
  finished_at DATETIME(6) NULL,
  notes VARCHAR(512) NULL
);
