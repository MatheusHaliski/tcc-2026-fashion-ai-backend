package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 · Lote 7 — painéis do emissor (P2-20) e do admin (P2-21) com o HypeScore v2: só agregados públicos, "sem dados"
 * nunca vira 0, faixa sempre presente e o GET só lê o estado gravado pelo job.
 */
class DashboardHypeV2Test {
    static final HypeScoreConfig CFG = HypeScoreConfig.defaults();
    static final Instant NOW = Instant.parse("2026-10-05T12:00:00Z");

    static Map<String, Object> row(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    static Map<String, Object> look(String id, String title, String status, Double score, String level, Double delta, boolean pub) {
        return row("scheme_id", id, "title", title, "owner", "ana", "cover_url", null, "status", status, "score", score, "level", level,
                "delta_points", delta, "direction", delta == null ? null : delta > 0 ? "UP" : "DOWN", "public_eligible", pub,
                "calculated_at", "2026-10-05T09:20:00Z");
    }

    // ------------------------------------------------------------------ P2-20 painel do emissor

    @Test
    void issuerBlockAveragesOnlyPublicLooksWithHype() {
        List<Map<String, Object>> rows = List.of(
                look("a", "Alfa", "AVAILABLE", 80.0, "TRENDING", 1.0, true),
                look("b", "Beta", "AVAILABLE", 60.0, "HOT", 2.0, true),
                look("c", "Gama", "AVAILABLE", 70.0, "HOT", null, true),
                look("d", "Delta", "AVAILABLE", 40.0, "RELEVANT", 0.0, true),
                look("e", "Épsilon", "INSUFFICIENT_DATA", null, null, null, true),
                look("p", "Privado", "AVAILABLE", 99.0, "VIRAL", 30.0, false),    // Hype pessoal: fora da média e do top
                look("n", "Novo", null, null, null, null, false));                 // sem linha em hype_scores (LEFT JOIN)
        Map<String, Object> h = DashboardService.issuerHype(rows, CFG);
        assertThat(h).containsEntry("bondedLooks", 7).containsEntry("withHype", 4).containsEntry("insufficient", 1L).containsEntry("notPublic", 2);
        assertThat(h.get("avgScore")).isEqualTo(62.5);                       // (80 + 60 + 70 + 40) / 4, sem o privado de 99
        assertThat(h.get("level")).isEqualTo("HOT");                         // faixa sempre com o número (60–74 = Em alta)
        assertThat(h.get("deltaPoints")).isEqualTo(1.0);                     // média de 1, 2 e 0 (o look sem base fica fora)
        assertThat(h.get("direction")).isEqualTo("STABLE");                  // |Δ| < 2 pts
        assertThat(h).containsEntry("deltaWindowDays", 7).containsEntry("algorithmVersion", "HYPE_V2");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> top = (List<Map<String, Object>>) h.get("top");
        assertThat(top).extracting(m -> m.get("schemeId")).containsExactly("a", "c", "b");
        assertThat(top).extracting(m -> m.get("title")).doesNotContain("Privado");
        assertThat(top.get(0)).containsEntry("level", "TRENDING").containsEntry("score", 80.0).containsEntry("deltaPoints", 1.0);
    }

    @Test
    void issuerWithoutPublicHypeIsNullNeverZero() {
        Map<String, Object> h = DashboardService.issuerHype(List.of(
                look("e", "Épsilon", "INSUFFICIENT_DATA", null, null, null, true),
                look("p", "Privado", "AVAILABLE", 90.0, "VIRAL", 10.0, false)), CFG);
        assertThat(h.get("avgScore")).isNull();
        assertThat(h.get("level")).isNull();
        assertThat(h.get("deltaPoints")).isNull();
        assertThat(h.get("direction")).isNull();
        assertThat((List<?>) h.get("top")).isEmpty();
        assertThat(DashboardService.issuerHype(null, CFG)).containsEntry("bondedLooks", 0).containsEntry("avgScore", null);
    }

    @Test
    void issuerDeltaDirection() {
        Map<String, Object> up = DashboardService.issuerHype(List.of(look("a", "A", "AVAILABLE", 50.0, "RELEVANT", 6.0, true)), CFG);
        assertThat(up).containsEntry("direction", "UP").containsEntry("deltaPoints", 6.0);
        Map<String, Object> down = DashboardService.issuerHype(List.of(look("a", "A", "AVAILABLE", 50.0, "RELEVANT", -3.5, true)), CFG);
        assertThat(down).containsEntry("direction", "DOWN");
        // exatamente 2 pts já não é estável (a régua é |Δ| < 2)
        assertThat(DashboardService.issuerHype(List.of(look("a", "A", "AVAILABLE", 50.0, "RELEVANT", 2.0, true)), CFG)).containsEntry("direction", "UP");
    }

    // ------------------------------------------------------------------ P2-21 widget do admin

    @Test
    void adminBlockListsAllSixLevelsInOrderWithPiecesAndLooks() {
        Map<String, Object> b = DashboardService.hypeV2Block(
                List.of(row("entity_type", "PIECE", "level", "HOT", "total", 5L), row("entity_type", "SCHEME", "level", "HOT", "total", 2L),
                        row("entity_type", "PIECE", "level", "VIRAL", "total", 1L), row("entity_type", "SCHEME", "level", "NICHE", "total", 3L),
                        row("entity_type", "PIECE", "level", "MEGA", "total", 9L)),   // faixa desconhecida: ignorada
                List.of(row("entity_type", "PIECE", "total", 20L, "available", 6L, "insufficient", 10L, "not_calculated", 4L, "public_eligible", 9L)),
                row("last_calculated_at", "2026-10-05T09:20:00Z", "last_snapshot_date", "2026-10-05", "rows_total", 31L), CFG, NOW);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> levels = (List<Map<String, Object>>) b.get("levels");
        assertThat(levels).extracting(m -> m.get("level")).containsExactly("LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL");
        assertThat(levels.get(3)).containsEntry("pieces", 5L).containsEntry("looks", 2L);
        assertThat(levels.get(1)).containsEntry("pieces", 0L).containsEntry("looks", 3L);
        assertThat(b.get("levelTotals")).isEqualTo(Map.of("pieces", 6L, "looks", 5L));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> coverage = (List<Map<String, Object>>) b.get("coverage");
        assertThat(coverage).extracting(m -> m.get("entityType")).containsExactly("PIECE", "SCHEME");
        assertThat(coverage.get(0)).containsEntry("available", 6L).containsEntry("insufficient", 10L).containsEntry("notCalculated", 4L)
                .containsEntry("publicEligible", 9L).containsEntry("total", 20L);
        assertThat(coverage.get(1)).containsEntry("total", 0L).containsEntry("notCalculated", 0L);   // sem linha: contagem 0, não erro
        assertThat(b).containsEntry("algorithmVersion", "HYPE_V2");
        @SuppressWarnings("unchecked")
        Map<String, Object> job = (Map<String, Object>) b.get("job");
        assertThat(job).containsEntry("lastCalculatedAt", "2026-10-05T09:20:00Z").containsEntry("lastSnapshotDate", "2026-10-05")
                .containsEntry("rows", 31L).containsEntry("stale", false).containsEntry("staleAfterHours", 24);
    }

    @Test
    void jobStateNeverCalculatedAndStale() {
        Map<String, Object> never = DashboardService.hypeJob(Map.of(), CFG, NOW);
        assertThat(never.get("lastCalculatedAt")).isNull();
        assertThat(never.get("stale")).isNull();
        assertThat(never).containsEntry("rows", 0L);
        Map<String, Object> old = DashboardService.hypeJob(row("last_calculated_at", "2026-10-03T09:20:00Z"), CFG, NOW);
        assertThat(old).containsEntry("stale", true);
    }

    @Test
    void endpointsReadV2StateAndKeepTheV1FieldForCompatibility() {
        AnalyticsQueryPort analytics = mock(AnalyticsQueryPort.class);
        SealService seals = mock(SealService.class);
        UserPreferencesRepository prefs = mock(UserPreferencesRepository.class);
        DashboardService svc = new DashboardService(analytics, prefs, seals, mock(AiEngine.class), mock(Guard.class),
                mock(BackupRecordRepository.class), CFG);
        UUID issuerId = UUID.randomUUID();
        CurrentUser issuer = new CurrentUser(issuerId, "marca", "USER", ProfileType.MARCA, true, AccountStatus.ACTIVE, null, null);
        when(seals.issuerMetrics(issuer)).thenReturn(Map.of("approved", 3L));
        when(analytics.bondedLooksHypeV2(issuerId, "HYPE_V2")).thenReturn(List.of(look("a", "A", "AVAILABLE", 77.0, "TRENDING", 3.0, true)));
        Map<String, Object> out = svc.issuer(issuer, null);
        assertThat(out).containsKeys("metrics", "bondSeries", "hype");
        @SuppressWarnings("unchecked")
        Map<String, Object> hype = (Map<String, Object>) out.get("hype");
        assertThat(hype).containsEntry("avgScore", 77.0).containsEntry("level", "TRENDING");

        when(analytics.hypeLevelsV2(any(), eq("HYPE_V2"))).thenReturn(List.of(row("entity_type", "SCHEME", "level", "VIRAL", "total", 1L)));
        CurrentUser admin = new CurrentUser(UUID.randomUUID(), "admin", "ADMIN", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        Map<String, Object> dash = svc.admin(admin, null);
        assertThat(dash).containsKeys("hypeBands", "hypeV2");                 // v1 continua (deprecado) ao lado do v2
        @SuppressWarnings("unchecked")
        Map<String, Object> v2 = (Map<String, Object>) dash.get("hypeV2");
        assertThat(v2).containsEntry("algorithmVersion", "HYPE_V2");
        verify(analytics).hypeCoverageV2(any(), eq("HYPE_V2"));
        verify(analytics).hypeJobV2("HYPE_V2");
        // painel do emissor nunca consulta agregados de outros emissores
        verify(analytics, never()).bondedLooksHypeV2(eq(admin.id()), anyString());
    }
}
