-- FLAIR-UT (docs/plano/FLAIR_UT_Cartas_e_Desafios.md, §5 e D11): a carta FLAIR é uma CÓPIA da peça, gerada por um
-- gesto da pessoa ("Converter para FLAIR", no criador ou no detalhe). A peça e o card do guarda-roupa ficam como estão;
-- a carta guarda o retrato do dia da geração. Uma carta por peça por temporada (D6). Converter não publica no feed.
CREATE TABLE flair_card_instance (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  creator_id CHAR(36) NULL,
  origin_type VARCHAR(10) NOT NULL,                -- PIECE, LOOK
  origin_id CHAR(36) NOT NULL,
  season VARCHAR(20) NOT NULL,
  tier VARCHAR(10) NOT NULL,                       -- BRONZE, PRATA, OURO, ESPECIAL
  ovr INT NOT NULL,
  rare BOOLEAN NOT NULL DEFAULT FALSE,
  position VARCHAR(4) NOT NULL,                    -- SUP, INF, CAL, ACE, VES, LOOK
  name VARCHAR(160) NOT NULL,
  brand_name VARCHAR(120) NULL,
  image_url VARCHAR(1024) NULL,
  category VARCHAR(40) NULL,
  subcategory VARCHAR(80) NULL,
  hype_json TEXT NULL,
  stats_json TEXT NULL,
  basis_json TEXT NULL,
  price_verified BOOLEAN NOT NULL DEFAULT FALSE,
  state VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',  -- AVAILABLE, LOCKED_CHALLENGE
  tradeable BOOLEAN NOT NULL DEFAULT TRUE,
  acquired_via VARCHAR(20) NOT NULL DEFAULT 'GENERATED',
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_flair_card_origin_season UNIQUE (origin_type, origin_id, season),
  CONSTRAINT ck_flair_card_tier CHECK (tier IN ('BRONZE', 'PRATA', 'OURO', 'ESPECIAL')),
  CONSTRAINT ck_flair_card_ovr CHECK (ovr BETWEEN 0 AND 99),
  CONSTRAINT fk_flair_card_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_flair_card_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX ix_flair_card_owner (owner_id, created_at)
);
