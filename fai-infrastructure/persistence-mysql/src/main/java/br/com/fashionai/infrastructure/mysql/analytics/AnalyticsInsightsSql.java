package br.com.fashionai.infrastructure.mysql.analytics;

/**
 * Texto SQL (MySQL) das consultas de insights do {@link MysqlAnalyticsAdapter}: uso de IA, marcas, países, cores,
 * estações, faixas do inventário, selos, desafios, pontos e filtros globais do mapa. Só constantes: o binding dos
 * parâmetros nomeados ({@code :from}, {@code :to}, {@code :country}, {@code :profile}, {@code :season}, {@code :color},
 * {@code :limit}, {@code :owner}) e a execução continuam no adapter. O texto é congelado por
 * {@code MysqlAnalyticsSqlCharacterizationTest}.
 */
final class AnalyticsInsightsSql {
    private AnalyticsInsightsSql() {
    }

    static final String KPIS = "CALL sp_admin_kpis(:from, :to, :country, :profile)";
    static final String SERIES = "CALL sp_timeseries(:metric, :from, :to, :country, :profile)";
    static final String AI_COST_BY_COUNTRY = "CALL sp_ai_cost_by_country(:from, :to, :profile)";
    static final String PURGE_NOTIFICATIONS = "CALL sp_purge_notifications(:days)";

    static final String AI_USAGE = """
                SELECT capability, provider, result, COUNT(*) AS calls, ROUND(COALESCE(SUM(estimated_cost_usd), 0), 4) AS cost_usd,
                       ROUND(AVG(latency_ms)) AS avg_latency_ms, SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) AS fallbacks
                FROM ai_inference_log a WHERE a.created_at BETWEEN :from AND :to
                  AND (:country IS NULL AND :profile IS NULL OR EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id
                       AND (:country IS NULL OR u.country = :country) AND (:profile IS NULL OR u.profile_type = :profile)))
                GROUP BY capability, provider, result ORDER BY calls DESC""";

    static final String BRAND_USAGE =
            "SELECT brand, pieces, public_pieces, owners FROM vw_brand_usage ORDER BY pieces DESC LIMIT :limit";

    static final String COUNTRIES =
            "SELECT country, users, public_schemes FROM vw_country_insights ORDER BY public_schemes DESC, users DESC";

    static final String COUNTRY_COLORS = """
                SELECT u.country AS country, w.color AS color, COUNT(*) AS total
                FROM wardrobe_items w JOIN users u ON u.id = w.user_id
                WHERE u.country IS NOT NULL AND w.color IS NOT NULL AND w.visibility = 'PUBLIC'
                GROUP BY u.country, w.color ORDER BY u.country, total DESC""";

    static final String LOOKS_BY_SEASON = """
                SELECT s.season AS season, COUNT(*) AS total
                FROM schemes s JOIN users u ON u.id = s.user_id
                WHERE s.visibility = 'PUBLIC' AND s.status = 'PUBLISHED' AND s.season IS NOT NULL AND (:country IS NULL OR u.country = :country)
                GROUP BY s.season ORDER BY total DESC""";

    static final String COLOR_RANKING = """
                SELECT w.color AS color, COUNT(*) AS total
                FROM wardrobe_items w JOIN users u ON u.id = w.user_id
                WHERE w.visibility = 'PUBLIC' AND w.color IS NOT NULL AND (:country IS NULL OR u.country = :country)
                GROUP BY w.color ORDER BY total DESC LIMIT :limit""";

    static final String INVENTORY_BANDS = """
                SELECT CASE WHEN score < 300 THEN 'EM_MONTAGEM' WHEN score < 500 THEN 'ORGANIZADO' WHEN score < 650 THEN 'VERSATIL'
                            WHEN score < 800 THEN 'BEM_CURADO' WHEN score < 900 THEN 'CLOSET_INTELIGENTE' WHEN score < 960 THEN 'SIGNATURE_CLOSET'
                            ELSE 'MAISON_CLOSET' END AS band, COUNT(*) AS total
                FROM inventory_score_snapshots s
                WHERE s.period_type = 'DAY' AND s.eligible = TRUE AND s.score IS NOT NULL
                  AND s.period_date = (SELECT MAX(x.period_date) FROM inventory_score_snapshots x WHERE x.user_id = s.user_id AND x.period_type = 'DAY')
                GROUP BY band ORDER BY MIN(score)""";

    static final String SEAL_FUNNEL =
            "SELECT status, COUNT(*) AS total FROM seal_bonds WHERE created_at BETWEEN :from AND :to GROUP BY status ORDER BY total DESC";

    static final String CHALLENGE_STATS = """
                SELECT i.template_code AS template, i.state AS state, COUNT(*) AS instances,
                       (SELECT COUNT(*) FROM challenge_participants p WHERE p.instance_id IN (SELECT id FROM challenge_instances x WHERE x.template_code = i.template_code)
                          AND p.status IN ('ATIVO', 'CONCLUIU')) AS participants
                FROM challenge_instances i GROUP BY i.template_code, i.state ORDER BY i.template_code, i.state""";

    static final String POINTS_BY_ACTION = """
                SELECT action_code, COUNT(*) AS entries, SUM(delta) AS points FROM fai_points_ledger
                WHERE created_at BETWEEN :from AND :to GROUP BY action_code ORDER BY points DESC""";

    static final String USERS_BY_PROFILE = """
                SELECT profile_type, status, COUNT(*) AS total FROM users
                WHERE (:country IS NULL OR country = :country) GROUP BY profile_type, status ORDER BY profile_type, status""";

    static final String BOND_SERIES = """
                SELECT DATE(created_at) AS day, status, COUNT(*) AS total FROM seal_bonds
                WHERE target_owner_user_id = :owner AND created_at BETWEEN :from AND :to
                GROUP BY DATE(created_at), status ORDER BY day""";

    static final String SCHEMES_BY_COUNTRY = """
                SELECT u.country AS country, COUNT(*) AS schemes
                FROM schemes s JOIN users u ON u.id = s.user_id
                WHERE s.visibility = 'PUBLIC' AND s.status = 'PUBLISHED' AND u.country IS NOT NULL
                  AND (:season IS NULL OR s.season = :season)
                  AND (:color IS NULL OR EXISTS (SELECT 1 FROM scheme_items si JOIN wardrobe_items w ON w.id = si.wardrobe_item_id
                                                 WHERE si.scheme_id = s.id AND w.color = :color))
                GROUP BY u.country""";

    static final String PIECES_BY_COUNTRY = """
                SELECT u.country AS country, COUNT(*) AS pieces
                FROM wardrobe_items w JOIN users u ON u.id = w.user_id
                WHERE w.visibility = 'PUBLIC' AND u.country IS NOT NULL
                  AND (:season IS NULL OR LOWER(w.market) = LOWER(:season))
                  AND (:color IS NULL OR w.color = :color)
                GROUP BY u.country""";

    static final String BRAND_FACETS = """
                SELECT LOWER(w.brand_name) AS brand, COUNT(*) AS pieces,
                       GROUP_CONCAT(DISTINCT w.color) AS colors, GROUP_CONCAT(DISTINCT LOWER(w.market)) AS seasons
                FROM wardrobe_items w WHERE w.brand_name IS NOT NULL AND w.brand_name <> ''
                GROUP BY LOWER(w.brand_name)""";
}
