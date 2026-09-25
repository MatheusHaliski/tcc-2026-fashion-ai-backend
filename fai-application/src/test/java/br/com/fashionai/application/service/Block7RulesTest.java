package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Bloco 7 — regras puras da busca paginada (RF8), do Insight Generator (RF26) e dos alertas do dashboard. */
class Block7RulesTest {
    @Test
    void searchOffsetCursorRoundTripsAndRejectsGarbage() {
        assertThat(SearchService.offsetOf(null)).isZero();
        assertThat(SearchService.offsetOf("")).isZero();
        assertThat(SearchService.offsetOf(SearchService.encodeOffset(24))).isEqualTo(24);
        assertThat(SearchService.offsetOf(SearchService.encodeOffset(48))).isEqualTo(48);
        // o cursor é base64url: pode ir na URL sem escape
        assertThat(SearchService.encodeOffset(96)).doesNotContain("+", "/", "=");
        // limite de profundidade para não varrer o índice inteiro
        assertThat(SearchService.offsetOf(SearchService.encodeOffset(50_000))).isEqualTo(10_000);
    }

    @Test
    void consecutiveOffsetPagesNeverOverlap() {
        List<Integer> all = java.util.stream.IntStream.range(0, 70).boxed().toList();
        Set<Integer> seen = new HashSet<>();
        int offset = 0;
        int size = 24;
        while (offset < all.size()) {
            List<Integer> page = all.subList(offset, Math.min(all.size(), offset + size));
            for (Integer i : page) {
                assertThat(seen.add(i)).as("item %s repetido", i).isTrue();
            }
            offset = SearchService.offsetOf(SearchService.encodeOffset(offset + size));
        }
        assertThat(seen).hasSize(70);
    }

    @Test
    void insightTextSpeaksPortugueseAndUsesHypeByColor() {
        Map<String, Object> rankings = Map.of(
                "topCountries", List.of(Map.of("label", "BR", "value", 14)),
                "topBrands", List.of(Map.of("label", "Zara", "value", 12)),
                "topColors", List.of(Map.of("label", "white", "value", 24)),
                "hypeByColor", List.of(Map.of("label", "burgundy", "value", 88.5)),
                "hypeBySeason", List.of(Map.of("label", "SPRING", "value", 73.5)));
        String text = LocalAdvisors.insightText(rankings);
        assertThat(text).contains("Brasil", "Zara", "bordô", "a primavera").doesNotContain("SPRING", "burgundy", "white");
    }

    @Test
    void insightWithoutDataSaysSo() {
        assertThat(LocalAdvisors.insightText(Map.of())).contains("não há dados suficientes");
    }

    @Test
    void dashboardAlertsTurnNumbersIntoDecisions() {
        List<Map<String, Object>> alerts = DashboardService.alerts(
                Map.of("ai_fallback_pct", 45.0, "moderation_pending", 3, "approvals_pending", 2, "bonds_approved", 4, "redemptions", 1),
                List.of(Map.of("capability", "TRY_ON", "provider", "fashn", "cost_usd", 4.17)));
        assertThat(alerts).extracting(a -> a.get("title").toString())
                .anyMatch(t -> t.contains("fallback em 45,0%"))   // decimal no idioma da requisição (pt-BR fora de request)
                .anyMatch(t -> t.contains("2 marca(s)/celebridade(s)"))
                .anyMatch(t -> t.contains("TRY_ON"))
                .anyMatch(t -> t.contains("25%"));
        assertThat(alerts).allMatch(a -> a.containsKey("action"));
    }
}
