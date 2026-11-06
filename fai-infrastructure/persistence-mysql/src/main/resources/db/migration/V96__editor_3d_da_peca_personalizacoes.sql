-- RF — editor 3D da peça: personalização visual por pessoa, vinculada à peça original, sem alterar o GLB nem
-- medidas oficiais, tamanhos comerciais ou dados do passaporte.

CREATE TABLE piece_3d_customizations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    piece_id CHAR(36) NOT NULL,
    owner_id CHAR(36) NOT NULL,
    base_model_url VARCHAR(1024) NOT NULL,
    document_json LONGTEXT NOT NULL,
    revision BIGINT NOT NULL DEFAULT 0,
    request_id VARCHAR(80) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_piece_customization_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id),
    CONSTRAINT uq_piece_customization UNIQUE (piece_id, owner_id)
);
