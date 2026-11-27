-- RF-PESQ-03 — ciclo de lavanderia: estado de uso da peça (limpa → usada → em lavagem → limpa), separado da
-- condição física e do arquivo; lotes de lavagem com instrução declarada; a disponibilidade é retirada
-- temporariamente e restaurada após confirmação.

CREATE TABLE piece_wear_states (
    id CHAR(36) NOT NULL PRIMARY KEY,
    piece_id CHAR(36) NOT NULL UNIQUE,
    owner_id CHAR(36) NOT NULL,
    state VARCHAR(10) NOT NULL,
    batch_id CHAR(36) NULL,
    availability_withheld BOOLEAN NOT NULL DEFAULT FALSE,
    changed_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_wear_state_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id),
    INDEX idx_wear_state_owner (owner_id, state)
);

CREATE TABLE piece_wear_state_log (
    id CHAR(36) NOT NULL PRIMARY KEY,
    piece_id CHAR(36) NOT NULL,
    owner_id CHAR(36) NOT NULL,
    from_state VARCHAR(10) NULL,
    to_state VARCHAR(10) NOT NULL,
    changed_at DATETIME(6) NOT NULL,
    note VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    INDEX idx_wear_log_piece (piece_id, changed_at)
);

CREATE TABLE laundry_batches (
    id CHAR(36) NOT NULL PRIMARY KEY,
    owner_id CHAR(36) NOT NULL,
    status VARCHAR(12) NOT NULL,
    instruction_code VARCHAR(30) NULL,
    instructions VARCHAR(1000) NULL,
    started_at DATETIME(6) NOT NULL,
    finished_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    INDEX idx_laundry_batch_owner (owner_id, status, started_at)
);

CREATE TABLE laundry_batch_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    batch_id CHAR(36) NOT NULL,
    piece_id CHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_laundry_item_batch FOREIGN KEY (batch_id) REFERENCES laundry_batches(id),
    CONSTRAINT uq_laundry_item UNIQUE (batch_id, piece_id)
);
