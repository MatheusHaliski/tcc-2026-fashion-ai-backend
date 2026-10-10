-- AVATAR-ID I1 (docs/avatar3d/auditoria-identidade-avatar, seções 4 e 22): a identidade do avatar passa a ter versões.
-- Refazer o avatar cria uma versão nova; a aprovada não é apagada e continua sendo a que outras pessoas veem.
-- user_avatars_3d continua sendo a versão ATUAL (compatível com o app e com as vitrines).
CREATE TABLE avatar_identity_versions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  identity_id CHAR(36) NOT NULL,                  -- estável entre versões
  version_no INT NOT NULL,
  status VARCHAR(20) NOT NULL,                    -- DRAFT | NEEDS_REFINEMENT | APPROVED
  based_on INT NULL,                              -- versão de origem (reconstrução ou restauração)
  model_version INT NOT NULL,
  model_json JSON NOT NULL,
  adjust_json JSON NULL,
  texture_key VARCHAR(512) NOT NULL,              -- atlas do rosto (restricted/...), um por versão
  photos_count INT NOT NULL DEFAULT 1,
  warnings_json JSON NULL,
  quality_json JSON NULL,                         -- relatório do gate: números agregados e nomes das métricas
  texture_moderation VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  approved_at DATETIME(6) NULL,
  approved_with_warnings BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_identity_version UNIQUE (user_id, version_no),
  -- dado de quem é dono (biométrico): some com a conta (política da V34)
  CONSTRAINT fk_identity_version_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE user_avatars_3d
  ADD COLUMN identity_id CHAR(36) NULL,
  ADD COLUMN current_version INT NOT NULL DEFAULT 1,
  ADD COLUMN approved_version INT NULL,
  ADD COLUMN identity_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN quality_json JSON NULL;

-- os avatares que já existem foram confirmados pela pessoa: viram a versão 1, aprovada
UPDATE user_avatars_3d SET identity_id = UUID(), current_version = 1, approved_version = 1, identity_status = 'APPROVED';

INSERT INTO avatar_identity_versions (id, user_id, identity_id, version_no, status, based_on, model_version, model_json,
                                      adjust_json, texture_key, photos_count, warnings_json, quality_json,
                                      texture_moderation, approved_at, approved_with_warnings, created_at, updated_at,
                                      created_by, last_modified_by, version)
SELECT UUID(), a.user_id, a.identity_id, 1, 'APPROVED', NULL, a.model_version, a.model_json, a.adjust_json,
       a.texture_key, a.photos_count, a.warnings_json, NULL, a.texture_moderation, a.consent_at, FALSE, a.created_at,
       a.updated_at, a.created_by, a.last_modified_by, 0
FROM user_avatars_3d a;
