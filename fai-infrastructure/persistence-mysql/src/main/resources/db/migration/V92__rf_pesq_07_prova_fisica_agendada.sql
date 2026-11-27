-- RF-PESQ-07 — prova física agendada com seleção de tamanhos e reserva temporária.
-- Item sem estoque/integração fica como solicitação pendente; reserva expira de forma idempotente.

CREATE TABLE fitting_appointments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    seller_id CHAR(36) NOT NULL,
    status VARCHAR(12) NOT NULL,
    requested_slot DATETIME(6) NOT NULL,
    confirmed_slot DATETIME(6) NULL,
    expires_at DATETIME(6) NOT NULL,
    notes VARCHAR(1000) NULL,
    released BOOLEAN NOT NULL DEFAULT FALSE,
    request_id VARCHAR(80) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_fitting_appt_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_fitting_appt_seller FOREIGN KEY (seller_id) REFERENCES users(id),
    CONSTRAINT uq_fitting_appt_request UNIQUE (user_id, request_id),
    INDEX idx_fitting_appt_seller (seller_id, status, requested_slot),
    INDEX idx_fitting_appt_expiry (status, expires_at)
);

CREATE TABLE fitting_appointment_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    appointment_id CHAR(36) NOT NULL,
    catalog_product_id CHAR(36) NOT NULL,
    store_variant_id CHAR(36) NULL,
    size_label VARCHAR(40) NOT NULL,
    state VARCHAR(16) NOT NULL,
    result VARCHAR(10) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_fitting_item_appt FOREIGN KEY (appointment_id) REFERENCES fitting_appointments(id),
    CONSTRAINT fk_fitting_item_product FOREIGN KEY (catalog_product_id) REFERENCES catalog_products(id),
    CONSTRAINT fk_fitting_item_variant FOREIGN KEY (store_variant_id) REFERENCES physical_store_variants(id)
);
