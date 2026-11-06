-- RF-PESQ-05 — ordem de reparo/ajuste com evidência emitida pela oficina, vinculada ao passaporte.
-- Autodeclaração do dono e atestação do prestador ficam separadas; recibo privado nunca entra no QR público.

CREATE TABLE passport_repair_orders (
    id CHAR(36) NOT NULL PRIMARY KEY,
    passport_id CHAR(36) NOT NULL,
    owner_id CHAR(36) NOT NULL,
    provider_id CHAR(36) NOT NULL,
    status VARCHAR(12) NOT NULL,
    request_notes VARCHAR(2000) NULL,
    diagnosis VARCHAR(2000) NULL,
    quote_amount DECIMAL(12,2) NULL,
    quote_currency CHAR(3) NULL,
    quote_valid_until DATE NULL,
    authorized_at DATETIME(6) NULL,
    authorized_by CHAR(36) NULL,
    service_summary VARCHAR(2000) NULL,
    provider_statement VARCHAR(2000) NULL,
    delivered_at DATETIME(6) NULL,
    share_scope VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    access_revoked_at DATETIME(6) NULL,
    passport_event_id CHAR(36) NULL,
    command_key VARCHAR(80) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_repair_order_passport FOREIGN KEY (passport_id) REFERENCES garment_passports(id),
    CONSTRAINT uq_repair_order_command UNIQUE (passport_id, owner_id, command_key),
    INDEX idx_repair_order_provider (provider_id, status, created_at)
);

CREATE TABLE passport_repair_order_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    actor_id CHAR(36) NOT NULL,
    actor_role VARCHAR(10) NOT NULL,
    from_status VARCHAR(12) NULL,
    to_status VARCHAR(12) NOT NULL,
    notes VARCHAR(2000) NULL,
    corrects_event_id CHAR(36) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_repair_event_order FOREIGN KEY (order_id) REFERENCES passport_repair_orders(id),
    INDEX idx_repair_event_order (order_id, created_at)
);

CREATE TABLE passport_repair_receipts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    provider_id CHAR(36) NOT NULL,
    content_ciphertext LONGTEXT NULL,
    content_hash VARCHAR(64) NULL,
    command_key VARCHAR(80) NOT NULL,
    deleted_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_repair_receipt_order FOREIGN KEY (order_id) REFERENCES passport_repair_orders(id),
    CONSTRAINT uq_repair_receipt_command UNIQUE (order_id, provider_id, command_key)
);
