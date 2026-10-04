-- HypeScore v2 (docs/hype/HYPESCORE_ARCHITECTURE.md) — HypeScore(entidade, tempo).
--
-- O v1 (RF6, HypeScoreService) continua dono das colunas hype_score/hype_score_global das entidades e do painel do
-- Look do Dia. O v2 grava aqui, sempre com algorithm_version, sem sobrescrever o histórico:
--   hype_signal_daily     agregado diário de sinais por entidade (EntityInteractionAggregate), alimentado por eventos
--   hype_scores           estado atual por entidade e versão do algoritmo (read model lido pelos cards em lote)
--   hype_score_snapshots  série histórica (1 linha por entidade/versão/dia) para gráficos e deltas

CREATE TABLE hype_signal_daily (
  id CHAR(36) PRIMARY KEY,
  entity_type VARCHAR(10) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  signal_type VARCHAR(30) NOT NULL,
  signal_date DATE NOT NULL,
  event_count INT NOT NULL DEFAULT 0,
  weighted_count DECIMAL(12,3) NOT NULL DEFAULT 0,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_hype_signal_daily UNIQUE (entity_type, entity_id, signal_type, signal_date)
);
CREATE INDEX idx_hype_signal_window ON hype_signal_daily(entity_type, signal_date);

CREATE TABLE hype_scores (
  id CHAR(36) PRIMARY KEY,
  entity_type VARCHAR(10) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NULL,
  algorithm_version VARCHAR(20) NOT NULL,
  status VARCHAR(24) NOT NULL,
  score DECIMAL(6,2) NULL,
  level VARCHAR(20) NULL,
  popularity_score DECIMAL(6,2) NULL,
  engagement_score DECIMAL(6,2) NULL,
  trend_score DECIMAL(6,2) NULL,
  trend_velocity_score DECIMAL(6,2) NULL,
  novelty_score DECIMAL(6,2) NULL,
  longevity_score DECIMAL(6,2) NULL,
  rarity_score DECIMAL(6,2) NULL,
  originality_score DECIMAL(6,2) NULL,
  influence_score DECIMAL(6,2) NULL,
  delta_points DECIMAL(7,2) NULL,
  delta_percent DECIMAL(8,2) NULL,
  direction VARCHAR(10) NULL,
  momentum VARCHAR(20) NULL,
  public_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  category VARCHAR(40) NULL,
  styles VARCHAR(255) NULL,
  occasions VARCHAR(255) NULL,
  signals_json JSON NULL,
  reasons_json JSON NULL,
  window_start DATETIME(6) NOT NULL,
  window_end DATETIME(6) NOT NULL,
  calculated_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_hype_scores UNIQUE (entity_type, entity_id, algorithm_version)
);
CREATE INDEX idx_hype_scores_rank ON hype_scores(entity_type, algorithm_version, public_eligible, score);
CREATE INDEX idx_hype_scores_owner ON hype_scores(owner_id, entity_type, algorithm_version);

CREATE TABLE hype_score_snapshots (
  id CHAR(36) PRIMARY KEY,
  entity_type VARCHAR(10) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  algorithm_version VARCHAR(20) NOT NULL,
  snapshot_date DATE NOT NULL,
  status VARCHAR(24) NOT NULL,
  score DECIMAL(6,2) NULL,
  level VARCHAR(20) NULL,
  popularity_score DECIMAL(6,2) NULL,
  engagement_score DECIMAL(6,2) NULL,
  trend_score DECIMAL(6,2) NULL,
  trend_velocity_score DECIMAL(6,2) NULL,
  novelty_score DECIMAL(6,2) NULL,
  longevity_score DECIMAL(6,2) NULL,
  rarity_score DECIMAL(6,2) NULL,
  originality_score DECIMAL(6,2) NULL,
  influence_score DECIMAL(6,2) NULL,
  public_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  window_start DATETIME(6) NOT NULL,
  window_end DATETIME(6) NOT NULL,
  calculated_at DATETIME(6) NOT NULL,
  CONSTRAINT uq_hype_snapshot_day UNIQUE (entity_type, entity_id, algorithm_version, snapshot_date)
);
CREATE INDEX idx_hype_snapshot_entity ON hype_score_snapshots(entity_type, entity_id, algorithm_version, snapshot_date);

