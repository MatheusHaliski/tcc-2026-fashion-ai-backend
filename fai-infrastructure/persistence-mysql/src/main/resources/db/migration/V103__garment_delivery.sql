-- FashionAI Garment Delivery (docs/garment-delivery/GARMENT_DELIVERY.md): encomenda de uma peça desenhada no Atelier à
-- Fábrica FashionAI, que é fictícia. Simulação: nenhum pagamento, nenhuma peça física; da entrega só ficam os 5
-- primeiros dígitos do CEP, a região e um apelido opcional.

-- Projeto e revisão sem FK: a encomenda guarda o snapshot da ficha e sobrevive ao projeto de origem.
-- status é só o índice da varredura; o estado real vem do plano (plan_json) contra o relógio.
CREATE TABLE garment_orders (
    id CHAR(36) NOT NULL PRIMARY KEY,
    owner_id CHAR(36) NOT NULL,
    project_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    revision_number INT NOT NULL,
    project_title VARCHAR(160) NOT NULL,
    spec_digest CHAR(64) NOT NULL,
    spec_snapshot_json LONGTEXT NOT NULL,
    quote_json LONGTEXT NOT NULL,
    plan_json VARCHAR(4000) NOT NULL,
    size_label VARCHAR(8) NOT NULL,
    speed VARCHAR(12) NOT NULL,
    cep_prefix CHAR(5) NOT NULL,
    region VARCHAR(8) NOT NULL,
    delivery_label VARCHAR(40) NULL,
    price_total DECIMAL(10, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BRL',
    serial_number VARCHAR(20) NOT NULL,
    lot_code VARCHAR(24) NOT NULL,
    tracking_code VARCHAR(24) NOT NULL,
    status VARCHAR(20) NOT NULL,
    placed_at DATETIME(6) NOT NULL,
    cancelled_at DATETIME(6) NULL,
    received_at DATETIME(6) NULL,
    piece_id CHAR(36) NULL,
    request_id VARCHAR(80) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_garment_order_request UNIQUE (owner_id, request_id),
    CONSTRAINT uq_garment_order_serial UNIQUE (serial_number),
    INDEX ix_garment_order_owner (owner_id, placed_at),
    INDEX ix_garment_order_status (status, placed_at),
    CONSTRAINT fk_garment_order_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_garment_order_piece FOREIGN KEY (piece_id) REFERENCES wardrobe_items (id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Uma linha por encomenda e etapa: gravar a mesma etapa de novo (leitura e varredura ao mesmo tempo) é impossível.
CREATE TABLE garment_order_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    stage VARCHAR(20) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_garment_order_event UNIQUE (order_id, stage),
    CONSTRAINT fk_garment_order_event_order FOREIGN KEY (order_id) REFERENCES garment_orders (id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Registro de fabricação no passaporte da peça recebida (série, lote, revisão de origem, medidas, etiqueta).
ALTER TABLE garment_passports ADD COLUMN manufacturing_json LONGTEXT NULL;

-- Tipos de lavagem da etiqueta de cuidados; só entram quando o código ainda não existe (opções já cadastradas ficam).
INSERT INTO `TipoLavagem` (id, codigo, nome, created_at, updated_at)
SELECT UUID(), 'MAQUINA_40', 'Máquina até 40 °C', NOW(6), NOW(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `TipoLavagem` WHERE codigo = 'MAQUINA_40');

INSERT INTO `TipoLavagem` (id, codigo, nome, created_at, updated_at)
SELECT UUID(), 'MAQUINA_30_DELICADO', 'Máquina até 30 °C, ciclo delicado', NOW(6), NOW(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `TipoLavagem` WHERE codigo = 'MAQUINA_30_DELICADO');

INSERT INTO `TipoLavagem` (id, codigo, nome, created_at, updated_at)
SELECT UUID(), 'LAVAR_A_MAO', 'Lavar à mão, até 30 °C', NOW(6), NOW(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `TipoLavagem` WHERE codigo = 'LAVAR_A_MAO');

INSERT INTO `TipoLavagem` (id, codigo, nome, created_at, updated_at)
SELECT UUID(), 'NAO_LAVAR', 'Não lavar: limpeza profissional', NOW(6), NOW(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `TipoLavagem` WHERE codigo = 'NAO_LAVAR');
