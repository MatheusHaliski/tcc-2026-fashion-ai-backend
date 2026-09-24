package br.com.fashionai.infrastructure.mysql.analytics;

import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.ports.AnalyticsQueryPort.GlobalFilter;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Consultas agrupadas do dashboard e do Explorador (V6): stored procedures (sp_admin_kpis, sp_timeseries,
 * sp_purge_notifications), views (vw_country_insights, vw_brand_usage) e GROUP BY diretos. Só leitura, exceto o expurgo.
 */
@Component
public class MysqlAnalyticsAdapter implements AnalyticsQueryPort {
    private final NamedParameterJdbcTemplate jdbc;

    public MysqlAnalyticsAdapter(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static MapSqlParameterSource params(Filter f) {
        return new MapSqlParameterSource().addValue("from", Timestamp.from(f.from())).addValue("to", Timestamp.from(f.to()))
                .addValue("country", f.country()).addValue("profile", f.profileType());
    }

    @Override
    public Map<String, Object> kpis(Filter f) {
        List<Map<String, Object>> rows = jdbc.queryForList("CALL sp_admin_kpis(:from, :to, :country, :profile)", params(f));
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    @Override
    public List<Map<String, Object>> series(String metric, Filter f) {
        return jdbc.queryForList("CALL sp_timeseries(:metric, :from, :to, :country, :profile)", params(f).addValue("metric", metric));
    }

    @Override
    public List<Map<String, Object>> aiUsage(Filter f) {
        return jdbc.queryForList("""
                SELECT capability, provider, result, COUNT(*) AS calls, ROUND(COALESCE(SUM(estimated_cost_usd), 0), 4) AS cost_usd,
                       ROUND(AVG(latency_ms)) AS avg_latency_ms, SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) AS fallbacks
                FROM ai_inference_log a WHERE a.created_at BETWEEN :from AND :to
                  AND (:country IS NULL AND :profile IS NULL OR EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id
                       AND (:country IS NULL OR u.country = :country) AND (:profile IS NULL OR u.profile_type = :profile)))
                GROUP BY capability, provider, result ORDER BY calls DESC""", params(f));
    }

    @Override
    public List<Map<String, Object>> aiCostByCountry(Filter f) {
        return jdbc.queryForList("CALL sp_ai_cost_by_country(:from, :to, :profile)", params(f));
    }

    @Override
    public List<Map<String, Object>> brandUsage(int limit) {
        return jdbc.queryForList("SELECT brand, pieces, public_pieces, owners, avg_hype FROM vw_brand_usage ORDER BY pieces DESC LIMIT :limit",
                new MapSqlParameterSource("limit", limit));
    }

    @Override
    public List<Map<String, Object>> countries() {
        return jdbc.queryForList("SELECT country, users, public_schemes, avg_hype FROM vw_country_insights ORDER BY public_schemes DESC, users DESC",
                new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> countryColors() {
        return jdbc.queryForList("""
                SELECT u.country AS country, w.color AS color, COUNT(*) AS total
                FROM wardrobe_items w JOIN users u ON u.id = w.user_id
                WHERE u.country IS NOT NULL AND w.color IS NOT NULL AND w.visibility = 'PUBLIC'
                GROUP BY u.country, w.color ORDER BY u.country, total DESC""", new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> hypeBySeason(String country) {
        return jdbc.queryForList("""
                SELECT s.season AS season, ROUND(AVG(s.hype_score), 1) AS avg_hype, COUNT(*) AS total
                FROM schemes s JOIN users u ON u.id = s.user_id
                WHERE s.visibility = 'PUBLIC' AND s.status = 'PUBLISHED' AND s.season IS NOT NULL AND (:country IS NULL OR u.country = :country)
                GROUP BY s.season ORDER BY avg_hype DESC""", new MapSqlParameterSource("country", country));
    }

    @Override
    public List<Map<String, Object>> colorRanking(String country, int limit) {
        return jdbc.queryForList("""
                SELECT w.color AS color, COUNT(*) AS total, ROUND(AVG(w.hype_score), 1) AS avg_hype
                FROM wardrobe_items w JOIN users u ON u.id = w.user_id
                WHERE w.visibility = 'PUBLIC' AND w.color IS NOT NULL AND (:country IS NULL OR u.country = :country)
                GROUP BY w.color ORDER BY total DESC LIMIT :limit""", new MapSqlParameterSource("country", country).addValue("limit", limit));
    }

    @Override
    public List<Map<String, Object>> hypeBands() {
        return jdbc.queryForList("""
                SELECT CASE WHEN hype_score < 15 THEN 'DESPRETENSIOSO' WHEN hype_score < 30 THEN 'EM_CONSTRUCAO' WHEN hype_score < 50 THEN 'NOTADO'
                            WHEN hype_score < 70 THEN 'COM_ESTILO' WHEN hype_score < 85 THEN 'MUITO_ESTILOSO' WHEN hype_score < 96 THEN 'ARRASANDO_NO_LOOK'
                            ELSE 'ICONE_DE_ESTILO' END AS band, COUNT(*) AS total
                FROM schemes WHERE hype_score IS NOT NULL AND visibility = 'PUBLIC' GROUP BY band ORDER BY MIN(hype_score)""", new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> hypeBands(Filter f) {
        if (f.country() == null && f.profileType() == null) {
            return hypeBands();
        }
        return jdbc.queryForList("""
                SELECT CASE WHEN s.hype_score < 15 THEN 'DESPRETENSIOSO' WHEN s.hype_score < 30 THEN 'EM_CONSTRUCAO' WHEN s.hype_score < 50 THEN 'NOTADO'
                            WHEN s.hype_score < 70 THEN 'COM_ESTILO' WHEN s.hype_score < 85 THEN 'MUITO_ESTILOSO' WHEN s.hype_score < 96 THEN 'ARRASANDO_NO_LOOK'
                            ELSE 'ICONE_DE_ESTILO' END AS band, COUNT(*) AS total
                FROM schemes s JOIN users u ON u.id = s.user_id
                WHERE s.hype_score IS NOT NULL AND s.visibility = 'PUBLIC'
                  AND (:country IS NULL OR u.country = :country) AND (:profile IS NULL OR u.profile_type = :profile)
                GROUP BY band ORDER BY MIN(s.hype_score)""", params(f));
    }

    @Override
    public List<Map<String, Object>> inventoryBands() {
        return jdbc.queryForList("""
                SELECT CASE WHEN score < 300 THEN 'EM_MONTAGEM' WHEN score < 500 THEN 'ORGANIZADO' WHEN score < 650 THEN 'VERSATIL'
                            WHEN score < 800 THEN 'BEM_CURADO' WHEN score < 900 THEN 'CLOSET_INTELIGENTE' WHEN score < 960 THEN 'SIGNATURE_CLOSET'
                            ELSE 'MAISON_CLOSET' END AS band, COUNT(*) AS total
                FROM inventory_score_snapshots s
                WHERE s.period_type = 'DAY' AND s.eligible = TRUE AND s.score IS NOT NULL
                  AND s.period_date = (SELECT MAX(x.period_date) FROM inventory_score_snapshots x WHERE x.user_id = s.user_id AND x.period_type = 'DAY')
                GROUP BY band ORDER BY MIN(score)""", new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> sealFunnel(Filter f) {
        return jdbc.queryForList("SELECT status, COUNT(*) AS total FROM seal_bonds WHERE created_at BETWEEN :from AND :to GROUP BY status ORDER BY total DESC", params(f));
    }

    @Override
    public List<Map<String, Object>> challengeStats() {
        return jdbc.queryForList("""
                SELECT i.template_code AS template, i.state AS state, COUNT(*) AS instances,
                       (SELECT COUNT(*) FROM challenge_participants p WHERE p.instance_id IN (SELECT id FROM challenge_instances x WHERE x.template_code = i.template_code)
                          AND p.status IN ('ATIVO', 'CONCLUIU')) AS participants
                FROM challenge_instances i GROUP BY i.template_code, i.state ORDER BY i.template_code, i.state""", new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> pointsByAction(Filter f) {
        return jdbc.queryForList("""
                SELECT action_code, COUNT(*) AS entries, SUM(delta) AS points FROM fai_points_ledger
                WHERE created_at BETWEEN :from AND :to GROUP BY action_code ORDER BY points DESC""", params(f));
    }

    @Override
    public List<Map<String, Object>> usersByProfile(Filter f) {
        return jdbc.queryForList("""
                SELECT profile_type, status, COUNT(*) AS total FROM users
                WHERE (:country IS NULL OR country = :country) GROUP BY profile_type, status ORDER BY profile_type, status""", params(f));
    }

    @Override
    public List<Map<String, Object>> bondSeries(UUID targetOwnerId, Filter f) {
        return jdbc.queryForList("""
                SELECT DATE(created_at) AS day, status, COUNT(*) AS total FROM seal_bonds
                WHERE target_owner_user_id = :owner AND created_at BETWEEN :from AND :to
                GROUP BY DATE(created_at), status ORDER BY day""", params(f).addValue("owner", targetOwnerId.toString()));
    }

    @Override
    public int purgeNotifications(int days) {
        List<Map<String, Object>> rows = jdbc.queryForList("CALL sp_purge_notifications(:days)", new MapSqlParameterSource("days", days));
        return rows.isEmpty() ? 0 : ((Number) rows.get(0).getOrDefault("removed", 0)).intValue();
    }

    private static MapSqlParameterSource global(GlobalFilter f) {
        return new MapSqlParameterSource().addValue("season", f.season()).addValue("color", f.color())
                .addValue("hmin", f.hypeMin()).addValue("hmax", f.hypeMax());
    }

    @Override
    public List<Map<String, Object>> schemesByCountry(GlobalFilter f) {
        return jdbc.queryForList("""
                SELECT u.country AS country, COUNT(*) AS schemes, ROUND(AVG(s.hype_score), 1) AS avg_hype
                FROM schemes s JOIN users u ON u.id = s.user_id
                WHERE s.visibility = 'PUBLIC' AND s.status = 'PUBLISHED' AND u.country IS NOT NULL
                  AND (:season IS NULL OR s.season = :season)
                  AND (:hmin IS NULL OR s.hype_score >= :hmin) AND (:hmax IS NULL OR s.hype_score < :hmax)
                  AND (:color IS NULL OR EXISTS (SELECT 1 FROM scheme_items si JOIN wardrobe_items w ON w.id = si.wardrobe_item_id
                                                 WHERE si.scheme_id = s.id AND w.color = :color))
                GROUP BY u.country""", global(f));
    }

    @Override
    public List<Map<String, Object>> piecesByCountry(GlobalFilter f) {
        return jdbc.queryForList("""
                SELECT u.country AS country, COUNT(*) AS pieces
                FROM wardrobe_items w JOIN users u ON u.id = w.user_id
                WHERE w.visibility = 'PUBLIC' AND u.country IS NOT NULL
                  AND (:season IS NULL OR LOWER(w.market) = LOWER(:season))
                  AND (:color IS NULL OR w.color = :color)
                  AND (:hmin IS NULL OR w.hype_score >= :hmin) AND (:hmax IS NULL OR w.hype_score < :hmax)
                GROUP BY u.country""", global(f));
    }

    @Override
    public List<Map<String, Object>> brandFacets() {
        return jdbc.queryForList("""
                SELECT LOWER(w.brand_name) AS brand, COUNT(*) AS pieces, ROUND(AVG(w.hype_score), 1) AS avg_hype,
                       GROUP_CONCAT(DISTINCT w.color) AS colors, GROUP_CONCAT(DISTINCT LOWER(w.market)) AS seasons
                FROM wardrobe_items w WHERE w.brand_name IS NOT NULL AND w.brand_name <> ''
                GROUP BY LOWER(w.brand_name)""", new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> hypeByColor(int limit) {
        return jdbc.queryForList("""
                SELECT w.color AS color, ROUND(AVG(s.hype_score), 1) AS avg_hype, COUNT(DISTINCT s.id) AS looks
                FROM schemes s JOIN scheme_items si ON si.scheme_id = s.id JOIN wardrobe_items w ON w.id = si.wardrobe_item_id
                WHERE s.visibility = 'PUBLIC' AND s.status = 'PUBLISHED' AND s.hype_score IS NOT NULL AND w.color IS NOT NULL
                GROUP BY w.color HAVING COUNT(DISTINCT s.id) >= 2 ORDER BY avg_hype DESC LIMIT :limit""", new MapSqlParameterSource("limit", limit));
    }

    @Override
    public List<Map<String, Object>> hypeByBrand(int limit) {
        return jdbc.queryForList("""
                SELECT w.brand_name AS brand, ROUND(AVG(s.hype_score), 1) AS avg_hype, COUNT(DISTINCT s.id) AS looks
                FROM schemes s JOIN scheme_items si ON si.scheme_id = s.id JOIN wardrobe_items w ON w.id = si.wardrobe_item_id
                WHERE s.visibility = 'PUBLIC' AND s.status = 'PUBLISHED' AND s.hype_score IS NOT NULL AND w.brand_name IS NOT NULL AND w.brand_name <> ''
                GROUP BY w.brand_name ORDER BY avg_hype DESC LIMIT :limit""", new MapSqlParameterSource("limit", limit));
    }
}
