package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caracterização do {@link DashboardService} pelas portas públicas (admin/issuer/saveLayout), escrita antes da
 * extração dos alertas e dos blocos HypeScore v2 (lote 16): ordem das chaves da resposta, limiares dos alertas,
 * concatenação alertas de negócio → alertas de segurança, validação do período, recusa do painel do emissor e
 * mescla/filtragem do layout de widgets.
 */
class DashboardServiceCharacterizationTest {
    final AnalyticsQueryPort analytics = mock(AnalyticsQueryPort.class);
    final UserPreferencesRepository prefs = mock(UserPreferencesRepository.class);
    final SealService seals = mock(SealService.class);
    final Guard guard = mock(Guard.class);
    final DashboardService svc = new DashboardService(analytics, prefs, seals, mock(AiEngine.class), guard,
            mock(BackupRecordRepository.class), HypeScoreConfig.defaults());
    final CurrentUser admin = new CurrentUser(UUID.randomUUID(), "admin", "ADMIN", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);

    @BeforeEach
    void defaults() {
        when(analytics.kpis(any())).thenReturn(Map.of());
        when(analytics.aiUsage(any())).thenReturn(List.of());
        when(analytics.securitySeries(any())).thenReturn(List.of());
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> alerts(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("alerts");
    }

    @Test
    void adminResponseKeepsKeyOrder() {
        Map<String, Object> out = svc.admin(admin, null);
        assertThat(out.keySet()).containsExactly("filter", "kpis", "kpisPrevious", "series", "aiUsage", "aiByCountry",
                "aiProviders", "brands", "countries", "hypeV2", "inventoryBands", "sealFunnel", "challenges", "points",
                "profiles", "funnel", "heatmap", "topUsers", "categories", "moderation", "engagement", "security", "jobs",
                "system", "alerts", "layout");
        assertThat(alerts(out)).isEmpty();
        @SuppressWarnings("unchecked")
        Map<String, Object> series = (Map<String, Object>) out.get("series");
        assertThat(series.keySet()).containsExactly("users", "pieces", "schemes", "daily_looks", "ai_calls", "ai_cost");
        verify(guard).requireAdmin(admin);
    }

    @Test
    void businessAlertsAtThresholdsThenSecurityAlertsInOrder() {
        when(analytics.kpis(any())).thenReturn(Map.of("ai_fallback_pct", "20", "moderation_pending", 21L,
                "approvals_pending", 1, "bonds_approved", 8, "redemptions", 2));
        when(analytics.aiUsage(any())).thenReturn(List.of(
                Map.of("capability", "LOW", "provider", "p1", "cost_usd", 1.0),
                Map.of("capability", "TOP", "provider", "p2", "cost_usd", "3.5"),
                Map.of("capability", "ZERO", "provider", "p3", "cost_usd", 0)));
        when(analytics.securitySeries(any())).thenReturn(List.of(
                Map.of("login_failures", 5, "denied", 30), Map.of("login_failures", 20, "denied", "x")));
        List<Map<String, Object>> a = alerts(svc.admin(admin, null));
        assertThat(a).extracting(m -> m.get("level")).containsExactly("warning", "warning", "info", "info", "info", "critical", "warning");
        assertThat(a.get(0).get("title")).isEqualTo("IA em fallback em 20,0% das chamadas");
        assertThat(a.get(1).get("title")).isEqualTo("21 itens na fila de moderação");
        assertThat(a.get(2).get("title")).isEqualTo("1 marca(s)/celebridade(s) aguardando validação");
        assertThat(a.get(3).get("title")).isEqualTo("Maior custo de IA: TOP (p2) — US$ 3,50");
        assertThat(a.get(4).get("title")).isEqualTo("Conversão selo → resgate: 25%");
        assertThat(a.get(5).get("title")).isEqualTo("Pico de 20 logins falhos num único dia");
        assertThat(a.get(6).get("title")).isEqualTo("Pico de 30 acessos negados num único dia");
        assertThat(a).allSatisfy(m -> assertThat(m.keySet()).containsExactlyInAnyOrder("level", "title", "action"));
    }

    @Test
    void justBelowThresholdsNoAlerts() {
        when(analytics.kpis(any())).thenReturn(Map.of("ai_fallback_pct", 19.9, "moderation_pending", 20,
                "approvals_pending", 0, "bonds_approved", 0, "redemptions", 5));
        when(analytics.aiUsage(any())).thenReturn(List.of(Map.of("capability", "Z", "provider", "p", "cost_usd", "abc")));
        when(analytics.securitySeries(any())).thenReturn(List.of(Map.of("login_failures", 19, "denied", 29)));
        assertThat(alerts(svc.admin(admin, null))).isEmpty();
    }

    @Test
    void periodValidationAndFilterNormalisation() {
        LocalDate d = LocalDate.of(2026, 10, 1);
        assertThatThrownBy(() -> svc.admin(admin, new DashboardService.Query(d, d.minusDays(1), null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("PERIODO_INVALIDO"));
        assertThatThrownBy(() -> svc.admin(admin, new DashboardService.Query(d.minusDays(367), d, null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("PERIODO_LONGO"));
        Map<String, Object> out = svc.admin(admin, new DashboardService.Query(d.minusDays(366), d, "  BR ", ProfileType.MARCA));
        @SuppressWarnings("unchecked")
        Map<String, Object> filter = (Map<String, Object>) out.get("filter");
        assertThat(filter).containsEntry("country", "BR").containsEntry("profileType", "MARCA");
        AnalyticsQueryPort.Filter f = DashboardService.filter(new DashboardService.Query(null, null, " ", null));
        assertThat(f.country()).isNull();
        assertThat(java.time.Duration.between(f.from(), f.to()).toDays()).isEqualTo(29);
    }

    @Test
    void issuerPanelRefusedToPersonalNonAdmin() {
        CurrentUser personal = new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        ApiException denied = ApiException.forbidden("x");
        when(guard.deny(eq(personal), eq("dashboard:issuer"), anyString())).thenReturn(denied);
        assertThatThrownBy(() -> svc.issuer(personal, null)).isSameAs(denied);
    }

    @Test
    void savedLayoutGetsNewWidgetsAppendedAndSaveFiltersUnknown() {
        UserPreferences p = mock(UserPreferences.class);
        when(p.getDashboardLayoutJson()).thenReturn("{\"widgets\":[\"security\",\"kpis\"],\"hidden\":[\"jobs\"]}");
        when(prefs.findByUserId(admin.id())).thenReturn(Optional.of(p));
        @SuppressWarnings("unchecked")
        Map<String, Object> layout = (Map<String, Object>) svc.admin(admin, null).get("layout");
        @SuppressWarnings("unchecked")
        List<String> widgets = (List<String>) layout.get("widgets");
        assertThat(widgets.subList(0, 3)).containsExactly("security", "kpis", "alerts");
        assertThat(widgets).hasSameSizeAs(DashboardService.WIDGETS);
        assertThat(layout).containsEntry("hidden", List.of("jobs"));

        Map<String, Object> saved = svc.saveLayout(admin, List.of("kpis", "nope", "kpis", "alerts"), List.of("bogus", "jobs"), null);
        assertThat(saved).containsEntry("widgets", List.of("kpis", "alerts")).containsEntry("hidden", List.of("jobs"))
                .containsEntry("defaultFilter", Map.of("days", 30));
        verify(p).setDashboardLayoutJson(anyString());
        verify(prefs).save(p);
    }

    @Test
    void defaultLayoutWithoutPreferences() {
        when(prefs.findByUserId(admin.id())).thenReturn(Optional.empty());
        assertThat(svc.admin(admin, null).get("layout")).isEqualTo(
                Map.of("widgets", DashboardService.WIDGETS, "hidden", List.of(), "defaultFilter", Map.of("days", 30)));
    }
}
