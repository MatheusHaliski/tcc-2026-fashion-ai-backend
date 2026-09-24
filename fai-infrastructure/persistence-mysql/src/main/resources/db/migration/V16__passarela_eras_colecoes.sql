-- RF1: sexo informado no cadastro (define o manequim da Passarela 3D e do provador) e saída da passarela (Trello · Passarela 3D).
ALTER TABLE users
  ADD COLUMN sex VARCHAR(20) NULL,
  ADD COLUMN runway_opt_out TINYINT(1) NOT NULL DEFAULT 0;

-- RF22 · abas Eras (celebridade) e Coleções (marca): as eras e coleções já são agrupamentos (scheme_groupings com
-- type ERA/PHASE/TOUR ou COLLECTION), ligados a esquemas e peças por grouping_id. Ganham período, cor e ordem para a
-- busca por era/coleção, o ranking de insights (palco 2D e mini loja 3D) e o header com a foto/arte.
ALTER TABLE scheme_groupings
  ADD COLUMN period_from SMALLINT NULL,
  ADD COLUMN period_to SMALLINT NULL,
  ADD COLUMN accent_color VARCHAR(20) NULL,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX idx_schemes_grouping ON schemes(grouping_id);
CREATE INDEX idx_wardrobe_items_grouping ON wardrobe_items(grouping_id);
