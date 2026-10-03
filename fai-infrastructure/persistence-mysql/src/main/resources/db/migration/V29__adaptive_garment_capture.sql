-- RF4 · Adaptive Garment Capture + Garment Computer Vision (docs/visao-computacional/RF04_ADAPTIVE_GARMENT_CAPTURE.md §13).
-- Migration aditiva: nenhuma coluna existente muda. Toda tabela segue a base auditável (id CHAR(36), created/updated,
-- autor, version).

-- Sessão progressiva de captura: começa com UMA foto e só cresce quando uma vista complementar vale a pena.
CREATE TABLE capture_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  draft_job_id CHAR(36) NULL,
  category VARCHAR(80) NULL,
  subcategory VARCHAR(120) NULL,
  profile_id VARCHAR(40) NOT NULL,
  primary_view VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL,
  identify_model BOOLEAN NOT NULL DEFAULT FALSE,
  complementary_count INT NOT NULL DEFAULT 0,
  consecutive_skips INT NOT NULL DEFAULT 0,
  identification_json JSON NULL,
  decision_json JSON NULL,
  quality_json JSON NULL,
  piece_id CHAR(36) NULL,
  completed_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_capture_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_capture_sessions_user ON capture_sessions(user_id, created_at);
CREATE INDEX idx_capture_sessions_status ON capture_sessions(status, updated_at);
CREATE INDEX idx_capture_sessions_draft ON capture_sessions(draft_job_id);

