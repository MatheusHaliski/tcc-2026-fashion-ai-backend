package br.com.fashionai.infrastructure.mysql.analytics;

import br.com.fashionai.application.ports.AnalyticsQueryPort;
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
                FROM ai_inference_log WHERE created_at BETWEEN :from AND :to
                GROUP BY capability, provider, result ORDER BY calls DESC""", params(f));
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
}
