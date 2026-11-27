-- RF-PESQ-08 — atributos de acessibilidade de uso e conforto declarados pela marca (nunca inferidos por foto ou
-- nome do tecido). Tri-estado por atributo: TRUE, FALSE ou UNKNOWN; ausência de dado não é inadequação.

CREATE TABLE catalog_accessibility_attributes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    product_id CHAR(36) NOT NULL UNIQUE,
    declared_by CHAR(36) NOT NULL,
    declaration_source VARCHAR(30) NOT NULL,
    closure_type VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    opening_position VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    magnetic_closure VARCHAR(8) NOT NULL DEFAULT 'UNKNOWN',
    tagless_label VARCHAR(8) NOT NULL DEFAULT 'UNKNOWN',
    flat_seams VARCHAR(8) NOT NULL DEFAULT 'UNKNOWN',
    fabric_contact VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    one_hand_dressing VARCHAR(8) NOT NULL DEFAULT 'UNKNOWN',
    notes VARCHAR(1000) NULL,
    review_status VARCHAR(12) NOT NULL DEFAULT 'DECLARED',
    reviewed_by CHAR(36) NULL,
    reviewed_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_accessibility_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE,
    INDEX idx_accessibility_filters (closure_type, opening_position, magnetic_closure, tagless_label, flat_seams, fabric_contact)
);
