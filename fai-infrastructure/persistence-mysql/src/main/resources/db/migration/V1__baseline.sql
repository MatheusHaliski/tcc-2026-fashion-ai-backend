CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  display_name_ciphertext VARCHAR(1024) NOT NULL,
  email_ciphertext VARCHAR(1024) NOT NULL,
  email_hash VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(512) NOT NULL,
  profile_type VARCHAR(20) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'USER',
  avatar_url VARCHAR(1024) NULL,
  bio_ciphertext VARCHAR(2048) NULL,
  private_account BOOLEAN NOT NULL DEFAULT FALSE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  country CHAR(2) NULL,
  interface_background_preset_id VARCHAR(80) NULL,
  look_do_dia_panel_version VARCHAR(40) NOT NULL DEFAULT 'SPOTLIGHT_CLASSICO',
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);

CREATE TABLE brand_profiles (
  id CHAR(36) PRIMARY KEY,
  owner_user_id CHAR(36) NOT NULL UNIQUE,
  brand_name VARCHAR(160) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  logo_url VARCHAR(1024) NULL,
  bio_ciphertext VARCHAR(2048) NULL,
  store_url VARCHAR(1024) NULL,
  approval_status VARCHAR(20) NOT NULL,
  source VARCHAR(30) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_brand_profiles_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE celebrity_profiles (
  id CHAR(36) PRIMARY KEY,
  owner_user_id CHAR(36) NOT NULL UNIQUE,
  stage_name VARCHAR(160) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  avatar_url VARCHAR(1024) NULL,
  bio_ciphertext VARCHAR(2048) NULL,
  verification_status VARCHAR(20) NOT NULL,
  seal_consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_celebrity_profiles_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE wardrobe_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  brand_profile_id CHAR(36) NULL,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  subcategory VARCHAR(120) NOT NULL,
  sex VARCHAR(40) NULL,
  brand_name VARCHAR(160) NULL,
  color VARCHAR(80) NOT NULL,
  material VARCHAR(80) NOT NULL,
  size_label VARCHAR(40) NULL,
  market VARCHAR(80) NULL,
  style_tags VARCHAR(512) NULL,
  occasion_tags VARCHAR(512) NULL,
  image_url VARCHAR(1024) NOT NULL,
  image_hash VARCHAR(128) NULL,
  price DECIMAL(10,2) NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_status VARCHAR(40) NOT NULL,
  moderation_confidence DECIMAL(5,4) NULL,
  photo_processing_status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  photo_quality_scores_json JSON NULL,
  processing_job_id CHAR(36) NULL,
  processing_time_ms INT NULL,
  flat_lay_metadata_json JSON NULL,
  hype_score DECIMAL(6,2) NULL,
  hype_score_global DECIMAL(6,2) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_wardrobe_items_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_wardrobe_items_brand_profile FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id)
);

CREATE INDEX idx_wardrobe_items_user_created ON wardrobe_items(user_id, created_at);

CREATE TABLE schemes (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  original_scheme_id CHAR(36) NULL,
  title VARCHAR(180) NOT NULL,
  description VARCHAR(2048) NULL,
  creation_mode VARCHAR(20) NOT NULL,
  style VARCHAR(160) NOT NULL,
  occasion VARCHAR(160) NOT NULL,
  visibility VARCHAR(20) NOT NULL,
  community_indexed BOOLEAN NOT NULL DEFAULT FALSE,
  cover_image_url VARCHAR(1024) NULL,
  background_art_url VARCHAR(1024) NULL,
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  share_count BIGINT NOT NULL DEFAULT 0,
  remix_count BIGINT NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NULL,
  seals VARCHAR(512) NULL,
  container_origin VARCHAR(20) NOT NULL DEFAULT 'INDEFINIDA',
  container_color VARCHAR(20) NULL,
  container_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  rendering_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  virtual_try_on_url VARCHAR(1024) NULL,
  rendering_job_id CHAR(36) NULL,
  rendering_quality_json JSON NULL,
  cached_until DATETIME(6) NULL,
  rendering_metadata_json JSON NULL,
  hype_score DECIMAL(6,2) NULL,
  hype_score_global DECIMAL(6,2) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_schemes_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_schemes_original FOREIGN KEY (original_scheme_id) REFERENCES schemes(id)
);

