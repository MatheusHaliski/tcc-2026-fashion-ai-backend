-- RF32: PASSA O LOOK é um tipo de trend, não um RF independente.
CREATE TABLE IF NOT EXISTS community_trends (
    id CHAR(36) NOT NULL PRIMARY KEY,
    author_id CHAR(36) NOT NULL,
    title VARCHAR(80) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    duration_days INT NOT NULL,
    published_at DATETIME(6) NULL,
    ends_at DATETIME(6) NULL,
    awarded_points INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT fk_trend_author FOREIGN KEY (author_id) REFERENCES users(id),
    INDEX idx_trend_publication (status, published_at, id),
    INDEX idx_trend_kind (status, kind, ends_at)
);
INSERT IGNORE INTO fai_points_rules (action_code, points, daily_cap, weekly_cap, once_per_ref, active, description)
VALUES ('TREND_PUBLISHED', 20, 3, 10, TRUE, TRUE, 'Publicar uma trend da comunidade: uma vez por trend, até 3 por dia e 10 por semana.');
