-- Orientação "Como funciona" (docs/ux/ORIENTACAO.md): preferência por pessoa, por tutorial e por versão, no servidor
-- (vale em qualquer aparelho e não vaza para outra conta). "Não mostrar novamente" esconde só aquele tutorial.
CREATE TABLE user_guides (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  guide_key VARCHAR(60) NOT NULL,
  version INT NOT NULL,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  auto_count INT NOT NULL DEFAULT 0,
  last_shown_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_user_guide UNIQUE (user_id, guide_key),
  CONSTRAINT fk_user_guide_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