CREATE INDEX idx_schemes_user_created ON schemes(user_id, created_at);
CREATE INDEX idx_schemes_public ON schemes(visibility, community_indexed, created_at);

CREATE TABLE daily_looks (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  scheme_id CHAR(36) NOT NULL,
  materialized_from_id CHAR(36) NULL,
  look_date DATE NOT NULL,
  source VARCHAR(30) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_daily_looks_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_daily_looks_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id),
  CONSTRAINT fk_daily_looks_materialized_from FOREIGN KEY (materialized_from_id) REFERENCES daily_looks(id),
  CONSTRAINT uq_daily_looks_user_date UNIQUE (user_id, look_date)
);

CREATE INDEX idx_daily_looks_scheme_date ON daily_looks(scheme_id, look_date);

CREATE TABLE hype_score_metrics (
  id CHAR(36) PRIMARY KEY,
  daily_look_id CHAR(36) NOT NULL UNIQUE,
  scheme_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  score_date DATE NOT NULL,
  likes_count BIGINT NOT NULL DEFAULT 0,
  comments_count BIGINT NOT NULL DEFAULT 0,
  shares_count BIGINT NOT NULL DEFAULT 0,
  remixes_count BIGINT NOT NULL DEFAULT 0,
  engagement_raw DECIMAL(12,4) NULL,
  engagement_norm DECIMAL(6,2) NULL,
  trend_raw DECIMAL(12,6) NULL,
  trend_norm DECIMAL(6,2) NULL,
  hype_score DECIMAL(6,2) NULL,
  global_hype_score DECIMAL(6,2) NULL,
  weekly_top_percent DECIMAL(6,2) NULL,
  band VARCHAR(40) NULL,
  trendsetter_seal BOOLEAN NOT NULL DEFAULT FALSE,
  style_match_seal BOOLEAN NOT NULL DEFAULT FALSE,
  ai_suggestion VARCHAR(1024) NULL,
  breakdown_json JSON NULL,
  calibration_window_days INT NOT NULL DEFAULT 90,
  trend_window_days INT NOT NULL DEFAULT 30,
  weekly_window_days INT NOT NULL DEFAULT 7,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_hype_score_metrics_daily_look FOREIGN KEY (daily_look_id) REFERENCES daily_looks(id),
  CONSTRAINT fk_hype_score_metrics_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id),
  CONSTRAINT fk_hype_score_metrics_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_hype_score_metrics_scheme_date ON hype_score_metrics(scheme_id, score_date);
CREATE INDEX idx_hype_score_metrics_user_date ON hype_score_metrics(user_id, score_date);

CREATE TABLE scheme_items (
  id CHAR(36) PRIMARY KEY,
  scheme_id CHAR(36) NOT NULL,
  wardrobe_item_id CHAR(36) NOT NULL,
  slot VARCHAR(30) NOT NULL,
  sort_order INT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_scheme_items_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE,
  CONSTRAINT fk_scheme_items_wardrobe_item FOREIGN KEY (wardrobe_item_id) REFERENCES wardrobe_items(id)
);

CREATE INDEX idx_scheme_items_scheme ON scheme_items(scheme_id, sort_order);

CREATE TABLE scheme_brand_links (
  id CHAR(36) PRIMARY KEY,
  scheme_id CHAR(36) NOT NULL,
  brand_profile_id CHAR(36) NULL,
  celebrity_profile_id CHAR(36) NULL,
  requested_by_user_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL,
  tier VARCHAR(40) NOT NULL,
  confidence DECIMAL(5,4) NULL,
  reason VARCHAR(1024) NULL,
  decided_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_scheme_brand_links_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id),
  CONSTRAINT fk_scheme_brand_links_brand FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id),
  CONSTRAINT fk_scheme_brand_links_celebrity FOREIGN KEY (celebrity_profile_id) REFERENCES celebrity_profiles(id),
  CONSTRAINT fk_scheme_brand_links_requester FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_scheme_brand_links_status ON scheme_brand_links(status, created_at);

