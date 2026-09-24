-- Bloco 7 — Dashboard gerencial: pergunta "em qual país a IA custa mais por usuário?".
-- Índice de cobertura para o recorte por período (created_at) que já traz user_id, custo e fallback sem ler a linha, e
-- procedure que agrupa custo e chamadas de IA por país do usuário (User.country), com filtro de tipo de perfil.

CREATE INDEX idx_ai_log_created_user_cost ON ai_inference_log(created_at, user_id, estimated_cost_usd, fallback_used);

-- Faixas de Hype do dashboard filtradas por país/perfil (junção com users.id + filtro de publicação)
CREATE INDEX idx_schemes_visibility_hype ON schemes(visibility, hype_score, user_id);

DELIMITER $$

CREATE PROCEDURE sp_ai_cost_by_country(IN p_from DATETIME(6), IN p_to DATETIME(6), IN p_profile VARCHAR(20))
BEGIN
  SELECT u.country AS country,
         COUNT(DISTINCT a.user_id) AS users,
         COUNT(*) AS calls,
         ROUND(COALESCE(SUM(a.estimated_cost_usd), 0), 4) AS cost_usd,
         ROUND(COALESCE(SUM(a.estimated_cost_usd), 0) / NULLIF(COUNT(DISTINCT a.user_id), 0), 4) AS cost_per_user,
         ROUND(100 * SUM(CASE WHEN a.fallback_used THEN 1 ELSE 0 END) / COUNT(*), 1) AS fallback_pct
  FROM ai_inference_log a
  JOIN users u ON u.id = a.user_id
  WHERE a.created_at BETWEEN p_from AND p_to
    AND u.country IS NOT NULL
    AND (p_profile IS NULL OR u.profile_type = p_profile)
  GROUP BY u.country
  ORDER BY cost_per_user DESC, calls DESC;
END$$

DELIMITER ;
