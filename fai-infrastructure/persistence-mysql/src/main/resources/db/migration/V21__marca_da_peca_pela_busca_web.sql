-- RF4 · buscador de marcas na internet: a peça guarda o logo filtrado (fundo branco, letras pretas) e de onde a marca veio.
-- Não há catálogo de marcas pré-cadastrado: brand_id continua opcional (só liga a peça a uma marca cadastrada na plataforma).
ALTER TABLE wardrobe_items
    ADD COLUMN brand_logo_url VARCHAR(1024) NULL AFTER brand_name,
    ADD COLUMN brand_source   VARCHAR(40)   NULL AFTER brand_logo_url,
    ADD COLUMN brand_ref      VARCHAR(255)  NULL AFTER brand_source;
