ALTER TABLE wardrobe_items
  ADD COLUMN expires_at DATETIME(6) NULL,
  ADD COLUMN archive_on_expiry BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE marketplace_negotiations (
  id CHAR(36) PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 0,
  piece_id CHAR(36) NOT NULL,
  store_id CHAR(36) NOT NULL,
  owner_user_id CHAR(36) NOT NULL,
  counterparty_user_id CHAR(36) NOT NULL,
  proposed_by CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  terms VARCHAR(1000),
  status VARCHAR(20) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_marketplace_negotiation (piece_id, store_id, counterparty_user_id),
  INDEX ix_marketplace_negotiation_owner (owner_user_id, updated_at),
  INDEX ix_marketplace_negotiation_counterparty (counterparty_user_id, updated_at),
  CONSTRAINT fk_marketplace_negotiation_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_marketplace_negotiation_store FOREIGN KEY (store_id) REFERENCES physical_stores(id),
  CONSTRAINT fk_marketplace_negotiation_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_marketplace_negotiation_counterparty FOREIGN KEY (counterparty_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_marketplace_negotiation_participants CHECK (
    owner_user_id <> counterparty_user_id AND proposed_by IN (owner_user_id, counterparty_user_id)
  ),
  CONSTRAINT ck_marketplace_negotiation_price CHECK (amount > 0),
  CONSTRAINT ck_marketplace_negotiation_status CHECK (status IN ('PENDING','ACCEPTED','CANCELLED'))
);
