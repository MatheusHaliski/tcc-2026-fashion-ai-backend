package br.com.fashionai.infrastructure.mysql.analytics;

import br.com.fashionai.application.ports.AnalyticsQueryPort.Filter;
import br.com.fashionai.application.ports.AnalyticsQueryPort.GlobalFilter;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caracterização byte a byte: o SQL exato e os parâmetros nomeados de cada consulta do dashboard ficam congelados em
 * {@code analytics-sql-golden.txt}. Separar o texto SQL do adapter não pode mudar nenhum caractere do que vai ao banco.
 * Para regravar o golden (só com o código original), rode com {@code -Danalytics.golden.write=<caminho>}.
 */
class MysqlAnalyticsSqlCharacterizationTest {
    private static final String GOLDEN = "analytics-sql-golden.txt";
    private final NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    private final MysqlAnalyticsAdapter adapter = new MysqlAnalyticsAdapter(jdbc);
    private final Filter filter = new Filter(Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-02-01T00:00:00Z"),
            "BR", "PESSOAL");
    private final GlobalFilter global = new GlobalFilter("verao", "azul");
    private final UUID owner = UUID.fromString("00000000-0000-0000-0000-000000000017");
    private final StringBuilder dump = new StringBuilder();

    private void record(String label, Consumer<MysqlAnalyticsAdapter> call) {
        clearInvocations(jdbc);
        call.accept(adapter);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SqlParameterSource> params = ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(jdbc).queryForList(sql.capture(), params.capture());
        dump.append("=== ").append(label).append('\n').append(sql.getValue()).append("\n--- params\n");
        String[] names = params.getValue().getParameterNames();
        Arrays.sort(names);
        for (String name : names) {
            Object value = params.getValue().getValue(name);
            String shown = value instanceof Timestamp ts ? "ts:" + ts.toInstant() : String.valueOf(value);
            dump.append(name).append('=').append(shown).append('\n');
        }
    }

    private String currentDump() {
        when(jdbc.queryForList(anyString(), any(SqlParameterSource.class))).thenReturn(List.of(Map.of("removed", 1)));
        record("kpis", a -> a.kpis(filter));
        record("series", a -> a.series("users", filter));
        record("aiUsage", a -> a.aiUsage(filter));
        record("aiCostByCountry", a -> a.aiCostByCountry(filter));
        record("brandUsage", a -> a.brandUsage(5));
        record("countries", MysqlAnalyticsAdapter::countries);
        record("countryColors", MysqlAnalyticsAdapter::countryColors);
        record("looksBySeason", a -> a.looksBySeason("BR"));
        record("colorRanking", a -> a.colorRanking(null, 4));
        record("inventoryBands", MysqlAnalyticsAdapter::inventoryBands);
        record("sealFunnel", a -> a.sealFunnel(filter));
        record("challengeStats", MysqlAnalyticsAdapter::challengeStats);
        record("pointsByAction", a -> a.pointsByAction(filter));
        record("usersByProfile", a -> a.usersByProfile(filter));
        record("bondSeries", a -> a.bondSeries(owner, filter));
        record("purgeNotifications", a -> a.purgeNotifications(30));
        record("schemesByCountry", a -> a.schemesByCountry(global));
        record("piecesByCountry", a -> a.piecesByCountry(global));
        record("brandFacets", MysqlAnalyticsAdapter::brandFacets);
        record("activationFunnel", a -> a.activationFunnel(filter));
        record("activityHeatmap", a -> a.activityHeatmap(filter));
        record("topUsers", a -> a.topUsers(filter, 8));
        record("moderationByStatus", a -> a.moderationByStatus(filter));
        record("moderationRecent", a -> a.moderationRecent(6));
        record("auditFailures", a -> a.auditFailures(filter));
        record("auditRecent", a -> a.auditRecent(filter, 9));
        record("securitySeries", a -> a.securitySeries(filter));
        record("engagementSeries", a -> a.engagementSeries(filter));
        record("categories", a -> a.categories(filter));
        record("jobsByStatus", a -> a.jobsByStatus(filter));
        record("jobsFailedRecent", a -> a.jobsFailedRecent(7));
        record("hypeLevelsV2", a -> a.hypeLevelsV2(filter, "v2"));
        record("hypeCoverageV2", a -> a.hypeCoverageV2(filter, "v2"));
        record("hypeJobV2", a -> a.hypeJobV2("v2"));
        record("bondedLooksHypeV2", a -> a.bondedLooksHypeV2(owner, "v2"));
        return dump.toString();
    }

    @Test
    void sqlEParametrosDeTodasAsConsultasIguaisAoGolden() throws IOException {
        String current = currentDump();
        String target = System.getProperty("analytics.golden.write");
        if (target != null && !target.isBlank()) {
            Files.writeString(Path.of(target), current, StandardCharsets.UTF_8);
        }
        try (InputStream in = getClass().getResourceAsStream(GOLDEN)) {
            assertThat(in).as("golden " + GOLDEN).isNotNull();
            assertThat(current).isEqualTo(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
}
