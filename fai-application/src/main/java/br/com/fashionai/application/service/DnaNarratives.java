package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.DnaService.CellRef;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Season;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Regras puras da Seção B: dados de cada narrativa (ordem, agrupamentos, medidores de Hype v2, harmonia).
 */
final class DnaNarratives {
    private DnaNarratives() {
    }

    /** Score v2 que pode ordenar (AVAILABLE); nulo = sem Hype (dados insuficientes ou não calculado) — sempre por último. */
    static Double hypeScoreOf(Map<String, Object> v2) {
        return v2 != null && v2.get("score") instanceof Number n ? n.doubleValue() : null;
    }

    /**
     * Dados específicos de cada narrativa (Seção B): ordenação, agrupamento e elementos gráficos. {@code hypeByScheme} =
     * resumo v2 de cada célula já filtrado pela privacidade de quem vê (só a HYPE_FOCUS usa).
     */
    static Map<String, Object> narrativeData(DnaScheme d, List<CellRef> items, Map<UUID, List<SchemeItem>> itemsBy, Map<UUID, Map<String, Object>> hypeByScheme) {
        if (!"DNA_COMPLETO".equals(d.getTargetElement()) || d.getNarrativeType() == null) {
            return Map.of();
        }
        Map<String, Object> n = new LinkedHashMap<>();
        switch (d.getNarrativeType()) {
            case TIMELINE -> n.put("order", items.stream().sorted(Comparator.comparing((CellRef i) -> i.scheme().getCreatedAt(), Comparator.nullsLast(Comparator.naturalOrder())))
                    .map(i -> i.scheme().getId()).toList());
            case MOMENTOS_MARCANTES -> {
                Optional<CellRef> cover = items.stream().filter(CellRef::milestone).findFirst();
                n.put("cover", cover.map(i -> i.scheme().getId()).orElse(items.isEmpty() ? null : items.get(0).scheme().getId()));
                n.put("coverLabel", cover.map(CellRef::eraLabel).orElse(null));
            }
            case PRIMEIRA_VEZ -> {
                List<Map<String, Object>> firsts = new ArrayList<>();
                Set<String> occ = new HashSet<>(), brands = new HashSet<>();
                List<CellRef> chrono = items.stream().sorted(Comparator.comparing((CellRef i) -> i.scheme().getCreatedAt(), Comparator.nullsLast(Comparator.naturalOrder()))).toList();
                for (int i = 0; i < chrono.size(); i++) {
                    Scheme s = chrono.get(i).scheme();
                    if (i == 0) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", Msg.t("dna.n1_esquema_salvo"), "kind", "PRIMEIRO"));
                        occ.addAll(Json.csv(s.getOccasion()));
                        itemsBy.getOrDefault(s.getId(), List.of()).forEach(si -> brands.add(String.valueOf(si.getWardrobeItem().getBrandName())));
                        continue;
                    }
                    String newOcc = Json.csv(s.getOccasion()).stream().filter(o -> !occ.contains(o)).findFirst().orElse(null);
                    String newBrand = itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> si.getWardrobeItem().getBrandName())
                            .filter(b -> b != null && !brands.contains(b)).findFirst().orElse(null);
                    if (newOcc != null) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", Msg.t("dna.n1_vez_em", newOcc), "kind", "OCASIAO", "value", newOcc));
                    } else if (newBrand != null) {
                        firsts.add(Map.of("schemeId", s.getId(), "label", Msg.t("dna.n1_peca", newBrand), "kind", "MARCA", "value", newBrand));
                    }
                    occ.addAll(Json.csv(s.getOccasion()));
                    itemsBy.getOrDefault(s.getId(), List.of()).forEach(si -> brands.add(String.valueOf(si.getWardrobeItem().getBrandName())));
                }
                n.put("firsts", firsts);
            }
            case CAPSULA_VERSATILIDADE -> {
                Map<UUID, Integer> use = new LinkedHashMap<>();
                Map<UUID, WardrobeItem> byId = new HashMap<>();
                itemsBy.values().forEach(l -> l.forEach(si -> {
                    use.merge(si.getWardrobeItem().getId(), 1, Integer::sum);
                    byId.put(si.getWardrobeItem().getId(), si.getWardrobeItem());
                }));
                n.put("basePieces", use.entrySet().stream().sorted(Map.Entry.<UUID, Integer>comparingByValue().reversed()).limit(6)
                        .map(e -> Map.of("pieceId", e.getKey(), "name", String.valueOf(byId.get(e.getKey()).getName()), "looks", e.getValue(),
                                "imageUrl", String.valueOf(byId.get(e.getKey()).getImageUrl()))).toList());
                // fator de versatilidade = looks ÷ peças-base; "rende em média" = em quantos looks cada peça-base aparece
                n.put("factor", use.isEmpty() ? 0 : Math.round(10.0 * items.size() / use.size()) / 10.0);
                n.put("baseCount", use.size());
                n.put("avgUses", use.isEmpty() ? 0 : Math.round(10.0 * use.values().stream().mapToInt(Integer::intValue).sum() / use.size()) / 10.0);
            }
            case POR_OCASIAO -> n.put("groups", items.stream().collect(Collectors.groupingBy(i -> Json.csv(i.scheme().getOccasion()).stream().findFirst().orElse("livre"),
                    LinkedHashMap::new, Collectors.mapping(i -> i.scheme().getId(), Collectors.toList()))));
            case MOOD_BOARD -> n.put("orbits", items.stream().map(i -> Map.of("schemeId", i.scheme().getId(), "orbit",
                    Json.csv(i.scheme().getStyle()).stream().anyMatch(s -> Json.csv(d.getStyle() == null ? "" : d.getStyle()).contains(s)) ? 1 : 2)).toList());
            case PALETA_DOMINANTE -> {
                Map<String, Long> freq = itemsBy.values().stream().flatMap(List::stream).map(si -> si.getWardrobeItem().getColor()).filter(Objects::nonNull)
                        .collect(Collectors.groupingBy(c -> c, Collectors.counting()));
                long total = freq.values().stream().mapToLong(Long::longValue).sum();
                n.put("band", freq.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(5)
                        .map(e -> Map.of("color", e.getKey(), "hex", String.valueOf(Taxonomy.hex(e.getKey())), "share", total == 0 ? 0 : Math.round(100.0 * e.getValue() / total))).toList());
            }
            case HARMONIA_CROMATICA -> n.put("harmony", harmony(itemsBy.values().stream().flatMap(List::stream).map(si -> si.getWardrobeItem().getColor()).toList()));
            case MARCAS_FAVORITAS -> n.put("ranking", DnaLogos.logoRanking(itemsBy.values().stream().flatMap(List::stream).toList()));
            case HYPE_FOCUS -> {
                // P2-12: medidores em HypeScore v2 (score + faixa; "sem dados" = status, nunca 0), maior Hype primeiro e
                // sem Hype por último. "hype" (v1) segue só por compatibilidade (deprecado).
                List<Map<String, Object>> meters = new ArrayList<>();
                for (CellRef i : items) {
                    Map<String, Object> v2 = hypeByScheme.getOrDefault(i.scheme().getId(), HypeScoreService.v2Summary(null, null, null));
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("schemeId", i.scheme().getId());
                    m.put("status", v2.get("status"));
                    m.put("score", v2.get("score"));
                    m.put("level", v2.get("level"));
                    meters.add(m);
                }
                meters.sort(Comparator.comparing((Map<String, Object> m) -> hypeScoreOf(m), Comparator.nullsLast(Comparator.reverseOrder())));
                n.put("meters", meters);
                n.put("basis", "HYPE_V2");
            }
            case CARTELA_SAZONAL -> n.put("season", Map.of("theme", String.valueOf(d.getSeasonalTheme()), "preset", switch (d.getSeasonalTheme() == null ? Season.AUTUMN : d.getSeasonalTheme()) {
                case WINTER -> "frost";
                case SUMMER -> "solstice";
                case AUTUMN -> "ember";
                default -> "bloom";
            }, "note", Msg.t("dna.escolher_a_cartela_sazonal_sobrescreve")));
            case LEGO -> n.put("blocks", Map.of("order", List.of("chrome", "hero", "titulo", "lista", "logos", "frase"), "socialOutsideContainer", true,
                    "note", Msg.t("dna.lego_muda_a_forma_nao")));
        }
        return n;
    }

    static String harmony(List<String> colors) {
        Set<String> fam = colors.stream().filter(Objects::nonNull).map(c -> Taxonomy.COLOR_FAMILY.get(c)).filter(Objects::nonNull)
                .filter(f -> !ColorMath.NEUTRAL_FAMILIES.contains(f)).collect(Collectors.toSet());
        if (fam.size() <= 1) {
            return "MONOCROMATICA";
        }
        Set<Set<String>> complementary = Set.of(Set.of("Azul", "Laranja"), Set.of("Vermelho", "Verde"), Set.of("Amarelo", "Roxo"));
        if (fam.size() == 2 && complementary.contains(fam)) {
            return "COMPLEMENTAR";
        }
        return fam.size() == 3 ? "TRIADICA" : fam.size() == 2 ? "ANALOGA" : "MULTICOLOR";
    }
}
