-- MP-2 (docs/multiplataforma): provador sincronizado entre plataformas e assets 3D de roupa que vestem o avatar.

-- O que está no provador agora, um por conta. revision é a pré-condição (If-Match) para gravar de qualquer plataforma.
-- Não guarda título nem cria look: experimentar não é salvar.
CREATE TABLE try_on_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  top_piece_id CHAR(36) NULL,
  bottom_piece_id CHAR(36) NULL,
  shoes_piece_id CHAR(36) NULL,
  accessory_piece_id CHAR(36) NULL,
  avatar_identity_id CHAR(36) NULL,
  avatar_version INT NULL,
  revision BIGINT NOT NULL DEFAULT 0,
  updated_platform VARCHAR(20) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_try_on_session_user UNIQUE (user_id),
  CONSTRAINT fk_try_on_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Asset 3D de roupa com esqueleto do avatar, níveis de detalhe por perfil e métricas de vestir. Só APPROVED veste;
-- sem ele a peça aparece como prévia 2D identificada. Peça apagada leva os assets próprios junto.
CREATE TABLE garment_assets_3d (
  id CHAR(36) PRIMARY KEY,
  piece_id CHAR(36) NULL,
  catalog_product_id CHAR(36) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  rig_standard VARCHAR(40) NOT NULL,
  source VARCHAR(20) NOT NULL,
  logo_authorization VARCHAR(20) NOT NULL DEFAULT 'NONE',
  logo_authorization_ref VARCHAR(200) NULL,
  metrics_json JSON NULL,
  renditions_json JSON NULL,
  review_notes VARCHAR(1000) NULL,
  approved_at DATETIME(6) NULL,
  approved_by VARCHAR(80) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT ck_garment_asset_owner CHECK (piece_id IS NOT NULL OR catalog_product_id IS NOT NULL),
  CONSTRAINT fk_garment_asset_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  INDEX ix_garment_asset_piece (piece_id, status),
  INDEX ix_garment_asset_catalog (catalog_product_id, status)
);
