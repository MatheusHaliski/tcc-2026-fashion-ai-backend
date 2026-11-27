-- ACERVO (docs/acervo/ACERVO.md): o guarda-roupa como espaço navegável. Tudo aqui é privado da dona das peças.
-- ambiente → móvel (com a configuração do armário) → compartimento (cabideiro, prateleira ou gaveta) → lugar da peça.
-- A lista de desejos fica separada das peças compradas; o preço dela é sempre uma estimativa.

CREATE TABLE acervo_ambientes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    INDEX ix_acervo_ambiente_user (user_id, ordem),
    CONSTRAINT fk_acervo_ambiente_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- modo: MEU_ESPACO (medidas reais) ou DREAM_SPACE (projeto imaginado). Medidas em centímetros.
CREATE TABLE acervo_moveis (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    ambiente_id CHAR(36) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    modo VARCHAR(16) NOT NULL,
    largura_cm INT NOT NULL,
    altura_cm INT NOT NULL,
    profundidade_cm INT NOT NULL,
    material VARCHAR(16) NOT NULL,
    cor VARCHAR(24) NOT NULL,
    porta VARCHAR(16) NOT NULL,
    puxador VARCHAR(16) NOT NULL,
    puxador_acabamento VARCHAR(16) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    INDEX ix_acervo_movel_ambiente (ambiente_id, ordem),
    INDEX ix_acervo_movel_user (user_id),
    CONSTRAINT fk_acervo_movel_ambiente FOREIGN KEY (ambiente_id) REFERENCES acervo_ambientes (id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- tipo: CABIDEIRO, PRATELEIRA ou GAVETA; ordem é a posição dentro do móvel.
CREATE TABLE acervo_compartimentos (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    movel_id CHAR(36) NOT NULL,
    tipo VARCHAR(16) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    INDEX ix_acervo_compartimento_movel (movel_id, ordem),
    INDEX ix_acervo_compartimento_user (user_id),
    CONSTRAINT fk_acervo_compartimento_movel FOREIGN KEY (movel_id) REFERENCES acervo_moveis (id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Uma linha por peça: o compartimento onde ela está (NULL = sem lugar) e as medidas que a dona anotou.
CREATE TABLE acervo_pecas (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    piece_id CHAR(36) NOT NULL,
    compartimento_id CHAR(36) NULL,
    largura_cm DECIMAL(6, 1) NULL,
    comprimento_cm DECIMAL(6, 1) NULL,
    medidas_nota VARCHAR(160) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    UNIQUE KEY uk_acervo_peca_piece (piece_id),
    INDEX ix_acervo_peca_user (user_id),
    INDEX ix_acervo_peca_compartimento (compartimento_id),
    CONSTRAINT fk_acervo_peca_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_acervo_peca_compartimento FOREIGN KEY (compartimento_id) REFERENCES acervo_compartimentos (id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Lista de desejos: peça que a pessoa ainda não tem. preco_estimado é uma estimativa informada por ela.
CREATE TABLE acervo_desejos (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    categoria VARCHAR(80) NOT NULL,
    cor VARCHAR(80) NULL,
    tamanho VARCHAR(40) NULL,
    marca VARCHAR(160) NULL,
    preco_estimado DECIMAL(10, 2) NULL,
    moeda CHAR(3) NOT NULL DEFAULT 'BRL',
    compartimento_id CHAR(36) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    INDEX ix_acervo_desejo_user (user_id, created_at),
    CONSTRAINT fk_acervo_desejo_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_acervo_desejo_compartimento FOREIGN KEY (compartimento_id) REFERENCES acervo_compartimentos (id) ON DELETE SET NULL ON UPDATE CASCADE
);
