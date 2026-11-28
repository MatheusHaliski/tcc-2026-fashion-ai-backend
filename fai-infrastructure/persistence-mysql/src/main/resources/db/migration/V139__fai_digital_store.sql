CREATE TABLE fai_digital_offers (
  code VARCHAR(80) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  product_id CHAR(36),
  design_json JSON,
  points INT NOT NULL,
  stock INT,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_fai_offer_product FOREIGN KEY (product_id) REFERENCES catalog_products(id),
  CONSTRAINT ck_fai_digital_offer CHECK (
    points > 0 AND (stock IS NULL OR stock >= 0)
    AND ((kind IN ('EXCLUSIVE_PIECE','ACERVO') AND product_id IS NOT NULL AND design_json IS NULL)
      OR (kind = 'SEAL' AND product_id IS NULL AND design_json IS NOT NULL))
  )
);

CREATE TABLE fai_digital_purchases (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  offer_code VARCHAR(80) NOT NULL,
  piece_id CHAR(36),
  points INT NOT NULL,
  purchased_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_fai_digital_purchase UNIQUE (owner_id, offer_code),
  CONSTRAINT fk_fai_digital_purchase_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fai_digital_purchase_offer FOREIGN KEY (offer_code) REFERENCES fai_digital_offers(code),
  CONSTRAINT fk_fai_digital_purchase_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id) ON DELETE SET NULL
);

UPDATE fai_points_rules SET points=5, daily_cap=NULL, weekly_cap=NULL, description='Criar uma peça'
 WHERE action_code='PIECE_CATALOGED';
UPDATE fai_points_rules SET points=20, daily_cap=NULL, weekly_cap=NULL, description='Criar um look'
 WHERE action_code='SCHEME_CREATED';
INSERT INTO fai_points_rules (action_code, points, once_per_ref, active, description)
 VALUES ('DNA_CREATED',10,TRUE,TRUE,'Criar um DNA'),
        ('MARKETPLACE_PARTNERSHIP',30,TRUE,TRUE,'Publicar uma peça em parceria com marca');
UPDATE fai_points_rules SET active=FALSE WHERE action_code NOT IN ('PIECE_CATALOGED','SCHEME_CREATED','DNA_CREATED','MARKETPLACE_PARTNERSHIP');
