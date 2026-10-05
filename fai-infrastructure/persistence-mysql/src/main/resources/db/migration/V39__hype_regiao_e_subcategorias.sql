-- HypeScore v2 (RF53) — recortes do "Ranking de HypeScore" no Explorador: região do mundo (pelo país do dono, mesma
-- tabela WorldRegions do Painel global), país, categorias e subcategorias. Na peça, a própria categoria/subcategoria; no
-- look, as das peças que o compõem (o look entra no recorte "calçados" se tiver um calçado). Preenchido pelo job de
-- snapshots; linhas antigas ficam nulas até o próximo recálculo (o recálculo ao vivo roda em poucos minutos).
ALTER TABLE hype_scores
  ADD COLUMN country VARCHAR(8) NULL AFTER occasions,
  ADD COLUMN region VARCHAR(40) NULL AFTER country,
  ADD COLUMN categories VARCHAR(255) NULL AFTER region,
  ADD COLUMN subcategories VARCHAR(1000) NULL AFTER categories;

CREATE INDEX idx_hype_scores_region ON hype_scores (entity_type, algorithm_version, public_eligible, region);
