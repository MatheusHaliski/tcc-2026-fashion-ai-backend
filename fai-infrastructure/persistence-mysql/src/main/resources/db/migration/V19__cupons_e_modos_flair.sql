-- Cupons Fashion AI (card Trello RF38) e modos do FLAIR.
--
-- 1) Direito promocional: quando o usuário conquista, usando o app, o direito a um cupom de uma marca/celebridade
--    (selo com política de promoção do RF25, combinação FLAIR…), nasce um registro PENDENTE e uma notificação
--    "Parabéns! Deseja resgatar o CUPOM?". Ao aceitar, o cupom é emitido pela fonte (promotion_redemptions ou
--    flair_redemptions) e aparece em "Meus cupons resgatados" no lookbook; o clique abre a loja terceira.
CREATE TABLE coupon_rights (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  owner_user_id CHAR(36) NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  source_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  detail VARCHAR(400) NULL,
  status VARCHAR(20) NOT NULL,
  scheme_id CHAR(36) NULL,
  coupon_ref CHAR(36) NULL,
  decided_at DATETIME(6) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupon_rights_source (user_id, source_type, source_id),
  KEY idx_coupon_rights_owner (owner_user_id, status),
  CONSTRAINT fk_coupon_rights_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_rights_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- link da loja terceira onde o cupom é usado (sobrepõe o site da marca)
ALTER TABLE promotions ADD COLUMN store_url VARCHAR(512) NULL;
ALTER TABLE flair_combinations ADD COLUMN store_url VARCHAR(512) NULL;

-- 2) Modos do FLAIR: estado por jogador, modo e temporada (elenco da liga, posição no World Tour, deck de 12 cartas
--    do Deck Battle, FLAIR Ultimate Team…), territórios (Fashion Monopoly e Conquest) e troféus (Runway, Liga…).
CREATE TABLE flair_mode_states (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  mode VARCHAR(30) NOT NULL,
  season_key VARCHAR(20) NOT NULL,
  state_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flair_mode_state (user_id, mode, season_key),
  KEY idx_flair_mode_state_season (mode, season_key),
  CONSTRAINT fk_flair_mode_state_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE flair_territories (
  id CHAR(36) NOT NULL,
  map_code VARCHAR(20) NOT NULL,
  territory_code VARCHAR(40) NOT NULL,
  owner_user_id CHAR(36) NULL,
  defender_json JSON NULL,
  captured_at DATETIME(6) NULL,
  defenses INT NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flair_territory (map_code, territory_code),
  CONSTRAINT fk_flair_territory_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE flair_trophies (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  mode VARCHAR(30) NOT NULL,
  title VARCHAR(160) NOT NULL,
  season_key VARCHAR(20) NOT NULL,
  detail_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL, created_by VARCHAR(80) NULL, last_modified_by VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flair_trophy (user_id, mode, title, season_key),
  CONSTRAINT fk_flair_trophy_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
