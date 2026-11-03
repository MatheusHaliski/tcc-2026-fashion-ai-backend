package br.com.fashionai.application.service;

import br.com.fashionai.application.service.ShowcaseService.RunwayEntry;
import br.com.fashionai.domain.model.HypeScoreCurrent;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Regras puras da Passarela 3D: a ordem de cada ranking (HypeScore v2 público, crescimento, recência) e as facetas. */
final class ShowcaseRunwayOrder {
    private ShowcaseRunwayOrder() {
    }

    /**
     * Ordem de cada ranking da Passarela. Top 100: HypeScore v2 PÚBLICO (sem Hype público = por último, nunca 0).
     * Em alta: crescimento — momento RISING/EMERGING primeiro, depois a dimensão TREND e o score (curtidas e salvos são
     * popularidade e não entram). Recentes: hora do Look do Dia. Desempate estável: mais recente, depois o id.
     */
    static Comparator<RunwayEntry> runwayOrder(String ranking, Function<RunwayEntry, HypeScoreCurrent> hype) {
        Comparator<RunwayEntry> recent = Comparator.comparing((RunwayEntry e) -> e.dl().getCreatedAt() == null ? Instant.EPOCH : e.dl().getCreatedAt())
                .reversed().thenComparing(e -> e.dl().getScheme().getId());
        Comparator<Double> desc = Comparator.nullsLast(Comparator.reverseOrder());
        return switch (ranking) {
            case "EM_ALTA" -> Comparator.comparing((RunwayEntry e) -> SearchHype.risingFor(hype.apply(e), false) ? 0 : 1)
                    .thenComparing(e -> SearchHype.trendFor(hype.apply(e), false), desc)
                    .thenComparing(e -> SearchHype.publicScore(hype.apply(e)), desc)
                    .thenComparing(recent);
            case "RECENTES" -> recent;
            default -> Comparator.comparing((RunwayEntry e) -> SearchHype.publicScore(hype.apply(e)), desc).thenComparing(recent);
        };
    }

    static List<Map<String, Object>> count(List<String> values) {
        Map<String, Long> c = new java.util.TreeMap<>();
        values.forEach(v -> c.merge(v, 1L, Long::sum));
        return c.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> Map.<String, Object>of("value", e.getKey(), "count", e.getValue())).toList();
    }
}
