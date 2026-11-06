-- RF-PESQ-01 — resgate por SKU, cor e tamanho: o estoque passa a existir por variante da oferta,
-- e o pedido guarda a variante escolhida (não pode ser trocada silenciosamente).

CREATE TABLE physical_store_variants (
    id CHAR(36) NOT NULL PRIMARY KEY,
    listing_id CHAR(36) NOT NULL,
    catalog_variant_id CHAR(36) NULL,
    variant_key VARCHAR(200) NOT NULL,
    sku VARCHAR(80) NULL,
    color_name VARCHAR(120) NULL,
    size_label VARCHAR(40) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_store_variant_listing FOREIGN KEY (listing_id) REFERENCES physical_store_listings(id),
    CONSTRAINT fk_store_variant_catalog FOREIGN KEY (catalog_variant_id) REFERENCES catalog_variants(id),
    CONSTRAINT uq_store_variant_key UNIQUE (listing_id, variant_key),
    CONSTRAINT chk_store_variant_stock CHECK (stock_quantity >= 0),
    CONSTRAINT chk_store_variant_reserved CHECK (reserved_quantity >= 0)
);

ALTER TABLE physical_store_orders
    ADD COLUMN variant_id CHAR(36) NULL,
    ADD COLUMN variant_sku VARCHAR(80) NULL,
    ADD COLUMN variant_color VARCHAR(120) NULL,
    ADD COLUMN variant_size VARCHAR(40) NULL,
    ADD CONSTRAINT fk_physical_order_variant FOREIGN KEY (variant_id) REFERENCES physical_store_variants(id);