-- ---------- backfill dos sinais a partir das tabelas que já têm data ----------
-- Interação consigo mesmo não conta (antimanipulação: self-like farming). Visualizações não têm histórico com data
-- e começam a contar a partir desta versão.

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'PIECE', r.target_id, 'LIKE_CREATED', DATE(r.created_at), COUNT(*), COUNT(*), NOW(6)
FROM reactions r JOIN wardrobe_items w ON w.id = r.target_id
WHERE r.target_type = 'PIECE' AND r.reaction_type = 'LIKE' AND r.actor_user_id <> w.user_id
GROUP BY r.target_id, DATE(r.created_at);

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'SCHEME', r.target_id, 'LIKE_CREATED', DATE(r.created_at), COUNT(*), COUNT(*), NOW(6)
FROM reactions r JOIN schemes s ON s.id = r.target_id
WHERE r.target_type = 'SCHEME' AND r.reaction_type = 'LIKE' AND r.actor_user_id <> s.user_id
GROUP BY r.target_id, DATE(r.created_at);

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'PIECE', c.target_id, 'COMMENT_CREATED', DATE(c.created_at), COUNT(*), COUNT(*), NOW(6)
FROM comments c JOIN wardrobe_items w ON w.id = c.target_id
WHERE c.target_type = 'PIECE' AND c.active = TRUE AND c.author_user_id <> w.user_id
GROUP BY c.target_id, DATE(c.created_at);

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'SCHEME', c.target_id, 'COMMENT_CREATED', DATE(c.created_at), COUNT(*), COUNT(*), NOW(6)
FROM comments c JOIN schemes s ON s.id = c.target_id
WHERE c.target_type = 'SCHEME' AND c.active = TRUE AND c.author_user_id <> s.user_id
GROUP BY c.target_id, DATE(c.created_at);

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'PIECE', x.target_id, 'SHARE_CREATED', DATE(x.created_at), COUNT(*), COUNT(*), NOW(6)
FROM shares x JOIN wardrobe_items w ON w.id = x.target_id
WHERE x.target_type = 'PIECE' AND x.user_id <> w.user_id
GROUP BY x.target_id, DATE(x.created_at);

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'SCHEME', x.target_id, 'SHARE_CREATED', DATE(x.created_at), COUNT(*), COUNT(*), NOW(6)
FROM shares x JOIN schemes s ON s.id = x.target_id
WHERE x.target_type = 'SCHEME' AND x.user_id <> s.user_id
GROUP BY x.target_id, DATE(x.created_at);

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'PIECE', v.target_id, 'SAVE_CREATED', DATE(v.saved_at), COUNT(*), COUNT(*), NOW(6)
FROM saved_items v JOIN wardrobe_items w ON w.id = v.target_id
WHERE v.target_type = 'PIECE' AND v.user_id <> w.user_id
GROUP BY v.target_id, DATE(v.saved_at);

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'SCHEME', v.target_id, 'SAVE_CREATED', DATE(v.saved_at), COUNT(*), COUNT(*), NOW(6)
FROM saved_items v JOIN schemes s ON s.id = v.target_id
WHERE v.target_type = 'SCHEME' AND v.user_id <> s.user_id
GROUP BY v.target_id, DATE(v.saved_at);

-- remix de look: o look derivado aponta para o original (original_scheme_id); remix de si mesmo não conta
INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'SCHEME', d.original_scheme_id, 'LOOK_REMIXED', DATE(d.created_at), COUNT(*), COUNT(*), NOW(6)
FROM schemes d JOIN schemes o ON o.id = d.original_scheme_id
WHERE d.original_scheme_id IS NOT NULL AND d.user_id <> o.user_id
GROUP BY d.original_scheme_id, DATE(d.created_at);

-- uso: diário de uso da peça (vestiu) e look do dia (usou o look)
INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'PIECE', u.wardrobe_item_id, 'PIECE_USED', u.used_on, COUNT(*), COUNT(*), NOW(6)
FROM piece_usage_diary u
GROUP BY u.wardrobe_item_id, u.used_on;

INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'SCHEME', d.scheme_id, 'LOOK_WORN', d.look_date, COUNT(*), COUNT(*), NOW(6)
FROM daily_looks d
GROUP BY d.scheme_id, d.look_date;

-- aparição da peça em looks (PieceHype: "aparições em looks"), no dia em que o look foi criado
INSERT INTO hype_signal_daily (id, entity_type, entity_id, signal_type, signal_date, event_count, weighted_count, updated_at)
SELECT UUID(), 'PIECE', si.wardrobe_item_id, 'PIECE_IN_LOOK', DATE(s.created_at), COUNT(*), COUNT(*), NOW(6)
FROM scheme_items si JOIN schemes s ON s.id = si.scheme_id
GROUP BY si.wardrobe_item_id, DATE(s.created_at);
