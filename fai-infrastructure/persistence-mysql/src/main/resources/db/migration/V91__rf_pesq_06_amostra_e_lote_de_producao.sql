-- RF-PESQ-06 — aprovação de amostra e lote de produção: a ordem congela revisão, BOM e tolerâncias;
-- desvios são aceitos com justificativa ou devolvidos; aprovação é explícita e cai com nova revisão.
-- Voto social nunca autoriza produção nem cobrança.

CREATE TABLE atelier_production_requests (
    id CHAR(36) NOT NULL PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    requested_by CHAR(36) NOT NULL,
    producer_id CHAR(36) NOT NULL,
    quote_id CHAR(36) NULL,
    bom_snapshot_json LONGTEXT NOT NULL,
    tolerances_json VARCHAR(4000) NOT NULL,
    status VARCHAR(22) NOT NULL,
    approved_by CHAR(36) NULL,
    approved_at DATETIME(6) NULL,
    approved_project_version BIGINT NULL,
    request_id VARCHAR(80) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_production_project FOREIGN KEY (project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_production_revision FOREIGN KEY (revision_id) REFERENCES atelier_project_revisions(id) ON DELETE CASCADE,
    CONSTRAINT uq_production_request UNIQUE (project_id, requested_by, request_id),
    INDEX idx_production_producer (producer_id, status, created_at)
);

CREATE TABLE atelier_sample_deviations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    production_request_id CHAR(36) NOT NULL,
    measurement_point VARCHAR(80) NOT NULL,
    expected VARCHAR(120) NOT NULL,
    measured VARCHAR(120) NOT NULL,
    recorded_by CHAR(36) NOT NULL,
    decision VARCHAR(10) NOT NULL,
    justification VARCHAR(1000) NULL,
    decided_by CHAR(36) NULL,
    decided_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_deviation_request FOREIGN KEY (production_request_id) REFERENCES atelier_production_requests(id) ON DELETE CASCADE,
    INDEX idx_deviation_request (production_request_id, created_at)
);
