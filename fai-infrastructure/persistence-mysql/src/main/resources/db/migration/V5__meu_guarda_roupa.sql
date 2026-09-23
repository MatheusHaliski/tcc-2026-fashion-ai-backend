-- V5 — Meu Guarda-Roupa (docs/meu_guarda_roupa): RF32 Meu Quarto, RF33 Smart Mirror/Vista-me, RF34 Destaques
-- (Inventory Score, rankings, conquistas), RF35 FAI Points e loja do quarto, RF36 Desafios & Games, RF10 estendido.

ALTER TABLE wardrobe_items ADD COLUMN piece_origin VARCHAR(20) NULL;            -- DET-M07
ALTER TABLE user_preferences ADD COLUMN purchase_suggestions_enabled BOOLEAN NOT NULL DEFAULT TRUE; -- RF10 §3.3
ALTER TABLE user_preferences ADD COLUMN sound_enabled BOOLEAN NOT NULL DEFAULT FALSE;              -- DET-D04 / ETI-06
ALTER TABLE user_preferences ADD COLUMN haptics_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN life_identity_in_ai BOOLEAN NOT NULL DEFAULT FALSE;         -- RF10.CA16
ALTER TABLE style_dna ADD COLUMN color_season VARCHAR(20) NULL;                                   -- DET-M05

CREATE TABLE room_layouts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  level VARCHAR(20) NOT NULL DEFAULT 'ESTREIA',
  modules_json JSON NULL,
  drawer_labels_json JSON NULL,
  previous_map_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_room_layouts_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE room_storage_map (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  wardrobe_item_id CHAR(36) NOT NULL UNIQUE,
  address VARCHAR(40) NOT NULL,
  assigned_by VARCHAR(10) NOT NULL DEFAULT 'AUTO',
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_room_map_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_room_map_item FOREIGN KEY (wardrobe_item_id) REFERENCES wardrobe_items(id)
);
CREATE INDEX idx_room_map_user ON room_storage_map(user_id, address);

