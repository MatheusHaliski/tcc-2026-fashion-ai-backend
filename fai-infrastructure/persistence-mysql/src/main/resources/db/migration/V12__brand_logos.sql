-- Bloco 11 — logos de marca procurados na internet pela IA do sistema (Wikidata → Claude com busca na web → ícone do
-- site oficial) e guardados no storage próprio. Chave = nome normalizado, para marcas do catálogo e texto livre.
CREATE TABLE brand_logos (
  id CHAR(36) PRIMARY KEY,
  name_key VARCHAR(160) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  logo_url VARCHAR(1024) NULL,
  source VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL,
  domain VARCHAR(255) NULL,
  origin_url VARCHAR(1024) NULL,
  confidence DECIMAL(5,4) NULL,
  attempts INT NOT NULL DEFAULT 0,
  checked_at DATETIME(6) NOT NULL,
  last_error VARCHAR(512) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uk_brand_logos_name UNIQUE (name_key)
);
-- job de nova tentativa: monogramas mais antigos primeiro
CREATE INDEX idx_brand_logos_status_checked ON brand_logos(status, checked_at);
