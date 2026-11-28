ALTER TABLE catalog_products
  ADD COLUMN managed_wardrobe_item_id CHAR(36) NULL,
  ADD UNIQUE KEY uq_catalog_managed_wardrobe_item (managed_wardrobe_item_id),
  ADD CONSTRAINT fk_catalog_managed_wardrobe_item FOREIGN KEY (managed_wardrobe_item_id)
    REFERENCES wardrobe_items(id) ON DELETE SET NULL;