CREATE TABLE mirror_states (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  slots_json JSON NULL,
  shown_combinations_json JSON NULL,
  last_prompt VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_mirror_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE room_catalog (
  sku VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  mold_id VARCHAR(40) NOT NULL,
  slot_type VARCHAR(30) NOT NULL,
  width_cm INT NOT NULL,
  finish_json JSON NULL,
  rarity VARCHAR(20) NOT NULL,
  price_points INT NOT NULL,
  required_level VARCHAR(20) NOT NULL,
  stock_limit INT NULL,
  sold_count INT NOT NULL DEFAULT 0,
  maison_brand_user_id CHAR(36) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE room_inventory (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  sku VARCHAR(40) NOT NULL,
  serial INT NULL,
  source VARCHAR(20) NOT NULL,
  applied_module VARCHAR(40) NULL,
  acquired_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_room_inventory_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_room_inventory_sku FOREIGN KEY (sku) REFERENCES room_catalog(sku)
);

CREATE TABLE fai_points_rules (
  action_code VARCHAR(40) PRIMARY KEY,
  points INT NOT NULL,
  daily_cap INT NULL,
  weekly_cap INT NULL,
  once_per_ref BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  description VARCHAR(200) NULL
);

CREATE TABLE fai_points_ledger (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  delta INT NOT NULL,
  action_code VARCHAR(40) NOT NULL,
  ref_type VARCHAR(30) NULL,
  ref_id VARCHAR(64) NULL,
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  counts_lifetime BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_points_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_points_user ON fai_points_ledger(user_id, created_at);
CREATE INDEX idx_points_action ON fai_points_ledger(user_id, action_code, created_at);

CREATE TABLE inventory_score_snapshots (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  period_type VARCHAR(10) NOT NULL,
  period_date DATE NOT NULL,
  score INT NULL,
  dimensions_json JSON NULL,
  metrics_json JSON NULL,
  eligible BOOLEAN NOT NULL,
  computed_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_inv_snap_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_inv_snap UNIQUE (user_id, period_type, period_date)
);

CREATE TABLE wardrobe_availability_log (
  id CHAR(36) PRIMARY KEY,
  wardrobe_item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  available BOOLEAN NOT NULL,
  changed_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_avail_item FOREIGN KEY (wardrobe_item_id) REFERENCES wardrobe_items(id)
);
CREATE INDEX idx_avail_item ON wardrobe_availability_log(wardrobe_item_id, changed_at);

CREATE TABLE user_achievements (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  achievement_code VARCHAR(40) NOT NULL,
  secret BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_ach_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_ach UNIQUE (user_id, achievement_code)
);

CREATE TABLE ranking_opt_ins (
  user_id CHAR(36) PRIMARY KEY,
  opted_in BOOLEAN NOT NULL DEFAULT FALSE,
  share_city BOOLEAN NOT NULL DEFAULT FALSE,
  city VARCHAR(80) NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_opt_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE ranking_positions (
  id CHAR(36) PRIMARY KEY,
  segment VARCHAR(80) NOT NULL,
  user_id CHAR(36) NOT NULL,
  position INT NOT NULL,
  total INT NOT NULL,
  top_percent DECIMAL(6,2) NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  computed_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_rank UNIQUE (segment, user_id)
);

CREATE TABLE piece_usage_diary (
  id CHAR(36) PRIMARY KEY,
  wardrobe_item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  used_on DATE NOT NULL,
  occasion VARCHAR(40) NULL,
  note VARCHAR(160) NULL,
  source VARCHAR(20) NOT NULL,
  scheme_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_diary_item FOREIGN KEY (wardrobe_item_id) REFERENCES wardrobe_items(id),
  CONSTRAINT uq_diary_day UNIQUE (wardrobe_item_id, used_on)
);

CREATE TABLE challenge_templates (
  code VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  rule_text VARCHAR(300) NOT NULL,
  rule_blocks_json JSON NULL,
  modes_allowed_json JSON NOT NULL,
  duration_days INT NULL,
  score_dimensions_json JSON NULL,
  reward_points INT NOT NULL DEFAULT 0,
  effort VARCHAR(10) NOT NULL DEFAULT 'MEDIO',
  min_participants INT NOT NULL DEFAULT 1,
  max_participants INT NOT NULL DEFAULT 1,
  origin VARCHAR(20) NOT NULL DEFAULT 'OFFICIAL',
  author_user_id CHAR(36) NULL,
  room_decoration VARCHAR(60) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE challenge_instances (
  id CHAR(36) PRIMARY KEY,
  template_code VARCHAR(40) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  state VARCHAR(20) NOT NULL,
  params_json JSON NULL,
  starts_at DATETIME(6) NULL,
  ends_at DATETIME(6) NULL,
  accept_deadline DATETIME(6) NULL,
  created_by CHAR(36) NOT NULL,
  result_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by_label VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT fk_ch_inst_tpl FOREIGN KEY (template_code) REFERENCES challenge_templates(code)
);
CREATE INDEX idx_ch_inst_state ON challenge_instances(state, ends_at);

CREATE TABLE challenge_participants (
  id CHAR(36) PRIMARY KEY,
  instance_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  team VARCHAR(2) NULL,
  status VARCHAR(20) NOT NULL,
  joined_at DATETIME(6) NULL,
  left_at DATETIME(6) NULL,
  personal_goal_json JSON NULL,
  progress_fraction DECIMAL(6,4) NOT NULL DEFAULT 0,
  best_record INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_ch_part_inst FOREIGN KEY (instance_id) REFERENCES challenge_instances(id),
  CONSTRAINT uq_ch_part UNIQUE (instance_id, user_id)
);
CREATE INDEX idx_ch_part_user ON challenge_participants(user_id, status);

CREATE TABLE challenge_events (
  id CHAR(36) PRIMARY KEY,
  instance_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  evidence_type VARCHAR(30) NOT NULL,
  ref_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_ch_evt_inst FOREIGN KEY (instance_id) REFERENCES challenge_instances(id),
  CONSTRAINT uq_ch_evt UNIQUE (instance_id, user_id, evidence_type, ref_id)
);

CREATE TABLE challenge_votes (
  id CHAR(36) PRIMARY KEY,
  instance_id CHAR(36) NOT NULL,
  voter_user_id CHAR(36) NOT NULL,
  entry_scheme_id CHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_ch_vote_inst FOREIGN KEY (instance_id) REFERENCES challenge_instances(id),
  CONSTRAINT uq_ch_vote UNIQUE (instance_id, voter_user_id, entry_scheme_id)
);

CREATE TABLE challenge_notes (
  id CHAR(36) PRIMARY KEY,
  instance_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  kind VARCHAR(10) NOT NULL,
  content VARCHAR(80) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_ch_note_inst FOREIGN KEY (instance_id) REFERENCES challenge_instances(id)
);

-- catálogo inicial (03-desafios-e-games.md §2)
INSERT INTO challenge_templates (code, name, rule_text, modes_allowed_json, duration_days, score_dimensions_json, reward_points, effort, min_participants, max_participants, room_decoration) VALUES
('TEN_X_TEN','10×10','Escolher 10 peças e montar 10 looks em 10 dias só com elas','["SOLO","EQUIPE"]',10,'["V","R"]',300,'MEDIO',1,6,'quadro_cortica'),
('CAPSULE_SEASON','Temporada Cápsula','Viver 3 meses com 33 peças (o resto vai para o maleiro)','["SOLO","EQUIPE"]',90,'["U","V"]',500,'ALTO',1,6,'fita_alfaiate'),
('SECOND_CHANCE','Segunda Chance','Resgatar 30% das peças esquecidas','["SOLO","EQUIPE"]',14,'["R","U"]',250,'MEDIO',1,6,'etiqueta_2a_chance'),
('NO_REPEAT','Sem Repetir','Dias seguidos com Look do Dia sem repetir composição','["SOLO","DUELO"]',NULL,'["R"]',200,'MEDIO',1,8,'calendario_parede'),
('WEAR_WHAT_YOU_HAVE','Semana Vista o que Você Tem','Uma semana só com o que já está no acervo, sem cadastrar compras novas','["SOLO","EQUIPE","COMUNIDADE"]',7,'["U"]',150,'BAIXO',1,6,NULL),
('CHANEL_WEEK','Semana Chanel','Todo dia, aplicar "Tira uma coisa" no look','["SOLO","EQUIPE"]',7,'["I"]',150,'BAIXO',1,6,NULL),
('MY_SEASON','Minha Estação','Looks só com peças da cartela da coloração pessoal','["SOLO","DUELO"]',7,'["I"]',150,'MEDIO',1,8,NULL),
('RUNWAY_BATTLE','Batalha na Passarela','Tema semanal, look só com peças do próprio acervo, votação às cegas','["EQUIPE","DUELO"]',7,'["V"]',200,'MEDIO',2,8,'tema_espelho'),
('DAILY_CHALLENGE','Desafio do Dia','Uma regra igual para todos, resultado em grade de emoji','["COMUNIDADE"]',1,'["R"]',30,'BAIXO',1,1,NULL),
('GRWM','Arrume-se Comigo','Publicar o vídeo do Vista-me de um look do desafio ativo','["SOLO","EQUIPE","DUELO"]',7,'[]',80,'BAIXO',1,8,NULL),
('REAL_MIRROR','Espelho de Verdade','Registrar o look real no espelho do app na janela aleatória do dia','["SOLO","EQUIPE"]',7,'["U"]',120,'BAIXO',1,6,NULL);

-- regras de ganho de FAI Points (01-especificacao-meu-quarto.md §5.2)
INSERT INTO fai_points_rules (action_code, points, daily_cap, weekly_cap, once_per_ref, description) VALUES
('PIECE_CATALOGED',25,10,NULL,TRUE,'Cadastrar peça que passa no catalog_readiness_score'),
('PIECE_COMPLETED',10,NULL,NULL,TRUE,'Completar os dados de uma peça (completude >= 90%)'),
('PIECE_3D',15,NULL,NULL,TRUE,'Gerar o modelo 3D da peça (RF16)'),
('SCHEME_CREATED',40,5,NULL,TRUE,'Criar esquema'),
('FORGOTTEN_RESCUED',30,3,NULL,TRUE,'Resgatar peça esquecida (usar num look)'),
('VISTA_ME_DAILY_LOOK',15,1,NULL,TRUE,'Usar um look do Vista-me como Look do Dia'),
('ROOM_ORGANIZED',20,NULL,1,FALSE,'Organizar o quarto (aplicar organização, nomear gavetas)'),
('ACHIEVEMENT',0,NULL,NULL,TRUE,'Conquistas (+100 a +500, 1x cada)'),
('LIKE_RECEIVED',1,50,NULL,TRUE,'Curtida recebida'),
('COMMENT_RECEIVED',2,50,NULL,TRUE,'Comentário recebido'),
('REMIX_RECEIVED',10,50,NULL,TRUE,'Remix recebido'),
('CHALLENGE_COMPLETED',0,NULL,NULL,TRUE,'Recompensa de desafio concluído (RF36.CA12)'),
('SHOP_PURCHASE',0,NULL,NULL,TRUE,'Compra na loja do quarto (debita saldo, não vitalício)');

-- loja do quarto: Molde + Acabamento = SKU (01 §5.4)
INSERT INTO room_catalog (sku, name, mold_id, slot_type, width_cm, finish_json, rarity, price_points, required_level) VALUES
('FAI-PRT-AB60-WHT-FOS','Porta 60 · Branco fosco','PRT-AB60','DOOR',60,'{"color":"#F4F2EF","texture":"fosco","roughness":0.8}','BASICO',0,'ESTREIA'),
('FAI-PRT-AB60-NVY-LAC','Porta 60 · Navy laca','PRT-AB60','DOOR',60,'{"color":"#1B2A4A","texture":"laca","roughness":0.25}','PREMIUM',180,'STUDIO'),
('FAI-PRT-AB90-OAK-NAT','Porta 90 · Carvalho natural','PRT-AB90','DOOR',90,'{"color":"#B98E5E","texture":"madeira","roughness":0.6}','PREMIUM',260,'LOFT'),
('FAI-PUX-CAV-GLD','Puxador cava · Dourado','PUX-CAV','HANDLE',0,'{"color":"#C9A227","texture":"metal","roughness":0.3}','PREMIUM',90,'STUDIO'),
('FAI-LUZ-LED-WRM','Iluminação LED quente','LUZ-LED','LIGHT',0,'{"color":"#FFD9A0","kelvin":2700}','PREMIUM',150,'STUDIO'),
('FAI-SAP-MOD90-WHT','Sapateira 90 · Branco','SAP-MOD90','SHOE_RACK',90,'{"color":"#F4F2EF","texture":"fosco"}','PREMIUM',320,'CLOSET'),
('FAI-VIT-BOL-GLS','Vitrine de bolsas · Vidro','VIT-BOL','BAG_DISPLAY',60,'{"color":"#DDE6EA","texture":"vidro","roughness":0.05}','SIGNATURE',420,'CLOSET'),
('FAI-JOI-POR-VEL','Porta-joias · Veludo','JOI-POR','JEWELRY',30,'{"color":"#2F1B3A","texture":"veludo"}','SIGNATURE',380,'CLOSET'),
('FAI-ILH-BAN-MRB','Ilha central · Mármore','ILH-BAN','ISLAND',120,'{"color":"#EDEAE4","texture":"marmore","roughness":0.2}','SIGNATURE',900,'ATELIER'),
('FAI-TAP-RND-TER','Tapete redondo · Terracota','TAP-RND','RUG',0,'{"color":"#C4674A","texture":"lã"}','BASICO',60,'ESTREIA'),
('FAI-PRT-AB90-HOL-LTD','Porta 90 · Holográfica (edição limitada)','PRT-AB90','DOOR',90,'{"color":"#C4A5D6","texture":"holografico","roughness":0.1}','EDICAO_LIMITADA',1200,'PENTHOUSE');
UPDATE room_catalog SET stock_limit = 500 WHERE rarity = 'EDICAO_LIMITADA';

-- RF33 — origens novas de esquema e Look do Dia são valores de enum (VISTA_ME, SMART_MIRROR); nada a migrar.

-- anatomia_cards_DNA_v4_1 — layout base do card do DNA (Seção A), elemento-alvo da Etapa 1 e célula-marco.
ALTER TABLE dna_schemes ADD COLUMN card_layout VARCHAR(20) NOT NULL DEFAULT 'AMPLIADO';
ALTER TABLE dna_schemes ADD COLUMN target_element VARCHAR(20) NOT NULL DEFAULT 'DNA_COMPLETO';
ALTER TABLE dna_scheme_items ADD COLUMN milestone BOOLEAN NOT NULL DEFAULT FALSE;

-- fashionai-diagramas-completo (11) · RF11 §7.6 — vídeo em loop do Preset Aura + material (imagem única ou mosaico).
ALTER TABLE schemes ADD COLUMN background_video_url VARCHAR(1024) NULL;
ALTER TABLE dna_schemes ADD COLUMN background_video_url VARCHAR(1024) NULL;
