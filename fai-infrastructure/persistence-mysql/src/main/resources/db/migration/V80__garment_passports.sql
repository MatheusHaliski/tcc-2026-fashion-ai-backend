-- Private physical-garment records; documents never use public media storage.

CREATE TABLE garment_passports (
    id CHAR(36) NOT NULL PRIMARY KEY,
    piece_id CHAR(36) NOT NULL UNIQUE,
    owner_id CHAR(36) NOT NULL,
    origin VARCHAR(30) NULL,
    composition VARCHAR(1000) NULL,
    care VARCHAR(1000) NULL,
    pending_transfer_id CHAR(36) NULL,
    state_updated_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_passport_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id),
    CONSTRAINT fk_passport_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE passport_holdings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    passport_id CHAR(36) NOT NULL,
    owner_id CHAR(36) NOT NULL,
    piece_id CHAR(36) NOT NULL,
    active_passport_id CHAR(36) NULL UNIQUE,
    started_at DATETIME(6) NOT NULL,
    ended_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_passport_holdings_passport FOREIGN KEY (passport_id) REFERENCES garment_passports(id)
);

CREATE TABLE passport_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    passport_id CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    kind VARCHAR(30) NOT NULL,
    notes VARCHAR(4096) NULL,
    occurred_on DATE NOT NULL,
    corrects_event_id CHAR(36) NULL,
    command_key VARCHAR(80) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_passport_events_passport FOREIGN KEY (passport_id) REFERENCES garment_passports(id),
    CONSTRAINT uq_passport_event_command UNIQUE (passport_id, author_id, command_key)
);

CREATE TABLE passport_shares (
    id CHAR(36) NOT NULL PRIMARY KEY,
    passport_id CHAR(36) NOT NULL,
    owner_id CHAR(36) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    fields VARCHAR(160) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_passport_shares_passport FOREIGN KEY (passport_id) REFERENCES garment_passports(id)
);

CREATE TABLE passport_evidence (
    id CHAR(36) NOT NULL PRIMARY KEY,
    passport_id CHAR(36) NOT NULL,
    controller_id CHAR(36) NOT NULL,
    kind VARCHAR(30) NOT NULL,
    content_ciphertext LONGTEXT NULL,
    content_hash VARCHAR(64) NULL,
    command_key VARCHAR(80) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_passport_evidence_passport FOREIGN KEY (passport_id) REFERENCES garment_passports(id),
    CONSTRAINT uq_passport_evidence_command UNIQUE (passport_id, controller_id, command_key)
);

CREATE TABLE passport_transfers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    passport_id CHAR(36) NOT NULL,
    from_owner_id CHAR(36) NOT NULL,
    recipient_id CHAR(36) NOT NULL,
    source_piece_id CHAR(36) NOT NULL,
    recipient_piece_id CHAR(36) NULL,
    token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    command_key VARCHAR(80) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    accepted_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_passport_transfers_passport FOREIGN KEY (passport_id) REFERENCES garment_passports(id),
    CONSTRAINT uq_passport_transfer_command UNIQUE (passport_id, from_owner_id, command_key),
    INDEX idx_passport_transfer_recipient (recipient_id, status, created_at)
);
