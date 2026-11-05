-- RF-PESQ-09 — lista de compras por lacunas e orçamento: o plano é calculado sob demanda; só as marcações
-- "já possuo" / "não preciso" são persistidas para não sugerir a mesma compra de novo.

CREATE TABLE shopping_plan_dismissals (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    kind VARCHAR(12) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_shopping_dismissal_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_shopping_dismissal_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE,
    CONSTRAINT uq_shopping_dismissal UNIQUE (user_id, product_id)
);
