-- Peça (wardrobe_items): variação (3º nível da taxonomia) e atributos por dimensão (docs/taxonomia, seções E e F).
-- Aditiva: colunas novas anuláveis/com default e uma tabela nova; nenhum dado existente muda.
-- A FK composta (subcategory, variation_code) só é checada quando variation_code não é NULL, então as peças atuais
-- (sem variação, inclusive as de subcategoria LEGACY) continuam válidas.

ALTER TABLE wardrobe_items
  ADD COLUMN variation_code VARCHAR(60) NULL AFTER subcategory,
  ADD COLUMN variation_status VARCHAR(16) NULL AFTER variation_code,        -- USER_CONFIRMED | AI_SUGGESTED | NEEDS_REVIEW | UNKNOWN
  ADD COLUMN variation_confidence DECIMAL(4,3) NULL AFTER variation_status,
  ADD COLUMN price_currency CHAR(3) NOT NULL DEFAULT 'BRL' AFTER price;

ALTER TABLE wardrobe_items
  ADD CONSTRAINT ck_wardrobe_items_variation_status
    CHECK (variation_status IS NULL OR variation_status IN ('USER_CONFIRMED', 'AI_SUGGESTED', 'NEEDS_REVIEW', 'UNKNOWN'));

CREATE INDEX idx_wardrobe_items_sub_variation ON wardrobe_items(subcategory, variation_code);

ALTER TABLE wardrobe_items
  ADD CONSTRAINT fk_wardrobe_items_variation FOREIGN KEY (subcategory, variation_code)
    REFERENCES taxonomy_subcategory_variations(subcategory_code, variation_code);

-- atributos da peça: uma linha por (dimensão, valor). Estilo e ocasião também entram aqui (≤ 2 cada); as colunas CSV
-- style_tags/occasion_tags continuam sendo escritas para compatibilidade até a leitura migrar.
CREATE TABLE wardrobe_item_attributes (
  item_id CHAR(36) NOT NULL,
  dimension_code VARCHAR(30) NOT NULL,
  value_code VARCHAR(60) NOT NULL,
  source VARCHAR(12) NOT NULL,                  -- USER | AI | CATALOG | RULE
  confidence DECIMAL(4,3) NULL,
  position TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (item_id, dimension_code, value_code),
  CONSTRAINT fk_wia_item FOREIGN KEY (item_id) REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_wia_value FOREIGN KEY (dimension_code, value_code) REFERENCES taxonomy_values(dimension_code, code),
  CONSTRAINT ck_wia_source CHECK (source IN ('USER', 'AI', 'CATALOG', 'RULE')),
  INDEX idx_wia_filter (dimension_code, value_code, item_id)
);