CREATE TABLE follows (
  id CHAR(36) PRIMARY KEY,
  follower_id CHAR(36) NOT NULL,
  following_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES users(id),
  CONSTRAINT fk_follows_following FOREIGN KEY (following_id) REFERENCES users(id),
  CONSTRAINT uq_follows_pair UNIQUE (follower_id, following_id)
);

CREATE TABLE comments (
  id CHAR(36) PRIMARY KEY,
  author_user_id CHAR(36) NOT NULL,
  scheme_id CHAR(36) NULL,
  wardrobe_item_id CHAR(36) NULL,
  content_ciphertext VARCHAR(2048) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_user_id) REFERENCES users(id),
  CONSTRAINT fk_comments_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id),
  CONSTRAINT fk_comments_wardrobe_item FOREIGN KEY (wardrobe_item_id) REFERENCES wardrobe_items(id)
);

CREATE INDEX idx_comments_scheme_created ON comments(scheme_id, created_at);

CREATE TABLE reactions (
  id CHAR(36) PRIMARY KEY,
  actor_user_id CHAR(36) NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id CHAR(36) NOT NULL,
  reaction_type VARCHAR(30) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_reactions_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
  CONSTRAINT uq_reactions_actor_target UNIQUE (actor_user_id, target_type, target_id, reaction_type)
);

CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  recipient_user_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  type VARCHAR(50) NOT NULL,
  resource_id CHAR(36) NULL,
  title VARCHAR(180) NOT NULL,
  body VARCHAR(500) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX idx_notifications_recipient_created ON notifications(recipient_user_id, created_at);

CREATE TABLE style_dna (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  archetype VARCHAR(80) NOT NULL,
  narrative_type VARCHAR(80) NOT NULL,
  identity_phrase_ciphertext VARCHAR(2048) NULL,
  color_palette VARCHAR(512) NULL,
  visibility VARCHAR(20) NOT NULL,
  card_image_url VARCHAR(1024) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_style_dna_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE photos (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  origin VARCHAR(40) NOT NULL,
  source_entity_id CHAR(36) NULL,
  storage_key VARCHAR(512) NOT NULL,
  public_url VARCHAR(1024) NULL,
  content_hash VARCHAR(128) NULL,
  metadata_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_photos_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_photos_user_origin_created ON photos(user_id, origin, created_at);

CREATE TABLE pipeline_jobs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL,
  provider VARCHAR(80) NULL,
  external_job_id VARCHAR(160) NULL,
  input_resource_id CHAR(36) NULL,
  output_url VARCHAR(1024) NULL,
  error_code VARCHAR(120) NULL,
  error_message VARCHAR(1024) NULL,
  attempts INT NOT NULL DEFAULT 0,
  started_at DATETIME(6) NULL,
  finished_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_pipeline_jobs_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_pipeline_jobs_user_status ON pipeline_jobs(user_id, status, created_at);

CREATE TABLE refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  family_id CHAR(36) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  rotated_from_id CHAR(36) NULL,
  created_ip VARCHAR(80) NULL,
  user_agent VARCHAR(512) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE audit_log (
  id CHAR(36) PRIMARY KEY,
  actor VARCHAR(160) NOT NULL,
  acao VARCHAR(120) NOT NULL,
  recurso VARCHAR(160) NOT NULL,
  resultado VARCHAR(80) NOT NULL,
  ip VARCHAR(80) NULL,
  user_agent VARCHAR(512) NULL,
  timestamp DATETIME(6) NOT NULL,
  correlation_id VARCHAR(120) NOT NULL,
  metadata_json JSON NULL
);

CREATE INDEX idx_audit_log_actor_timestamp ON audit_log(actor, timestamp);
CREATE INDEX idx_audit_log_correlation ON audit_log(correlation_id);
