-- RF40 · Meu Avatar 3D: rosto e busto 3D da própria pessoa, reconstruídos no navegador a partir das fotos
-- (468 pontos do rosto em pose neutra, tom de pele e cabelo medidos) e confirmados por ela. A textura do rosto é
-- dado biométrico: fica no storage numa chave privada (restricted/) e só sai pela API, para quem pode ver.
CREATE TABLE user_avatars_3d (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  model_version INT NOT NULL,
  model_json JSON NOT NULL,                       -- {v, shape[1404], skin, hair, metrics, views, warnings}
  adjust_json JSON NULL,                          -- ajustes finos: {headScale, neck, hairVolume, skinLight}
  texture_key VARCHAR(512) NOT NULL,              -- chave do atlas do rosto no storage (restricted/users/<id>/avatar3d/...)
  photos_count INT NOT NULL DEFAULT 1,            -- quantas fotos entraram (1 = profundidade estimada)
  warnings_json JSON NULL,                        -- códigos do filtro de qualidade que ficaram como aviso
  public_on_runway BOOLEAN NOT NULL DEFAULT TRUE, -- outras pessoas veem o avatar na Passarela/vitrines públicas
  consent_at DATETIME(6) NOT NULL,                -- consentimento explícito para uso do rosto no avatar (LGPD)
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_avatar3d_user FOREIGN KEY (user_id) REFERENCES users(id)
);
