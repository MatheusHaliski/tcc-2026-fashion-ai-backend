package br.com.fashionai.infrastructure.mysql.analytics;

import br.com.fashionai.application.ports.AnalyticsQueryPort.Filter;
import br.com.fashionai.application.ports.AnalyticsQueryPort.GlobalFilter;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Consultas do dashboard: SQL certo, parâmetros do filtro repassados e a lista do banco devolvida como veio. */
class MysqlAnalyticsAdapterTest {
    private final NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    private final MysqlAnalyticsAdapter adapter = new MysqlAnalyticsAdapter(jdbc);
    private final Instant from = Instant.parse("2026-01-01T00:00:00Z");
    private final Instant to = Instant.parse("2026-02-01T00:00:00Z");
    private final Filter filter = new Filter(from, to, "BR", "PESSOAL");
    private final List<Map<String, Object>> rows = List.of(Map.of("total", 3));

    private SqlParameterSource devolve(String sqlPart, Supplier<Object> call) {
        ArgumentCaptor<SqlParameterSource> params = ArgumentCaptor.forClass(SqlParameterSource.class);
        when(jdbc.queryForList(anyString(), any(SqlParameterSource.class))).thenReturn(rows);
        assertThat(call.get()).isSameAs(rows);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, org.mockito.Mockito.atLeastOnce()).queryForList(sql.capture(), params.capture());
        assertThat(sql.getValue()).contains(sqlPart);
        return params.getValue();
    }

    private void filtroRepassado(SqlParameterSource p) {
        assertThat(p.getValue("from")).isEqualTo(Timestamp.from(from));
        assertThat(p.getValue("to")).isEqualTo(Timestamp.from(to));
        assertThat(p.getValue("country")).isEqualTo("BR");
        assertThat(p.getValue("profile")).isEqualTo("PESSOAL");
    }

    @Test
    void kpisDevolvemAPrimeiraLinhaOuVazio() {
        when(jdbc.queryForList(eq("CALL sp_admin_kpis(:from, :to, :country, :profile)"), any(SqlParameterSource.class)))
                .thenReturn(List.of(), rows);
        assertThat(adapter.kpis(filter)).isEmpty();
        assertThat(adapter.kpis(filter)).isSameAs(rows.get(0));
    }

    @Test
    void serieRepassaMetricaEFiltro() {
        SqlParameterSource p = devolve("sp_timeseries", () -> adapter.series("users", filter));
        assertThat(p.getValue("metric")).isEqualTo("users");
        filtroRepassado(p);
    }

    @Test
    void consultasComFiltroDePeriodo() {
        filtroRepassado(devolve("ai_inference_log", () -> adapter.aiUsage(filter)));
        filtroRepassado(devolve("sp_ai_cost_by_country", () -> adapter.aiCostByCountry(filter)));
        filtroRepassado(devolve("seal_bonds", () -> adapter.sealFunnel(filter)));
        filtroRepassado(devolve("fai_points_ledger", () -> adapter.pointsByAction(filter)));
        filtroRepassado(devolve("profile_type, status", () -> adapter.usersByProfile(filter)));
        filtroRepassado(devolve("'registered'", () -> adapter.activationFunnel(filter)));
        filtroRepassado(devolve("DAYOFWEEK", () -> adapter.activityHeatmap(filter)));
        filtroRepassado(devolve("moderation_queue", () -> adapter.moderationByStatus(filter)));
        filtroRepassado(devolve("LIMIT 12", () -> adapter.auditFailures(filter)));
        filtroRepassado(devolve("login_failures", () -> adapter.securitySeries(filter)));
        filtroRepassado(devolve("UNION ALL SELECT DATE(created_at), 0, COUNT(*), 0 FROM comments", () -> adapter.engagementSeries(filter)));
        filtroRepassado(devolve("w.category", () -> adapter.categories(filter)));
        filtroRepassado(devolve("pipeline_jobs WHERE created_at", () -> adapter.jobsByStatus(filter)));
    }

    @Test
    void consultasComLimite() {
        assertThat(devolve("vw_brand_usage", () -> adapter.brandUsage(5)).getValue("limit")).isEqualTo(5);
        assertThat(devolve("PENDING_REVIEW", () -> adapter.moderationRecent(6)).getValue("limit")).isEqualTo(6);
        assertThat(devolve("status = 'FAILED'", () -> adapter.jobsFailedRecent(7)).getValue("limit")).isEqualTo(7);
        SqlParameterSource top = devolve("HAVING pieces + schemes + likes > 0", () -> adapter.topUsers(filter, 8));
        assertThat(top.getValue("limit")).isEqualTo(8);
        filtroRepassado(top);
        SqlParameterSource audit = devolve("ORDER BY `timestamp` DESC LIMIT :limit", () -> adapter.auditRecent(filter, 9));
        assertThat(audit.getValue("limit")).isEqualTo(9);
    }

    @Test
    void consultasSemFiltro() {
        devolve("vw_country_insights", adapter::countries);
        devolve("w.color AS color, COUNT(*) AS total", adapter::countryColors);
        devolve("MAISON_CLOSET", adapter::inventoryBands);
        devolve("challenge_participants", adapter::challengeStats);
        devolve("GROUP_CONCAT", adapter::brandFacets);
    }

    @Test
    void consultasPorPais() {
        assertThat(devolve("s.season AS season", () -> adapter.looksBySeason("BR")).getValue("country")).isEqualTo("BR");
        SqlParameterSource p = devolve("GROUP BY w.color ORDER BY total DESC LIMIT :limit", () -> adapter.colorRanking(null, 4));
        assertThat(p.getValue("country")).isNull();
        assertThat(p.getValue("limit")).isEqualTo(4);
    }

    @Test
    void filtroGlobalPorEstacaoECor() {
        GlobalFilter g = new GlobalFilter("verao", "azul");
        SqlParameterSource p = devolve("COUNT(*) AS schemes", () -> adapter.schemesByCountry(g));
        assertThat(p.getValue("season")).isEqualTo("verao");
        assertThat(p.getValue("color")).isEqualTo("azul");
        assertThat(devolve("COUNT(*) AS pieces", () -> adapter.piecesByCountry(g)).getValue("color")).isEqualTo("azul");
    }

    @Test
    void serieDeVinculosRepassaODono() {
        UUID owner = UUID.randomUUID();
        SqlParameterSource p = devolve("target_owner_user_id = :owner", () -> adapter.bondSeries(owner, filter));
        assertThat(p.getValue("owner")).isEqualTo(owner.toString());
    }

    @Test
    void expurgoDeNotificacoesLeORemovidoOuZero() {
        when(jdbc.queryForList(eq("CALL sp_purge_notifications(:days)"), any(MapSqlParameterSource.class)))
                .thenReturn(List.of(), List.of(Map.of("removed", 12L)), List.of(Map.of("outro", 1)));
        assertThat(adapter.purgeNotifications(30)).isZero();
        assertThat(adapter.purgeNotifications(30)).isEqualTo(12);
        assertThat(adapter.purgeNotifications(30)).isZero();
    }

    @Test
    void latenciaDoBancoNuncaNegativa() {
        JdbcOperations ops = mock(JdbcOperations.class);
        when(jdbc.getJdbcOperations()).thenReturn(ops);
        assertThat(adapter.dbLatencyMs()).isGreaterThanOrEqualTo(0);
        verify(ops).queryForObject("SELECT 1", Integer.class);
    }

    @Test
    void hypeV2RepassaAVersaoDoAlgoritmo() {
        SqlParameterSource levels = devolve("h.level AS level", () -> adapter.hypeLevelsV2(filter, "v2"));
        assertThat(levels.getValue("version")).isEqualTo("v2");
        filtroRepassado(levels);
        assertThat(devolve("not_calculated", () -> adapter.hypeCoverageV2(filter, "v2")).getValue("version")).isEqualTo("v2");
        UUID issuer = UUID.randomUUID();
        SqlParameterSource bonded = devolve("b.status = 'APPROVED'", () -> adapter.bondedLooksHypeV2(issuer, "v2"));
        assertThat(bonded.getValue("owner")).isEqualTo(issuer.toString());
    }

    @Test
    void jobDoHypeDevolvePrimeiraLinhaOuVazio() {
        when(jdbc.queryForList(anyString(), any(SqlParameterSource.class))).thenReturn(List.of(), rows);
        assertThat(adapter.hypeJobV2("v2")).isEmpty();
        assertThat(adapter.hypeJobV2("v2")).isSameAs(rows.get(0));
    }
}
