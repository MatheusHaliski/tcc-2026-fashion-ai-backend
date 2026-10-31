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

import static br.com.fashionai.infrastructure.mysql.analytics.AnalyticsDashboardSql.*;
import static br.com.fashionai.infrastructure.mysql.analytics.AnalyticsInsightsSql.*;

/**
 * Leitura analítica (dashboard administrativo, insights e HypeScore v2) via JDBC nomeado. O texto SQL mora em
 * {@link AnalyticsInsightsSql} e {@link AnalyticsDashboardSql}; aqui ficam só o binding dos filtros e a forma do retorno.
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

    private static MapSqlParameterSource global(GlobalFilter f) {
        return new MapSqlParameterSource().addValue("season", f.season()).addValue("color", f.color());
    }

    private static Map<String, Object> firstOrEmpty(List<Map<String, Object>> rows) {
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    @Override
    public Map<String, Object> kpis(Filter f) {
        return firstOrEmpty(jdbc.queryForList(KPIS, params(f)));
    }

    @Override
    public List<Map<String, Object>> series(String metric, Filter f) {
        return jdbc.queryForList(SERIES, params(f).addValue("metric", metric));
    }

    @Override
    public List<Map<String, Object>> aiUsage(Filter f) {
        return jdbc.queryForList(AI_USAGE, params(f));
    }

    @Override
    public List<Map<String, Object>> aiCostByCountry(Filter f) {
        return jdbc.queryForList(AI_COST_BY_COUNTRY, params(f));
    }

    @Override
    public List<Map<String, Object>> brandUsage(int limit) {
        return jdbc.queryForList(BRAND_USAGE, new MapSqlParameterSource("limit", limit));
    }

    @Override
    public List<Map<String, Object>> countries() {
        return jdbc.queryForList(COUNTRIES, new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> countryColors() {
        return jdbc.queryForList(COUNTRY_COLORS, new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> looksBySeason(String country) {
        return jdbc.queryForList(LOOKS_BY_SEASON, new MapSqlParameterSource("country", country));
    }

    @Override
    public List<Map<String, Object>> colorRanking(String country, int limit) {
        return jdbc.queryForList(COLOR_RANKING, new MapSqlParameterSource("country", country).addValue("limit", limit));
    }

    @Override
    public List<Map<String, Object>> inventoryBands() {
        return jdbc.queryForList(INVENTORY_BANDS, new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> sealFunnel(Filter f) {
        return jdbc.queryForList(SEAL_FUNNEL, params(f));
    }

    @Override
    public List<Map<String, Object>> challengeStats() {
        return jdbc.queryForList(CHALLENGE_STATS, new MapSqlParameterSource());
    }

    @Override
    public List<Map<String, Object>> pointsByAction(Filter f) {
        return jdbc.queryForList(POINTS_BY_ACTION, params(f));
    }

    @Override
    public List<Map<String, Object>> usersByProfile(Filter f) {
        return jdbc.queryForList(USERS_BY_PROFILE, params(f));
    }

    @Override
    public List<Map<String, Object>> bondSeries(UUID targetOwnerId, Filter f) {
        return jdbc.queryForList(BOND_SERIES, params(f).addValue("owner", targetOwnerId.toString()));
    }

    @Override
    public int purgeNotifications(int days) {
        List<Map<String, Object>> rows = jdbc.queryForList(PURGE_NOTIFICATIONS, new MapSqlParameterSource("days", days));
        return rows.isEmpty() ? 0 : ((Number) rows.get(0).getOrDefault("removed", 0)).intValue();
    }

    @Override
    public List<Map<String, Object>> schemesByCountry(GlobalFilter f) {
        return jdbc.queryForList(SCHEMES_BY_COUNTRY, global(f));
    }

    @Override
    public List<Map<String, Object>> piecesByCountry(GlobalFilter f) {
        return jdbc.queryForList(PIECES_BY_COUNTRY, global(f));
    }

    @Override
    public List<Map<String, Object>> brandFacets() {
        return jdbc.queryForList(BRAND_FACETS, new MapSqlParameterSource());
    }

    // ---------------------------------------------------------------- dashboard administrativo por abas
    @Override
    public List<Map<String, Object>> activationFunnel(Filter f) {
        return jdbc.queryForList(ACTIVATION_FUNNEL, params(f));
    }

    @Override
    public List<Map<String, Object>> activityHeatmap(Filter f) {
        return jdbc.queryForList(ACTIVITY_HEATMAP, params(f));
    }

    @Override
    public List<Map<String, Object>> topUsers(Filter f, int limit) {
        return jdbc.queryForList(TOP_USERS, params(f).addValue("limit", limit));
    }

    @Override
    public List<Map<String, Object>> moderationByStatus(Filter f) {
        return jdbc.queryForList(MODERATION_BY_STATUS, params(f));
    }

    @Override
    public List<Map<String, Object>> moderationRecent(int limit) {
        return jdbc.queryForList(MODERATION_RECENT, new MapSqlParameterSource("limit", limit));
    }

    @Override
    public List<Map<String, Object>> auditFailures(Filter f) {
        return jdbc.queryForList(AUDIT_FAILURES, params(f));
    }

    @Override
    public List<Map<String, Object>> auditRecent(Filter f, int limit) {
        return jdbc.queryForList(AUDIT_RECENT, params(f).addValue("limit", limit));
    }

    @Override
    public List<Map<String, Object>> securitySeries(Filter f) {
        return jdbc.queryForList(SECURITY_SERIES, params(f));
    }

    @Override
    public List<Map<String, Object>> engagementSeries(Filter f) {
        return jdbc.queryForList(ENGAGEMENT_SERIES, params(f));
    }

    @Override
    public List<Map<String, Object>> categories(Filter f) {
        return jdbc.queryForList(CATEGORIES, params(f));
    }

    @Override
    public List<Map<String, Object>> jobsByStatus(Filter f) {
        return jdbc.queryForList(JOBS_BY_STATUS, params(f));
    }

    @Override
    public List<Map<String, Object>> jobsFailedRecent(int limit) {
        return jdbc.queryForList(JOBS_FAILED_RECENT, new MapSqlParameterSource("limit", limit));
    }

    @Override
    public long dbLatencyMs() {
        long t0 = System.nanoTime();
        jdbc.getJdbcOperations().queryForObject("SELECT 1", Integer.class);
        return Math.max(0, (System.nanoTime() - t0) / 1_000_000);
    }

    // ---------------------------------------------------------------- HypeScore v2 (RF53 · Lote 7) — só leitura de hype_scores
    @Override
    public List<Map<String, Object>> hypeLevelsV2(Filter f, String algorithmVersion) {
        return jdbc.queryForList(HYPE_LEVELS_V2, params(f).addValue("version", algorithmVersion));
    }

    @Override
    public List<Map<String, Object>> hypeCoverageV2(Filter f, String algorithmVersion) {
        return jdbc.queryForList(HYPE_COVERAGE_V2, params(f).addValue("version", algorithmVersion));
    }

    @Override
    public Map<String, Object> hypeJobV2(String algorithmVersion) {
        return firstOrEmpty(jdbc.queryForList(HYPE_JOB_V2, new MapSqlParameterSource("version", algorithmVersion)));
    }

    @Override
    public List<Map<String, Object>> bondedLooksHypeV2(UUID issuerId, String algorithmVersion) {
        return jdbc.queryForList(BONDED_LOOKS_HYPE_V2, new MapSqlParameterSource("version", algorithmVersion)
                .addValue("owner", issuerId.toString()));
    }
}
