-- V6 — Dashboard gerencial (admin) e Explorador Global (RF26).
-- Índices para as consultas agrupadas por período, views de agregação e stored procedures de KPIs e séries.

-- tela personalizável: widgets do dashboard salvos por usuário
ALTER TABLE user_preferences ADD COLUMN dashboard_layout_json JSON NULL;

CREATE INDEX idx_users_created ON users(created_at);
CREATE INDEX idx_users_type_created ON users(profile_type, created_at);
CREATE INDEX idx_wardrobe_items_created ON wardrobe_items(created_at);
CREATE INDEX idx_wardrobe_items_brand ON wardrobe_items(brand_name);
CREATE INDEX idx_schemes_created ON schemes(created_at);
CREATE INDEX idx_ai_log_created_cap ON ai_inference_log(created_at, capability);
CREATE INDEX idx_daily_looks_date ON daily_looks(look_date);
CREATE INDEX idx_points_created ON fai_points_ledger(created_at, action_code);

-- RF26 — recorte por país (User.country herdado pelo dono do conteúdo)
CREATE OR REPLACE VIEW vw_country_insights AS
SELECT u.country AS country,
       COUNT(DISTINCT u.id) AS users,
       COUNT(DISTINCT s.id) AS public_schemes,
       ROUND(AVG(s.hype_score), 2) AS avg_hype
FROM users u
LEFT JOIN schemes s ON s.user_id = u.id AND s.visibility = 'PUBLIC' AND s.status = 'PUBLISHED'
WHERE u.country IS NOT NULL
GROUP BY u.country;

-- Uso de marcas no acervo (Insights globais e dashboard)
CREATE OR REPLACE VIEW vw_brand_usage AS
SELECT w.brand_name AS brand,
       COUNT(*) AS pieces,
       SUM(CASE WHEN w.visibility = 'PUBLIC' THEN 1 ELSE 0 END) AS public_pieces,
       COUNT(DISTINCT w.user_id) AS owners,
       ROUND(AVG(w.hype_score), 2) AS avg_hype
FROM wardrobe_items w
WHERE w.brand_name IS NOT NULL AND w.brand_name <> ''
GROUP BY w.brand_name;

DELIMITER $$

