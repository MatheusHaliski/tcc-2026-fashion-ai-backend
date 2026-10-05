-- RF54 · FashionAI Lens (docs/novos-rf/RF54_FashionAI_Lens.md §5.2). A pessoa aponta a câmera ou envia uma foto de
-- moda; o Lens lê as peças (detecção multipeça + cor, padrão e embedding do recorte) e liga cada uma ao guarda-roupa,
-- ao DNA de estilo, ao Hype do grupo e ao Copilot.
--
-- Camada estável (gravada uma vez): lens_scans + lens_detections + lens_feedback.
-- Camada viva (correspondências no guarda-roupa/comunidade, compatibilidade, Hype do grupo, plano "Recriar"): calculada
-- na leitura, nunca gravada — sempre reflete o guarda-roupa, o DNA e o Hype de agora. Por isso não há lens_matches.
--
-- Privacidade: scan sempre privado (só o dono lê; terceiros recebem 404), imagem em chave restricted/ sem EXIF/GPS,
-- nunca entra em ranking, Hype (hype_signal_daily) nem estatística pública. Sem salvar como inspiração, o job diário
-- apaga imagem e linhas em expires_at (30 dias). Excluir a conta apaga os scans (AccountService).

CREATE TABLE lens_scans (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  source VARCHAR(20) NOT NULL,                    -- CAMERA, GALLERY, UPLOAD, IN_APP_PIECE, IN_APP_LOOK
  source_ref_id CHAR(36) NULL,                    -- peça ou look do app analisado (origem IN_APP_*)
  intent VARCHAR(20) NOT NULL,                    -- IDENTIFY, RECREATE
  status VARCHAR(20) NOT NULL,                    -- READY, PARTIAL, NO_FASHION_FOUND, FAILED
  error_code VARCHAR(40) NULL,                    -- NO_FASHION_FOUND, CONSENT_REQUIRED, QUOTA, FAILED
  image_key VARCHAR(512) NULL,                    -- restricted/users/{id}/lens/{scanId}.jpg (já sem metadados)
  thumb_key VARCHAR(512) NULL,
  width INT NOT NULL DEFAULT 0,
  height INT NOT NULL DEFAULT 0,
  faces_redacted INT NOT NULL DEFAULT 0,          -- rostos borrados no aparelho antes do envio
  redaction_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ai_source VARCHAR(10) NOT NULL,                 -- ia | local (leitura degradada, a UI avisa)
  model_version VARCHAR(160) NOT NULL,
  algorithm_version VARCHAR(20) NOT NULL,         -- LENS_V1
  ai_inference_id CHAR(36) NULL,                  -- ai_inference_log da detecção (custo por scan, sem imagem)
  saved_at DATETIME(6) NULL,                      -- salvo como inspiração: não expira
  expires_at DATETIME(6) NULL,                    -- não salvo: created_at + 30 dias
  processed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_lens_scans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_lens_scans_user ON lens_scans(user_id, created_at);
CREATE INDEX idx_lens_scans_saved ON lens_scans(user_id, saved_at);
CREATE INDEX idx_lens_scans_expiry ON lens_scans(saved_at, expires_at);

CREATE TABLE lens_detections (
  id CHAR(36) PRIMARY KEY,
  scan_id CHAR(36) NOT NULL,
  ordinal INT NOT NULL,                           -- ordem de leitura (de cima para baixo)
  box_json JSON NOT NULL,                         -- {x, y, w, h} em % da imagem (mesmo formato do DetectedPiece.box)
  label VARCHAR(120) NULL,
  category VARCHAR(40) NULL,                      -- taxonomia oficial; fora dela fica nulo
  subcategory VARCHAR(60) NULL,
  material VARCHAR(20) NULL,
  sex VARCHAR(12) NULL,
  colors_json JSON NULL,                          -- [{name, hex, share}], cor principal primeiro
  pattern VARCHAR(20) NULL,                       -- solid, striped, checked, printed
  style_tags VARCHAR(255) NULL,                   -- máx. 2 (regra da taxonomia)
  occasion_tags VARCHAR(255) NULL,
  confidence DECIMAL(4,3) NULL,                   -- 0–1; faixa alta ≥ 0,75, média ≥ 0,5, baixa abaixo
  attribute_confidence_json JSON NULL,
  embedding_json JSON NULL,                       -- GarmentEmbedder (96) do recorte
  embedding_model VARCHAR(120) NULL,
  status VARCHAR(20) NOT NULL,                    -- DETECTED, CORRECTED, ADDED_BY_USER
  dismissed_at DATETIME(6) NULL,                  -- "não é roupa" (some do scan; desfazer limpa)
  wanted_at DATETIME(6) NULL,                     -- "Quero"
  owned_item_id CHAR(36) NULL,                    -- "Eu tenho": peça do guarda-roupa da pessoa
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_lens_detections_scan FOREIGN KEY (scan_id) REFERENCES lens_scans(id) ON DELETE CASCADE,
  CONSTRAINT fk_lens_detections_item FOREIGN KEY (owned_item_id) REFERENCES wardrobe_items(id) ON DELETE SET NULL
);
CREATE INDEX idx_lens_detections_scan ON lens_detections(scan_id, ordinal);

CREATE TABLE lens_feedback (
  id CHAR(36) PRIMARY KEY,
  scan_id CHAR(36) NOT NULL,
  detection_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  kind VARCHAR(30) NOT NULL,                      -- WRONG_CATEGORY, WRONG_COLOR, WRONG_ATTRIBUTE, NOT_CLOTHING, MISSING_PIECE…
  before_json JSON NULL,                          -- o que a leitura disse
  after_json JSON NULL,                           -- o que a pessoa corrigiu
  training_consent BOOLEAN NOT NULL DEFAULT FALSE, -- só entra na avaliação com AI_MODEL_TRAINING concedido
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_lens_feedback_scan FOREIGN KEY (scan_id) REFERENCES lens_scans(id) ON DELETE CASCADE,
  CONSTRAINT fk_lens_feedback_detection FOREIGN KEY (detection_id) REFERENCES lens_detections(id) ON DELETE CASCADE,
  CONSTRAINT fk_lens_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_lens_feedback_scan ON lens_feedback(scan_id);
CREATE INDEX idx_lens_feedback_detection ON lens_feedback(detection_id);
