-- Loja do guarda-roupa (RF30/RF35) com todos os componentes por material, cor e selo de identidade, e o criador de
-- guarda-roupa 3D (card Trello RF39): marcas e celebridades criam componentes ou um guarda-roupa inteiro com logo,
-- nome e arte, vendidos na loja do quarto com condições (preço em FAI Points, nível, estoque, limite por pessoa,
-- janela de disponibilidade e exigência de selo da marca/celebridade).
ALTER TABLE room_catalog
  ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'COMPONENT',
  ADD COLUMN material VARCHAR(30) NULL,
  ADD COLUMN color_name VARCHAR(40) NULL,
  ADD COLUMN description VARCHAR(400) NULL,
  ADD COLUMN creator_user_id CHAR(36) NULL,
  ADD COLUMN seal_id CHAR(36) NULL,
  ADD COLUMN logo_url VARCHAR(1024) NULL,
  ADD COLUMN art_url VARCHAR(1024) NULL,
  ADD COLUMN label_text VARCHAR(60) NULL,
  ADD COLUMN bundle_json JSON NULL,
  ADD COLUMN available_from DATETIME(6) NULL,
  ADD COLUMN available_until DATETIME(6) NULL,
  ADD COLUMN per_user_limit INT NULL,
  ADD COLUMN requires_seal BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN created_at DATETIME(6) NULL;

ALTER TABLE room_catalog ADD CONSTRAINT fk_room_catalog_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE room_catalog ADD CONSTRAINT fk_room_catalog_seal FOREIGN KEY (seal_id) REFERENCES seals(id) ON DELETE SET NULL;
CREATE INDEX idx_room_catalog_creator ON room_catalog (creator_user_id);
CREATE INDEX idx_room_inventory_user_sku ON room_inventory (user_id, sku);

UPDATE room_catalog SET material = UPPER(JSON_UNQUOTE(JSON_EXTRACT(finish_json, '$.texture'))) WHERE finish_json IS NOT NULL;
