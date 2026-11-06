-- RF-PESQ-10 — eventos de demanda consentidos: sem identificador de usuário (só um HMAC de contribuição para
-- deduplicar e para apagar na revogação), agregados por marca/produto/cor/tamanho com limiar de publicação.

CREATE TABLE retail_demand_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    brand_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    variant_id CHAR(36) NULL,
    color_name VARCHAR(120) NULL,
    size_label VARCHAR(40) NULL,
    kind VARCHAR(16) NOT NULL,
    bucket_day DATE NOT NULL,
    contributor_hash CHAR(64) NOT NULL,
    consent_version VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_demand_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE,
    CONSTRAINT uq_demand_daily UNIQUE (contributor_hash, product_id, kind, bucket_day),
    INDEX idx_demand_brand_day (brand_id, bucket_day),
    INDEX idx_demand_contributor (contributor_hash)
);
