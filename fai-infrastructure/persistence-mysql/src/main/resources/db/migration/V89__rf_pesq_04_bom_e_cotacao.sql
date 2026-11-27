-- RF-PESQ-04 — lista de materiais (BOM) e cotação de produção vinculadas a uma revisão imutável do Atelier.
-- Interesse/voto da comunidade não gera compra; cotação não é pedido nem promessa de produção.

CREATE TABLE atelier_bom_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    kind VARCHAR(12) NOT NULL,
    name VARCHAR(160) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    notes VARCHAR(1000) NULL,
    request_id VARCHAR(80) NOT NULL,
    removed_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_bom_project FOREIGN KEY (project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_revision FOREIGN KEY (revision_id) REFERENCES atelier_project_revisions(id) ON DELETE CASCADE,
    CONSTRAINT uq_bom_request UNIQUE (project_id, author_id, request_id),
    INDEX idx_bom_revision (revision_id, removed_at)
);

CREATE TABLE atelier_quote_requests (
    id CHAR(36) NOT NULL PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    requested_by CHAR(36) NOT NULL,
    supplier_id CHAR(36) NOT NULL,
    currency CHAR(3) NOT NULL,
    sizes_json VARCHAR(2000) NOT NULL,
    notes VARCHAR(2000) NULL,
    status VARCHAR(12) NOT NULL,
    request_id VARCHAR(80) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_quote_request_project FOREIGN KEY (project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_request_revision FOREIGN KEY (revision_id) REFERENCES atelier_project_revisions(id) ON DELETE CASCADE,
    CONSTRAINT uq_quote_request UNIQUE (project_id, requested_by, request_id),
    INDEX idx_quote_request_supplier (supplier_id, status, created_at)
);

CREATE TABLE atelier_quotes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    quote_request_id CHAR(36) NOT NULL,
    supplier_id CHAR(36) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    sample_cost DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    lead_time_days INT NOT NULL,
    valid_until DATE NOT NULL,
    notes VARCHAR(2000) NULL,
    status VARCHAR(12) NOT NULL,
    accepted_by CHAR(36) NULL,
    accepted_at DATETIME(6) NULL,
    accepted_revision_id CHAR(36) NULL,
    accepted_project_version BIGINT NULL,
    command_key VARCHAR(80) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_quote_request FOREIGN KEY (quote_request_id) REFERENCES atelier_quote_requests(id) ON DELETE CASCADE,
    CONSTRAINT uq_quote_command UNIQUE (quote_request_id, supplier_id, command_key)
);
