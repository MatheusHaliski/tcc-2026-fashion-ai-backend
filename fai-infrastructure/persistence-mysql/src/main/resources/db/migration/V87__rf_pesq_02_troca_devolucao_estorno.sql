-- RF-PESQ-02 — troca/devolução rastreável: política congelada no pedido, caso com trilha de estados,
-- comprovantes privados (cifrados, nunca em mídia pública) e estorno único no ledger.

ALTER TABLE physical_store_orders
    ADD COLUMN return_window_days INT NULL,
    ADD COLUMN return_policy_version VARCHAR(20) NULL;

CREATE TABLE physical_store_return_cases (
    id CHAR(36) NOT NULL PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    buyer_id CHAR(36) NOT NULL,
    seller_id CHAR(36) NOT NULL,
    kind VARCHAR(10) NOT NULL,
    reason_code VARCHAR(30) NOT NULL,
    reason_notes VARCHAR(2000) NULL,
    variant_id CHAR(36) NULL,
    exchange_variant_id CHAR(36) NULL,
    exchange_order_id CHAR(36) NULL,
    status VARCHAR(20) NOT NULL,
    policy_version VARCHAR(20) NOT NULL,
    window_days INT NOT NULL,
    deadline_at DATETIME(6) NOT NULL,
    inspection_outcome VARCHAR(20) NULL,
    divergence_reason VARCHAR(1000) NULL,
    restocked BOOLEAN NOT NULL DEFAULT FALSE,
    refund_ref VARCHAR(120) NULL,
    fit_feedback_consent BOOLEAN NOT NULL DEFAULT FALSE,
    command_key VARCHAR(80) NOT NULL,
    closed_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_return_case_order FOREIGN KEY (order_id) REFERENCES physical_store_orders(id),
    CONSTRAINT uq_return_case_command UNIQUE (order_id, buyer_id, command_key),
    INDEX idx_return_case_seller (seller_id, status, created_at),
    INDEX idx_return_case_buyer (buyer_id, created_at)
);

CREATE TABLE physical_store_return_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    case_id CHAR(36) NOT NULL,
    actor_id CHAR(36) NOT NULL,
    from_status VARCHAR(20) NULL,
    to_status VARCHAR(20) NOT NULL,
    notes VARCHAR(2000) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_return_event_case FOREIGN KEY (case_id) REFERENCES physical_store_return_cases(id),
    INDEX idx_return_event_case (case_id, created_at)
);

CREATE TABLE physical_store_return_evidence (
    id CHAR(36) NOT NULL PRIMARY KEY,
    case_id CHAR(36) NOT NULL,
    uploader_id CHAR(36) NOT NULL,
    content_ciphertext LONGTEXT NULL,
    content_hash VARCHAR(64) NULL,
    command_key VARCHAR(80) NOT NULL,
    deleted_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_return_evidence_case FOREIGN KEY (case_id) REFERENCES physical_store_return_cases(id),
    CONSTRAINT uq_return_evidence_command UNIQUE (case_id, uploader_id, command_key)
);
