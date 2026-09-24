-- RF4 · Estúdio: foto de detalhe enquadrada no logo da peça (quando a IA ou o detector local encontram um logo).
-- A caixa do logo, os lados cortados pela foto e a fonte em alta resolução ficam em flat_lay_metadata_json.
ALTER TABLE wardrobe_items
  ADD COLUMN studio_detail_url VARCHAR(1024) NULL;
