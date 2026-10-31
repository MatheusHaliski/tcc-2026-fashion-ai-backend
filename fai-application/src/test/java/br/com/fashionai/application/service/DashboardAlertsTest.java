package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Regras puras dos alertas do dashboard extraídas no lote 16 (sem Spring, sem porta). */
class DashboardAlertsTest {

    @Test
    void numAcceptsNumbersBigDecimalAndTextAndFallsBackToZero() {
        assertThat(DashboardAlerts.num(3)).isEqualTo(3.0);
        assertThat(DashboardAlerts.num(new BigDecimal("2.50"))).isEqualTo(2.5);
        assertThat(DashboardAlerts.num("7.25")).isEqualTo(7.25);
        assertThat(DashboardAlerts.num("n/a")).isZero();
        assertThat(DashboardAlerts.num(null)).isZero();
    }

    @Test
    void emptyInputsProduceNoAlerts() {
        assertThat(DashboardAlerts.alerts(Map.of(), List.of())).isEmpty();
        assertThat(DashboardAlerts.securityAlerts(List.of())).isEmpty();
    }

    @Test
    void securityPeaksUseTheWorstSingleDay() {
        List<Map<String, Object>> a = DashboardAlerts.securityAlerts(List.of(
                Map.of("login_failures", 10, "denied", 50), Map.of("login_failures", 25, "denied", 1)));
        assertThat(a).extracting(m -> m.get("level")).containsExactly("critical", "warning");
        assertThat(a.get(0).get("title")).isEqualTo("Pico de 25 logins falhos num único dia");
        assertThat(a.get(1).get("title")).isEqualTo("Pico de 50 acessos negados num único dia");
    }

    @Test
    void conversionRoundsToNearestPercent() {
        List<Map<String, Object>> a = DashboardAlerts.alerts(Map.of("bonds_approved", 3, "redemptions", 2), List.of());
        assertThat(a).singleElement().satisfies(m -> {
            assertThat(m.get("level")).isEqualTo("info");
            assertThat(m.get("title")).isEqualTo("Conversão selo → resgate: 67%");
        });
    }

    @Test
    void alertIsImmutableTriple() {
        assertThat(DashboardAlerts.alert("info", "t", "a")).isEqualTo(Map.of("level", "info", "title", "t", "action", "a"));
    }
}
