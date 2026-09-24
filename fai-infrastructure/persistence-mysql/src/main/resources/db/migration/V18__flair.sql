-- FLAIR (Fashion League of Adaptive Intelligent Rewards · card Trello): jogo de cartas em que as cartas são as peças
-- (e os decks, os esquemas) do usuário. Lojas participantes definem, no perfil (RF14/RF22 · aba "Minhas combinações
-- FLAIR"), a combinação que completa um jogo; quem completa ganha um cupom da loja. Wearstyles não existem como
-- entidade: os atributos usam estilos (style_tags) e ocasiões (occasion_tags).

CREATE TABLE flair_profiles (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  coins INT NOT NULL DEFAULT 0,
  rank_points INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  skins_json JSON NULL,
  active_skin VARCHAR(30) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flair_profiles_user (user_id),
  CONSTRAINT fk_flair_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- extrato de coins: cada recompensa tem (motivo, referência) única — quest do dia não paga duas vezes
CREATE TABLE flair_coin_entries (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  delta INT NOT NULL,
  reason VARCHAR(60) NOT NULL,
  ref VARCHAR(80) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flair_coin_reason_ref (user_id, reason, ref),
  CONSTRAINT fk_flair_coin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE flair_combinations (
  id CHAR(36) NOT NULL,
  brand_user_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(600) NULL,
  game_type VARCHAR(30) NOT NULL,
  required_categories_json JSON NULL,
  required_styles_json JSON NULL,
  required_occasions_json JSON NULL,
  min_brand_pieces INT NOT NULL DEFAULT 0,
  min_deck_power INT NOT NULL DEFAULT 0,
  min_rarity VARCHAR(20) NULL,
  min_wins INT NOT NULL DEFAULT 0,
  coupon_title VARCHAR(120) NOT NULL,
  discount_percent INT NULL,
  discount_amount DECIMAL(10,2) NULL,
  min_purchase DECIMAL(10,2) NULL,
  valid_days INT NOT NULL DEFAULT 30,
  stock INT NULL,
  redeemed INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  starts_at DATETIME(6) NULL,
  ends_at DATETIME(6) NULL,
  accent_color VARCHAR(20) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  KEY idx_flair_combinations_brand (brand_user_id, active),
  CONSTRAINT fk_flair_combinations_brand FOREIGN KEY (brand_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE flair_redemptions (
  id CHAR(36) NOT NULL,
  combination_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  scheme_id CHAR(36) NULL,
  code VARCHAR(24) NOT NULL,
  status VARCHAR(20) NOT NULL,
  deck_power INT NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flair_redemptions_code (code),
  UNIQUE KEY uq_flair_redemptions_once (combination_id, user_id),
  CONSTRAINT fk_flair_red_combination FOREIGN KEY (combination_id) REFERENCES flair_combinations(id) ON DELETE CASCADE,
  CONSTRAINT fk_flair_red_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_flair_red_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE SET NULL
);

CREATE TABLE flair_teams (
  id CHAR(36) NOT NULL,
  name VARCHAR(60) NOT NULL,
  code VARCHAR(12) NOT NULL,
  owner_user_id CHAR(36) NOT NULL,
  color VARCHAR(20) NULL,
  points INT NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flair_teams_code (code),
  CONSTRAINT fk_flair_teams_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE flair_team_members (
  id CHAR(36) NOT NULL,
  team_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flair_team_members_user (user_id),
  CONSTRAINT fk_flair_tm_team FOREIGN KEY (team_id) REFERENCES flair_teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_flair_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- partidas de todos os modos: duelo 1×1, batalha de ocasião do dia, duelo de equipes 3×3 e treino contra a Casa
CREATE TABLE flair_matches (
  id CHAR(36) NOT NULL,
  mode VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL,
  theme VARCHAR(40) NULL,
  play_date DATE NULL,
  created_by_user_id CHAR(36) NOT NULL,
  team_a_id CHAR(36) NULL,
  team_b_id CHAR(36) NULL,
  winner_side VARCHAR(10) NULL,
  result_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  KEY idx_flair_matches_mode_date (mode, play_date),
  CONSTRAINT fk_flair_matches_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE flair_match_entries (
  id CHAR(36) NOT NULL,
  match_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  scheme_id CHAR(36) NULL,
  side VARCHAR(10) NOT NULL,
  deck_power INT NOT NULL,
  score DECIMAL(8,2) NULL,
  brand_pieces_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  KEY idx_flair_entries_user (user_id, created_at),
  CONSTRAINT fk_flair_entries_match FOREIGN KEY (match_id) REFERENCES flair_matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_flair_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_flair_entries_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE SET NULL
);
