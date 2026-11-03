package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.service.ExplorerService.MIN_DATA;

/** Painel global do Explorador (RF26.CA01): volume de peças e looks públicos por país do dono, com recorte. */
final class ExplorerGlobalPanel {
    private final AnalyticsQueryPort analytics;

    ExplorerGlobalPanel(AnalyticsQueryPort analytics) {
        this.analytics = analytics;
    }

    /**
     * RF26.CA01 — painel global: um ponto por país com dados suficientes, agrupando peças e esquemas públicos pelo país do
     * dono (User.country — CA04: nenhum campo de região em peça/esquema), com recorte por estação e cor. Só volume: o Hype
     * por país é do {@code /api/hype/globe} (v2, só público).
     */
    Map<String, Object> globalPanel(CurrentUser viewer, String selectedCountry, String season, String color) {
        String se = season == null || season.isBlank() ? null : season.trim().toUpperCase(Locale.ROOT);
        if (se != null && !Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(se)) {
            throw ApiException.badRequest("ESTACAO_INVALIDA", Msg.t("explorer.estacoes_spring_summer_autumn_winter"));
        }
        String co = color == null || color.isBlank() ? null : color.trim();
        if (co != null && !Taxonomy.COLORS.containsKey(co)) {
            throw ApiException.badRequest("COR_INVALIDA", Msg.t("explorer.cor_fora_da_taxonomia", co));
        }
        AnalyticsQueryPort.GlobalFilter gf = new AnalyticsQueryPort.GlobalFilter(se, co);
        Map<String, String> dominantColor = new HashMap<>();
        Map<String, Long> best = new HashMap<>();
        for (Map<String, Object> r : analytics.countryColors()) {
            String c = String.valueOf(r.get("country"));
            long n = ((Number) r.get("total")).longValue();
            if (n > best.getOrDefault(c, -1L)) {
                best.put(c, n);
                dominantColor.put(c, String.valueOf(r.get("color")));
            }
        }
        Map<String, Map<String, Object>> byCountry = new LinkedHashMap<>();
        for (Map<String, Object> r : analytics.schemesByCountry(gf)) {
            Map<String, Object> m = byCountry.computeIfAbsent(String.valueOf(r.get("country")), k -> new LinkedHashMap<>(Map.of("country", k, "schemes", 0L, "pieces", 0L)));
            m.put("schemes", ((Number) r.get("schemes")).longValue());
        }
        for (Map<String, Object> r : analytics.piecesByCountry(gf)) {
            Map<String, Object> m = byCountry.computeIfAbsent(String.valueOf(r.get("country")), k -> new LinkedHashMap<>(Map.of("country", k, "schemes", 0L, "pieces", 0L)));
            m.put("pieces", ((Number) r.get("pieces")).longValue());
        }
        List<Map<String, Object>> points = new ArrayList<>();
        for (Map<String, Object> m : byCountry.values()) {
            long total = ((Number) m.get("schemes")).longValue() + ((Number) m.get("pieces")).longValue();
            String c = String.valueOf(m.get("country"));
            String dc = co != null ? co : dominantColor.get(c);
            m.put("total", total);
            m.put("sufficient", total >= MIN_DATA);
            m.put("dominantColor", dc);
            m.put("dominantColorHex", dc == null ? null : Taxonomy.hex(dc));
            m.put("public_schemes", m.get("schemes"));
            points.add(m);
        }
        points.sort(Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("total")).longValue()).reversed());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("countries", points);
        out.put("minData", MIN_DATA);
        out.put("filters", Map.of("season", String.valueOf(se), "color", String.valueOf(co)));
        out.put("facets", Map.of("seasons", List.of("SPRING", "SUMMER", "AUTUMN", "WINTER"),
                "colors", analytics.colorRanking(null, 12).stream().map(r -> String.valueOf(r.get("color"))).toList()));
        if (selectedCountry != null && !selectedCountry.isBlank()) {
            out.put("selected", Map.of("country", selectedCountry, "looksBySeason", analytics.looksBySeason(selectedCountry),
                    "topColors", analytics.colorRanking(selectedCountry, 5)));
        }
        out.put("legend", Msg.t("explorer.um_ponto_por_pais_com", MIN_DATA));
        return out;
    }
}
