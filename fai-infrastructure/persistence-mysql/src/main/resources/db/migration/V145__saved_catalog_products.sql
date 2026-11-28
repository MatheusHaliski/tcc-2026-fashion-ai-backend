CREATE TABLE saved_catalog_products (
  user_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  saved_at DATETIME(6) NOT NULL,
  PRIMARY KEY (user_id, product_id),
  INDEX ix_saved_catalog_products_order (user_id, saved_at, product_id),
  CONSTRAINT fk_saved_catalog_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_catalog_product FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE
);
