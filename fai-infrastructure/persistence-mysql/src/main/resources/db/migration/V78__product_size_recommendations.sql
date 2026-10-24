-- Adult jeans / T-shirts pilot. No fabricated charts or measurements are inserted.
CREATE TABLE product_size_charts (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  chart_json JSON NOT NULL,
  reviewer_id CHAR(36) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_product_size_chart UNIQUE(product_id),
  CONSTRAINT fk_size_chart_product FOREIGN KEY(product_id) REFERENCES catalog_products(id) ON DELETE CASCADE,
  CONSTRAINT fk_size_chart_reviewer FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE TABLE fit_measurement_profiles (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  measurements_encrypted TEXT NOT NULL,
  measured_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_fit_profile_owner UNIQUE(owner_id),
  CONSTRAINT fk_fit_profile_owner FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE size_recommendations (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  chart_revision INT NULL,
  profile_version BIGINT NULL,
  request_key VARCHAR(80) NOT NULL,
  result_json JSON NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_fit_recommendation_request UNIQUE(owner_id, request_key),
  INDEX ix_fit_recommendation_owner(owner_id, created_at),
  INDEX ix_fit_recommendation_history(owner_id, product_id, chart_revision),
  CONSTRAINT fk_fit_recommendation_owner FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fit_recommendation_product FOREIGN KEY(product_id) REFERENCES catalog_products(id) ON DELETE CASCADE
);
CREATE TABLE fit_feedback (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  recommendation_id CHAR(36) NOT NULL,
  experience_key VARCHAR(80) NOT NULL,
  feedback_json JSON NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_fit_feedback_experience UNIQUE(recommendation_id, owner_id, experience_key),
  INDEX ix_fit_feedback_owner(owner_id),
  CONSTRAINT fk_fit_feedback_owner FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fit_feedback_recommendation FOREIGN KEY(recommendation_id) REFERENCES size_recommendations(id) ON DELETE CASCADE
);