-- Todo asset de imagem da peça. ORIGINAL nunca é sobrescrito; CANONICAL/DETAIL/… derivam dele (derived_from_id).
CREATE TABLE piece_images (
  id CHAR(36) PRIMARY KEY,
  session_id CHAR(36) NULL,
  piece_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  image_type VARCHAR(30) NOT NULL,
  view_type VARCHAR(30) NOT NULL,
  capture_role VARCHAR(20) NULL,
  capture_purpose VARCHAR(40) NULL,
  capture_source VARCHAR(20) NULL,
  storage_key VARCHAR(512) NOT NULL,
  url VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(40) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  orientation VARCHAR(12) NOT NULL,
  bytes_size BIGINT NULL,
  sha256 VARCHAR(64) NULL,
  quality_score INT NULL,
  blur_score DECIMAL(5,4) NULL,
  lighting_score DECIMAL(5,4) NULL,
  garment_coverage DECIMAL(5,4) NULL,
  detected_category VARCHAR(80) NULL,
  detected_subcategory VARCHAR(120) NULL,
  photography_spec VARCHAR(60) NULL,
  derived_from_id CHAR(36) NULL,
  processing_status VARCHAR(20) NOT NULL,
  model_version VARCHAR(120) NULL,
  analysis_json JSON NULL,
  superseded BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_piece_images_key UNIQUE (storage_key),
  CONSTRAINT fk_piece_images_session FOREIGN KEY (session_id) REFERENCES capture_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_piece_images_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_piece_images_session ON piece_images(session_id, image_type);
CREATE INDEX idx_piece_images_piece ON piece_images(piece_id, image_type, view_type);

-- Pedidos de foto complementar (vista + propósito), com a confiança antes/depois para medir o ganho realizado.
CREATE TABLE capture_requests (
  id CHAR(36) PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  view_type VARCHAR(30) NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  need VARCHAR(30) NOT NULL,
  reason_code VARCHAR(80) NOT NULL,
  dominant_signal VARCHAR(30) NULL,
  expected_gain DECIMAL(6,4) NOT NULL,
  status VARCHAR(20) NOT NULL,
  fulfilled_image_id CHAR(36) NULL,
  confidence_before DECIMAL(5,4) NULL,
  confidence_after DECIMAL(5,4) NULL,
  resolved_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_capture_requests_session FOREIGN KEY (session_id) REFERENCES capture_sessions(id) ON DELETE CASCADE
);
CREATE INDEX idx_capture_requests_session ON capture_requests(session_id, status);
CREATE INDEX idx_capture_requests_view ON capture_requests(view_type, status);

CREATE TABLE garment_landmarks (
  id CHAR(36) PRIMARY KEY,
  image_id CHAR(36) NOT NULL,
  name VARCHAR(60) NOT NULL,
  x DECIMAL(6,5) NOT NULL,
  y DECIMAL(6,5) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  model_version VARCHAR(120) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_garment_landmarks_image FOREIGN KEY (image_id) REFERENCES piece_images(id) ON DELETE CASCADE
);
CREATE INDEX idx_garment_landmarks_image ON garment_landmarks(image_id);

-- Saída do ensemble por nível (marca, linha, modelo…), com evidências e alternativas.
CREATE TABLE brand_predictions (
  id CHAR(36) PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  piece_id CHAR(36) NULL,
  pred_level VARCHAR(20) NOT NULL,
  pred_value VARCHAR(160) NULL,
  confidence DECIMAL(5,4) NOT NULL,
  evidence_json JSON NULL,
  alternatives_json JSON NULL,
  resolver_version VARCHAR(120) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_brand_predictions_session FOREIGN KEY (session_id) REFERENCES capture_sessions(id) ON DELETE CASCADE
);
CREATE INDEX idx_brand_predictions_session ON brand_predictions(session_id, pred_level);
CREATE INDEX idx_brand_predictions_piece ON brand_predictions(piece_id);

-- Model Registry: todo modelo (inclusive heurística local) tem nome, versão e status de deploy.
CREATE TABLE model_registry (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  model_version VARCHAR(40) NOT NULL,
  task VARCHAR(40) NOT NULL,
  provider VARCHAR(80) NOT NULL,
  dataset_version VARCHAR(80) NULL,
  training_date DATE NULL,
  evaluation_metrics_json JSON NULL,
  deployment_status VARCHAR(20) NOT NULL,
  artifact_uri VARCHAR(1024) NULL,
  notes VARCHAR(512) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_model_registry UNIQUE (name, model_version)
);

-- Qual modelo/versão produziu cada resultado de visão.
CREATE TABLE model_inferences (
  id CHAR(36) PRIMARY KEY,
  model_name VARCHAR(80) NOT NULL,
  model_version VARCHAR(40) NOT NULL,
  task VARCHAR(40) NOT NULL,
  session_id CHAR(36) NULL,
  image_id CHAR(36) NULL,
  latency_ms INT NULL,
  confidence DECIMAL(5,4) NULL,
  output_json JSON NULL,
  ai_inference_id CHAR(36) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_model_inferences_session FOREIGN KEY (session_id) REFERENCES capture_sessions(id) ON DELETE CASCADE
);
CREATE INDEX idx_model_inferences_model ON model_inferences(model_name, model_version, created_at);
CREATE INDEX idx_model_inferences_session ON model_inferences(session_id);

-- Revisão de IA: AI decision · user correction · admin decision · final value.
CREATE TABLE ai_review_items (
  id CHAR(36) PRIMARY KEY,
  kind VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  session_id CHAR(36) NULL,
  piece_id CHAR(36) NULL,
  image_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  field VARCHAR(40) NOT NULL,
  ai_value VARCHAR(160) NULL,
  ai_confidence DECIMAL(5,4) NULL,
  ai_model VARCHAR(120) NULL,
  user_value VARCHAR(160) NULL,
  admin_decision VARCHAR(20) NULL,
  admin_value VARCHAR(160) NULL,
  final_value VARCHAR(160) NULL,
  reviewer_id CHAR(36) NULL,
  reviewed_at DATETIME(6) NULL,
  add_to_training BOOLEAN NOT NULL DEFAULT FALSE,
  hard_example_tags VARCHAR(512) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_ai_review_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_ai_review_items_status ON ai_review_items(status, created_at);
CREATE INDEX idx_ai_review_items_piece ON ai_review_items(piece_id);

-- Proveniência e licença de cada fonte de dados de treinamento.
CREATE TABLE dataset_sources (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(160) NOT NULL,
  source_type VARCHAR(30) NOT NULL,
  license VARCHAR(160) NOT NULL,
  usage_permission VARCHAR(30) NOT NULL,
  commercial_use BOOLEAN NOT NULL DEFAULT FALSE,
  consent_required BOOLEAN NOT NULL DEFAULT FALSE,
  attribution VARCHAR(512) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_dataset_sources_code UNIQUE (code)
);

-- Active learning: FashionAI Garment Vision Dataset e FashionAI Hard Examples.
CREATE TABLE training_candidates (
  id CHAR(36) PRIMARY KEY,
  image_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  session_id CHAR(36) NULL,
  review_item_id CHAR(36) NULL,
  dataset VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL,
  hard_example_tags VARCHAR(512) NULL,
  annotations_json JSON NULL,
  annotation_version VARCHAR(40) NOT NULL,
  source_id CHAR(36) NOT NULL,
  license VARCHAR(160) NOT NULL,
  consent_granted_at DATETIME(6) NULL,
  exported_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_training_candidates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_training_candidates_source FOREIGN KEY (source_id) REFERENCES dataset_sources(id)
);
CREATE INDEX idx_training_candidates_dataset ON training_candidates(dataset, status);
CREATE INDEX idx_training_candidates_user ON training_candidates(user_id);

-- Base de conhecimento de produtos (evidência complementar, nunca prova).
CREATE TABLE kb_brand_signatures (
  id CHAR(36) PRIMARY KEY,
  brand_name VARCHAR(160) NOT NULL,
  brand_slug VARCHAR(160) NOT NULL,
  signal_type VARCHAR(30) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(512) NULL,
  typical_regions VARCHAR(255) NULL,
  categories VARCHAR(255) NULL,
  ocr_tokens VARCHAR(255) NULL,
  weight DECIMAL(4,3) NOT NULL DEFAULT 1.000,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);
CREATE INDEX idx_kb_brand_signatures_slug ON kb_brand_signatures(brand_slug);

CREATE TABLE kb_product_lines (
  id CHAR(36) PRIMARY KEY,
  brand_slug VARCHAR(160) NOT NULL,
  name VARCHAR(120) NOT NULL,
  categories VARCHAR(255) NULL,
  ocr_tokens VARCHAR(255) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);

CREATE TABLE kb_product_models (
  id CHAR(36) PRIMARY KEY,
  product_line_id CHAR(36) NULL,
  brand_slug VARCHAR(160) NOT NULL,
  name VARCHAR(120) NOT NULL,
  subcategory VARCHAR(120) NULL,
  ocr_tokens VARCHAR(255) NULL,
  code_pattern VARCHAR(255) NULL,
  known_colors VARCHAR(255) NULL,
  known_materials VARCHAR(255) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_kb_product_models_line FOREIGN KEY (product_line_id) REFERENCES kb_product_lines(id) ON DELETE SET NULL
);
CREATE INDEX idx_kb_product_models_brand ON kb_product_models(brand_slug);

-- Embeddings visuais por imagem e versão de modelo; só entram com consentimento de treinamento.
CREATE TABLE garment_embeddings (
  id CHAR(36) PRIMARY KEY,
  image_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  model_version VARCHAR(120) NOT NULL,
  dimensions INT NOT NULL,
  vector_json JSON NOT NULL,
  category VARCHAR(80) NULL,
  subcategory VARCHAR(120) NULL,
  brand VARCHAR(160) NULL,
  label_source VARCHAR(30) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_garment_embeddings UNIQUE (image_id, model_version),
  CONSTRAINT fk_garment_embeddings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_garment_embeddings_search ON garment_embeddings(model_version, category);

ALTER TABLE wardrobe_items ADD COLUMN canonical_image_url VARCHAR(1024) NULL AFTER studio_detail_url;
ALTER TABLE wardrobe_items ADD COLUMN capture_session_id CHAR(36) NULL AFTER canonical_image_url;

-- ───────────── sementes
INSERT INTO dataset_sources (id, code, name, source_type, license, usage_permission, commercial_use, consent_required, attribution, version, created_at, updated_at) VALUES
 ('7c1f0d3e-0001-4a00-9000-000000000001', 'fashionai-ugc-consented', 'Fotos de peças cadastradas com consentimento AI_MODEL_TRAINING', 'USER_CONSENTED', 'FASHIONAI-UGC-CONSENT-V1', 'TRAINING', TRUE, TRUE, NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0001-4a00-9000-000000000002', 'fashionai-internal', 'Fotografias produzidas internamente pela equipe FashionAI', 'INTERNAL', 'FASHIONAI-INTERNAL', 'TRAINING', TRUE, FALSE, NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0001-4a00-9000-000000000003', 'academic-research-only', 'Datasets acadêmicos de licença só para pesquisa (ex.: DeepFashion2)', 'ACADEMIC', 'RESEARCH-ONLY', 'EVALUATION_ONLY', FALSE, FALSE, 'Citar os autores do dataset', 0, NOW(6), NOW(6));

INSERT INTO model_registry (id, name, model_version, task, provider, dataset_version, training_date, evaluation_metrics_json, deployment_status, artifact_uri, notes, version, created_at, updated_at) VALUES
 ('7c1f0d3e-0002-4a00-9000-000000000001', 'garment-segmenter', '1.0.0', 'SEGMENTATION', 'rembg|removebg|local-floodfill', NULL, NULL, NULL, 'PRODUCTION', NULL, 'Pipeline Flat Lay existente', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000002', 'garment-detector', '1.0.0', 'DETECTION', 'local-alpha-components', NULL, NULL, NULL, 'PRODUCTION', NULL, 'Caixa do alfa do recorte + componentes', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000003', 'garment-classifier', '1.0.0', 'CLASSIFICATION', 'piece-analyzer-llm+silhouette', NULL, NULL, NULL, 'PRODUCTION', NULL, 'PIECE_ANALYZER (Gemini → Claude) + silhueta × referências', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000004', 'pants-landmarks', '1.0.0', 'LANDMARKS', 'local-geometric', NULL, NULL, NULL, 'PRODUCTION', NULL, 'Cós, gancho e barras pela máscara', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000005', 'upper-landmarks', '1.0.0', 'LANDMARKS', 'local-geometric', NULL, NULL, NULL, 'PRODUCTION', NULL, 'Decote, ombros, axilas, mangas e barra', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000006', 'footwear-landmarks', '1.0.0', 'LANDMARKS', 'local-geometric', NULL, NULL, NULL, 'PRODUCTION', NULL, 'Bico, calcanhar, sola e abertura', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000007', 'accessory-landmarks', '1.0.0', 'LANDMARKS', 'local-geometric', NULL, NULL, NULL, 'PRODUCTION', NULL, 'Alça, corpo, mostrador, lentes', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000008', 'logo-detector', '1.0.0', 'LOGO_DETECTION', 'vision-llm|local-logofinder', NULL, NULL, NULL, 'PRODUCTION', NULL, NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000009', 'ocr-ppocrv4', '4.0.0', 'OCR', 'onnx-local', 'PP-OCRv4', NULL, NULL, 'PRODUCTION', 'classpath:models/ocr', NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000010', 'label-parser', '1.0.0', 'TEXT_PARSING', 'local-rules', NULL, NULL, NULL, 'PRODUCTION', NULL, NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000011', 'brand-ensemble', '1.0.0', 'BRAND_RESOLUTION', 'local-noisy-or', NULL, NULL, NULL, 'PRODUCTION', NULL, NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000012', 'material-classifier', '1.0.0', 'MATERIAL', 'piece-analyzer-llm+label', NULL, NULL, NULL, 'PRODUCTION', NULL, NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000013', 'pattern-classifier', '1.0.0', 'PATTERN', 'local-autocorrelation', NULL, NULL, NULL, 'PRODUCTION', NULL, NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000014', 'garment-embedding', '1.0.0', 'EMBEDDING', 'local-descriptor', NULL, NULL, NULL, 'PRODUCTION', NULL, '96 dimensões, L2', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000015', 'photography-quality-gate', '1.0.0', 'QUALITY', 'local-rules', NULL, NULL, NULL, 'PRODUCTION', NULL, NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000016', 'adaptive-capture', '1.0.0', 'CAPTURE_POLICY', 'local-expected-gain', NULL, NULL, NULL, 'PRODUCTION', NULL, 'CAPTURE_PROFILES_V1', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0002-4a00-9000-000000000017', 'canonical-photographer', '1.0.0', 'CANONICAL', 'local-deterministic', NULL, NULL, NULL, 'PRODUCTION', NULL, 'Sem geração; specs *_V1', 0, NOW(6), NOW(6));

-- Conhecimento público de trade dress (texto, sem imagens de terceiros).
INSERT INTO kb_brand_signatures (id, brand_name, brand_slug, signal_type, name, description, typical_regions, categories, ocr_tokens, weight, version, created_at, updated_at) VALUES
 ('7c1f0d3e-0003-4a00-9000-000000000001', 'Lacoste', 'lacoste', 'LOGO', 'crocodile', 'Crocodilo bordado', 'chest_left', 'upper_piece,shoes_piece,accessory_piece', 'LACOSTE', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000002', 'Nike', 'nike', 'SIDE_LOGO', 'swoosh', 'Swoosh na lateral do calçado e no peito', 'side_panel,chest_left', 'upper_piece,lower_piece,shoes_piece,accessory_piece', 'NIKE', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000003', 'Nike', 'nike', 'TONGUE_LABEL', 'tongue_label', 'Etiqueta da língua com modelo e código de estilo', 'tongue', 'shoes_piece', 'NIKE,AIR', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000004', 'Adidas', 'adidas', 'SIGNATURE_PATTERN', 'three_stripes', 'Três listras paralelas', 'side_panel,sleeve,leg_side', 'upper_piece,lower_piece,shoes_piece', 'ADIDAS', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000005', 'Adidas', 'adidas', 'LOGO', 'trefoil', 'Trefoil (Originals) e Performance logo', 'chest,tongue', 'upper_piece,shoes_piece', 'ADIDAS,ORIGINALS', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000006', 'Levi''s', 'levis', 'PATCH', 'two_horse_patch', 'Patch de dois cavalos no cós traseiro', 'back_waistband_patch', 'lower_piece', 'LEVI,LEVIS,LEVI STRAUSS', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000007', 'Levi''s', 'levis', 'LABEL', 'red_tab', 'Red Tab no bolso traseiro direito', 'back_pockets', 'lower_piece,upper_piece', 'LEVI''S', 0.9, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000008', 'Levi''s', 'levis', 'SIGNATURE_PATTERN', 'arcuate_stitching', 'Costura arqueada dos bolsos traseiros', 'back_pockets', 'lower_piece', NULL, 0.7, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000009', 'Tissot', 'tissot', 'ENGRAVING', 'caseback_reference', 'Referência T###.###.##.###.## no verso', 'caseback', 'accessory_piece', 'TISSOT,SWISS', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000010', 'Ray-Ban', 'ray-ban', 'TEMPLE_MARKING', 'temple_code', 'Modelo RB#### e medidas na haste', 'temple_inside,lens', 'accessory_piece', 'RAY-BAN,RAYBAN,RB', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000011', 'Christian Louboutin', 'christian-louboutin', 'SOLE_PATTERN', 'red_sole', 'Sola vermelha laqueada', 'outsole', 'shoes_piece', 'LOUBOUTIN', 0.9, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000012', 'Vans', 'vans', 'SIDE_LOGO', 'sidestripe', 'Jazz stripe lateral e sola waffle', 'side_panel,outsole', 'shoes_piece', 'VANS,OFF THE WALL', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000013', 'Dr. Martens', 'dr-martens', 'SIGNATURE_PATTERN', 'yellow_welt_stitch', 'Costura amarela do solado e alça do calcanhar', 'outsole,heel', 'shoes_piece', 'DR. MARTENS,AIRWAIR', 0.9, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000014', 'Ralph Lauren', 'ralph-lauren', 'LOGO', 'polo_player', 'Jogador de polo bordado', 'chest_left', 'upper_piece', 'RALPH LAUREN,POLO', 1.0, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0003-4a00-9000-000000000015', 'Izod', 'izod', 'LOGO', 'crocodile_lookalike', 'Logo historicamente parecido com o da Lacoste', 'chest_left', 'upper_piece', 'IZOD', 0.6, 0, NOW(6), NOW(6));

INSERT INTO kb_product_lines (id, brand_slug, name, categories, ocr_tokens, version, created_at, updated_at) VALUES
 ('7c1f0d3e-0004-4a00-9000-000000000001', 'nike', 'Air Max', 'shoes_piece', 'AIR MAX', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0004-4a00-9000-000000000002', 'nike', 'Air Force', 'shoes_piece', 'AIR FORCE,AF1', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0004-4a00-9000-000000000003', 'adidas', 'Originals', 'shoes_piece,upper_piece', 'ORIGINALS', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0004-4a00-9000-000000000004', 'levis', '500 Series', 'lower_piece', '501,505,511,512,514,550', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0004-4a00-9000-000000000005', 'tissot', 'T-Classic', 'accessory_piece', 'PRX,T-CLASSIC', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0004-4a00-9000-000000000006', 'ray-ban', 'Icons', 'accessory_piece', 'WAYFARER,AVIATOR', 0, NOW(6), NOW(6));

INSERT INTO kb_product_models (id, product_line_id, brand_slug, name, subcategory, ocr_tokens, code_pattern, known_colors, known_materials, version, created_at, updated_at) VALUES
 ('7c1f0d3e-0005-4a00-9000-000000000001', '7c1f0d3e-0004-4a00-9000-000000000001', 'nike', 'Air Max 90', 'casual_sneakers', 'AIR MAX 90,AM90', NULL, 'white,black,gray', 'LEATHER,SYNTHETIC', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0005-4a00-9000-000000000002', '7c1f0d3e-0004-4a00-9000-000000000002', 'nike', 'Air Force 1', 'casual_sneakers', 'AIR FORCE 1,AF1', NULL, 'white,black', 'LEATHER', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0005-4a00-9000-000000000003', '7c1f0d3e-0004-4a00-9000-000000000003', 'adidas', 'Superstar', 'casual_sneakers', 'SUPERSTAR', NULL, 'white,black', 'LEATHER', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0005-4a00-9000-000000000004', '7c1f0d3e-0004-4a00-9000-000000000003', 'adidas', 'Stan Smith', 'casual_sneakers', 'STAN SMITH', NULL, 'white,green', 'LEATHER', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0005-4a00-9000-000000000005', '7c1f0d3e-0004-4a00-9000-000000000004', 'levis', '501 Original', 'jeans', '501', NULL, 'blue,black', 'COTTON', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0005-4a00-9000-000000000006', '7c1f0d3e-0004-4a00-9000-000000000004', 'levis', '511 Slim', 'jeans', '511', NULL, 'blue,black', 'COTTON,BLEND', 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0005-4a00-9000-000000000007', '7c1f0d3e-0004-4a00-9000-000000000005', 'tissot', 'PRX', 'watch', 'PRX', 'T137\\.', 'silver,blue', NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0005-4a00-9000-000000000008', '7c1f0d3e-0004-4a00-9000-000000000006', 'ray-ban', 'Wayfarer', 'sunglasses', 'WAYFARER', 'RB\\s?2140', 'black', NULL, 0, NOW(6), NOW(6)),
 ('7c1f0d3e-0005-4a00-9000-000000000009', '7c1f0d3e-0004-4a00-9000-000000000006', 'ray-ban', 'Aviator', 'sunglasses', 'AVIATOR', 'RB\\s?3025', 'gold,silver', NULL, 0, NOW(6), NOW(6));