-- KPIs do período com filtros de país e tipo de perfil (uma linha)
CREATE PROCEDURE sp_admin_kpis(IN p_from DATETIME(6), IN p_to DATETIME(6), IN p_country VARCHAR(80), IN p_profile VARCHAR(20))
BEGIN
  SELECT
    (SELECT COUNT(*) FROM users u WHERE u.created_at BETWEEN p_from AND p_to
        AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)) AS new_users,
    (SELECT COUNT(DISTINCT d.user_id) FROM daily_looks d JOIN users u ON u.id = d.user_id
        WHERE d.look_date BETWEEN DATE(p_from) AND DATE(p_to)
        AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)) AS active_users,
    (SELECT COUNT(*) FROM wardrobe_items w JOIN users u ON u.id = w.user_id WHERE w.created_at BETWEEN p_from AND p_to
        AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)) AS pieces_created,
    (SELECT COUNT(*) FROM schemes s JOIN users u ON u.id = s.user_id WHERE s.created_at BETWEEN p_from AND p_to
        AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)) AS schemes_created,
    (SELECT COUNT(*) FROM schemes s JOIN users u ON u.id = s.user_id WHERE s.published_at BETWEEN p_from AND p_to
        AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)) AS schemes_published,
    (SELECT COUNT(*) FROM daily_looks d JOIN users u ON u.id = d.user_id WHERE d.look_date BETWEEN DATE(p_from) AND DATE(p_to)
        AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)) AS daily_looks,
    (SELECT COUNT(*) FROM ai_inference_log a WHERE a.created_at BETWEEN p_from AND p_to) AS ai_calls,
    (SELECT COALESCE(SUM(a.estimated_cost_usd), 0) FROM ai_inference_log a WHERE a.created_at BETWEEN p_from AND p_to) AS ai_cost_usd,
    (SELECT COALESCE(ROUND(100 * SUM(CASE WHEN a.fallback_used THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1), 0)
        FROM ai_inference_log a WHERE a.created_at BETWEEN p_from AND p_to) AS ai_fallback_pct,
    (SELECT COUNT(*) FROM moderation_queue m WHERE m.status = 'PENDING_REVIEW') AS moderation_pending,
    (SELECT COUNT(*) FROM seal_bonds b WHERE b.status = 'APPROVED' AND b.created_at BETWEEN p_from AND p_to) AS bonds_approved,
    (SELECT COUNT(*) FROM promotion_redemptions r WHERE r.redeemed_at BETWEEN p_from AND p_to) AS redemptions,
    (SELECT COALESCE(SUM(l.delta), 0) FROM fai_points_ledger l WHERE l.delta > 0 AND l.created_at BETWEEN p_from AND p_to) AS points_issued,
    (SELECT COUNT(*) FROM users u WHERE u.status = 'PENDING_VALIDATION') AS approvals_pending;
END$$

-- Série diária de uma métrica (dia, valor) — alimenta os gráficos de linha do dashboard
CREATE PROCEDURE sp_timeseries(IN p_metric VARCHAR(30), IN p_from DATETIME(6), IN p_to DATETIME(6), IN p_country VARCHAR(80), IN p_profile VARCHAR(20))
BEGIN
  IF p_metric = 'users' THEN
    SELECT DATE(u.created_at) AS day, COUNT(*) AS value FROM users u
    WHERE u.created_at BETWEEN p_from AND p_to AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)
    GROUP BY DATE(u.created_at) ORDER BY day;
  ELSEIF p_metric = 'pieces' THEN
    SELECT DATE(w.created_at) AS day, COUNT(*) AS value FROM wardrobe_items w JOIN users u ON u.id = w.user_id
    WHERE w.created_at BETWEEN p_from AND p_to AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)
    GROUP BY DATE(w.created_at) ORDER BY day;
  ELSEIF p_metric = 'schemes' THEN
    SELECT DATE(s.created_at) AS day, COUNT(*) AS value FROM schemes s JOIN users u ON u.id = s.user_id
    WHERE s.created_at BETWEEN p_from AND p_to AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)
    GROUP BY DATE(s.created_at) ORDER BY day;
  ELSEIF p_metric = 'daily_looks' THEN
    SELECT d.look_date AS day, COUNT(*) AS value FROM daily_looks d JOIN users u ON u.id = d.user_id
    WHERE d.look_date BETWEEN DATE(p_from) AND DATE(p_to) AND (p_country IS NULL OR u.country = p_country) AND (p_profile IS NULL OR u.profile_type = p_profile)
    GROUP BY d.look_date ORDER BY day;
  ELSEIF p_metric = 'ai_cost' THEN
    SELECT DATE(a.created_at) AS day, ROUND(COALESCE(SUM(a.estimated_cost_usd), 0), 4) AS value FROM ai_inference_log a
    WHERE a.created_at BETWEEN p_from AND p_to GROUP BY DATE(a.created_at) ORDER BY day;
  ELSE
    SELECT DATE(a.created_at) AS day, COUNT(*) AS value FROM ai_inference_log a
    WHERE a.created_at BETWEEN p_from AND p_to GROUP BY DATE(a.created_at) ORDER BY day;
  END IF;
END$$

-- RF3.CA18 — expurgo de notificações com mais de N dias (job periódico)
CREATE PROCEDURE sp_purge_notifications(IN p_days INT)
BEGIN
  DELETE FROM notifications WHERE created_at < (NOW(6) - INTERVAL p_days DAY);
  SELECT ROW_COUNT() AS removed;
END$$

DELIMITER ;
