package br.com.fashionai.application.service;

import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Regras puras de logos e cor dominante dos esquemas (ranking por marca, recorte por anatomia/narrativa).
 */
final class DnaLogos {
    private DnaLogos() {
    }

    /** Regra transversal de logos: nº de peças por marca; empate → mais peças em superior/inferior. */
    static List<Map<String, Object>> logoRanking(List<SchemeItem> items) {
        Map<String, int[]> counts = new LinkedHashMap<>();
        Map<String, String> logo = new HashMap<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            String brand = w.getBrand() != null ? w.getBrand().getName() : w.getBrandName();
            if (brand == null || brand.isBlank()) {
                continue;
            }
            int[] c = counts.computeIfAbsent(brand, k -> new int[2]);
            c[0]++;
            if ("upper_piece".equals(w.getCategory()) || "lower_piece".equals(w.getCategory())) {
                c[1]++;
            }
            if (w.getBrand() != null && w.getBrand().getLogoUrl() != null) {
                logo.put(brand, w.getBrand().getLogoUrl());
            }
        }
        return counts.entrySet().stream().sorted((a, b) -> a.getValue()[0] != b.getValue()[0] ? b.getValue()[0] - a.getValue()[0] : b.getValue()[1] - a.getValue()[1])
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("brand", e.getKey());
                    m.put("pieces", e.getValue()[0]);
                    m.put("structural", e.getValue()[1]);
                    m.put("logoUrl", logo.get(e.getKey()));
                    return m;
                })
                .toList();
    }

    /** Quantos logos cada anatomia/narrativa exibe (o resto só ao abrir o DNA completo). */
    static Map<String, Object> logoCut(DnaScheme d) {
        if ("DNA_COMPLETO".equals(d.getTargetElement()) && d.getNarrativeType() != null) {
            return switch (d.getNarrativeType()) {
                case TIMELINE, PALETA_DOMINANTE -> Map.of("shown", 1, "counter", true);
                case MOMENTOS_MARCANTES -> Map.of("shown", 1, "counter", false, "onlyCover", true);
                case PRIMEIRA_VEZ -> Map.of("shown", "variable", "counter", false);
                case CAPSULA_VERSATILIDADE -> Map.of("shown", 2, "counter", true);
                case POR_OCASIAO -> Map.of("shown", 1, "counter", false);
                case MOOD_BOARD -> Map.of("shown", 3, "counter", false);
                case MARCAS_FAVORITAS -> Map.of("shown", "all", "counter", false, "isContent", true);
                case HYPE_FOCUS, HARMONIA_CROMATICA, CARTELA_SAZONAL -> Map.of("shown", 1, "counter", true);
                case LEGO -> Map.of("shown", 3, "counter", true);
            };
        }
        return switch (String.valueOf(d.getCardLayout())) {
            case "LATERAL" -> Map.of("shown", 2, "counter", true, "row", true);
            case "HORIZONTAL" -> Map.of("shown", "perCell", "counter", false);
            default -> Map.of("shown", 1, "counter", true);
        };
    }

    static String dominantBrand(List<SchemeItem> items) {
        return logoRanking(items).stream().findFirst().map(m -> String.valueOf(m.get("brand"))).orElse(null);
    }

    /** Cor dominante do esquema: média ponderada — peças estruturais (superior, inferior, peça única) pesam 3, as demais 1. */
    static String dominantColor(List<SchemeItem> items) {
        Map<String, Integer> weight = new LinkedHashMap<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            if (w.getColor() != null) {
                weight.merge(w.getColor(), Set.of("upper_piece", "lower_piece", "full_body_piece").contains(w.getCategory()) ? 3 : 1, Integer::sum);
            }
        }
        return weight.entrySet().stream().max(Map.Entry.comparingByValue()).map(e -> Taxonomy.hex(e.getKey())).orElse(null);
    }
}
