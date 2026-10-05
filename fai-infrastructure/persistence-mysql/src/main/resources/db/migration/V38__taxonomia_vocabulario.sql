-- Taxonomia de peças CATEGORY → SUBCATEGORY → VARIATION + dimensões de atributo (docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md,
-- seções C e E). Só cria as tabelas de vocabulário (vazias); os dados entram em V39–V41, gerados de
-- fai-application/src/main/resources/taxonomy/taxonomy.json por scripts/taxonomy/build_taxonomy.py.
-- Aditiva: não toca em nenhuma tabela existente.

CREATE TABLE taxonomy_categories (
  code VARCHAR(40) PRIMARY KEY,
  display_name_pt_br VARCHAR(80) NOT NULL,
  display_name_en VARCHAR(80) NOT NULL,
  sort_order SMALLINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- status LEGACY: o código continua válido (dados antigos), mas a escrita nova usa replaced_by_code + os atributos de
-- taxonomy_subcategory_mappings (ex.: bermuda_shorts → shorts + LENGTH=KNEE).
CREATE TABLE taxonomy_subcategories (
  code VARCHAR(60) PRIMARY KEY,
  category_code VARCHAR(40) NOT NULL,
  display_name_pt_br VARCHAR(80) NOT NULL,
  display_name_en VARCHAR(80) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
  replaced_by_code VARCHAR(60) NULL,
  sort_order SMALLINT NOT NULL,
  CONSTRAINT fk_tax_sub_category FOREIGN KEY (category_code) REFERENCES taxonomy_categories(code),
  CONSTRAINT fk_tax_sub_replaced FOREIGN KEY (replaced_by_code) REFERENCES taxonomy_subcategories(code),
  CONSTRAINT ck_tax_sub_status CHECK (status IN ('ACTIVE', 'LEGACY'))
);

-- o que um código legado implica: dimension_code = 'VARIATION' ou uma dimensão de atributo
CREATE TABLE taxonomy_subcategory_mappings (
  legacy_code VARCHAR(60) NOT NULL,
  dimension_code VARCHAR(30) NOT NULL,
  value_code VARCHAR(60) NOT NULL,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (legacy_code, dimension_code),
  CONSTRAINT fk_tax_map_legacy FOREIGN KEY (legacy_code) REFERENCES taxonomy_subcategories(code)
);

-- catálogo global de variações (corte/silhueta/construção): o mesmo código tem o mesmo sentido em toda subcategoria
CREATE TABLE taxonomy_variations (
  code VARCHAR(60) PRIMARY KEY,
  display_name_pt_br VARCHAR(80) NOT NULL,
  display_name_en VARCHAR(80) NOT NULL,
  description_pt_br VARCHAR(400) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE taxonomy_subcategory_variations (
  subcategory_code VARCHAR(60) NOT NULL,
  variation_code VARCHAR(60) NOT NULL,
  tier VARCHAR(10) NOT NULL,
  priority TINYINT NOT NULL,
  sort_order SMALLINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (subcategory_code, variation_code),
  CONSTRAINT fk_tax_sv_sub FOREIGN KEY (subcategory_code) REFERENCES taxonomy_subcategories(code),
  CONSTRAINT fk_tax_sv_var FOREIGN KEY (variation_code) REFERENCES taxonomy_variations(code),
  CONSTRAINT ck_tax_sv_tier CHECK (tier IN ('CORE', 'EXTENDED', 'NICHE')),
  CONSTRAINT ck_tax_sv_priority CHECK (priority BETWEEN 1 AND 5)
);

-- dimensões de atributo (acabamento, comprimento, cano, cor, material, estilo, ocasião…)
CREATE TABLE taxonomy_dimensions (
  code VARCHAR(30) PRIMARY KEY,
  display_name_pt_br VARCHAR(80) NOT NULL,
  display_name_en VARCHAR(80) NOT NULL,
  multi_valued BOOLEAN NOT NULL DEFAULT FALSE,
  max_per_piece TINYINT NOT NULL DEFAULT 1,
  max_per_scheme TINYINT NULL,
  storage VARCHAR(10) NOT NULL,                 -- COLUMN (coluna da peça) | ATTRIBUTE (linhas *_attributes)
  sort_order SMALLINT NOT NULL,
  CONSTRAINT ck_tax_dim_storage CHECK (storage IN ('COLUMN', 'ATTRIBUTE'))
);

-- onde a dimensão vale: categoria inteira (subcategory_code = '') ou só uma subcategoria
CREATE TABLE taxonomy_dimension_scopes (
  dimension_code VARCHAR(30) NOT NULL,
  category_code VARCHAR(40) NOT NULL,
  subcategory_code VARCHAR(60) NOT NULL DEFAULT '',
  PRIMARY KEY (dimension_code, category_code, subcategory_code),
  CONSTRAINT fk_tax_scope_dim FOREIGN KEY (dimension_code) REFERENCES taxonomy_dimensions(code),
  CONSTRAINT fk_tax_scope_cat FOREIGN KEY (category_code) REFERENCES taxonomy_categories(code)
);

CREATE TABLE taxonomy_values (
  dimension_code VARCHAR(30) NOT NULL,
  code VARCHAR(60) NOT NULL,
  display_name_pt_br VARCHAR(80) NOT NULL,
  display_name_en VARCHAR(80) NOT NULL,
  tier VARCHAR(10) NOT NULL,
  priority TINYINT NOT NULL,
  value_group VARCHAR(30) NULL,
  hex CHAR(7) NULL,
  scope_json JSON NULL,                         -- categorias/subcategorias onde o valor vale (NULL = onde a dimensão vale)
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
  sort_order SMALLINT NOT NULL,
  PRIMARY KEY (dimension_code, code),
  CONSTRAINT fk_tax_val_dim FOREIGN KEY (dimension_code) REFERENCES taxonomy_dimensions(code),
  CONSTRAINT ck_tax_val_tier CHECK (tier IN ('CORE', 'EXTENDED', 'NICHE')),
  CONSTRAINT ck_tax_val_priority CHECK (priority BETWEEN 1 AND 5),
  CONSTRAINT ck_tax_val_status CHECK (status IN ('ACTIVE', 'LEGACY'))
);

-- alias → código (IA e busca). alias_norm usa a mesma normalização de CatalogNormalizer.key().
CREATE TABLE taxonomy_aliases (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(12) NOT NULL,             -- SUBCATEGORY | VARIATION | VALUE
  dimension_code VARCHAR(30) NOT NULL DEFAULT '',
  target_code VARCHAR(60) NOT NULL,
  scope_subcategory_code VARCHAR(60) NOT NULL DEFAULT '',
  alias VARCHAR(120) NOT NULL,
  alias_norm VARCHAR(120) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  source VARCHAR(12) NOT NULL DEFAULT 'CURATED',
  CONSTRAINT uq_tax_alias UNIQUE (target_type, dimension_code, scope_subcategory_code, alias_norm),
  CONSTRAINT ck_tax_alias_type CHECK (target_type IN ('SUBCATEGORY', 'VARIATION', 'VALUE')),
  CONSTRAINT ck_tax_alias_source CHECK (source IN ('CURATED', 'LEARNED')),
  INDEX idx_tax_alias_lookup (alias_norm, target_type)
);
