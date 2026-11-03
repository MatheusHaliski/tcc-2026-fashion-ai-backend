package br.com.fashionai.application.hype;

import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeQueryService.GLOBE_MIN_ITEMS;
import static br.com.fashionai.application.hype.HypeQueryService.GLOBE_TOP_CANDIDATES;
import static br.com.fashionai.application.hype.HypeQueryService.NO_REGION;
import static br.com.fashionai.application.hype.HypeRankFilters.blank;
import static br.com.fashionai.application.hype.HypeRankFilters.categoriesOf;
import static br.com.fashionai.application.hype.HypeRankFilters.hasCategory;
import static br.com.fashionai.application.hype.HypeRankFilters.hasSubcategory;
import static br.com.fashionai.application.hype.HypeRankFilters.regionOf;
import static br.com.fashionai.application.hype.HypeRankFilters.round1;
import static br.com.fashionai.application.hype.HypeRankFilters.trendOf;

/** HypeScore v2 — agregados do globo por país e região (independem de quem vê; vão para o HypeCache). */
final class HypeGlobeAggregate {
    private final HypeReadCore core;

    HypeGlobeAggregate(HypeReadCore core) {
        this.core = core;
    }

    /** Agregado do recorte (independe de quem vê; vai para o HypeCache). */
    Map<String, Object> globeAggregate(HypeEntityType type, int win, String category, String subcategory, br.com.fashionai.domain.model.enums.HypeLevel min) {
        List<HypeScoreCurrent> pool = core.publicPool(type).stream()
                .filter(c -> hasCategory(c, category) && hasSubcategory(c, subcategory))
                .filter(c -> min == null || (c.getLevel() != null && c.getLevel().compareTo(min) >= 0)).toList();
        Map<UUID, Double> month = win == 30 ? core.monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet())) : Map.of();
        // Hype exibido: o score atual (1 e 7 dias) ou a média do mês (30); a ordem do destaque segue a métrica do ranking
        ToDoubleFunction<HypeScoreCurrent> hype = c -> month.getOrDefault(c.getEntityId(), c.getScore().doubleValue());
        ToDoubleFunction<HypeScoreCurrent> metric = win == 1 ? c -> trendOf(c) * 1000 + c.getScore().doubleValue() : hype;
        Map<UUID, List<String>> colors = globeColors(type, pool);

        Map<String, List<HypeScoreCurrent>> byCountry = new TreeMap<>();
        for (HypeScoreCurrent c : pool) {
            if (!blank(c.getCountry())) {
                byCountry.computeIfAbsent(c.getCountry().trim().toUpperCase(Locale.ROOT), k -> new ArrayList<>()).add(c);
            }
        }
        List<Map<String, Object>> countries = new ArrayList<>();
        byCountry.forEach((co, list) -> countries.add(globeCountry(co, list, hype, metric, colors)));
        countries.sort(Comparator.comparingInt((Map<String, Object> m) -> ((Number) m.get("count")).intValue()).reversed()
                .thenComparing(m -> String.valueOf(m.get("country"))));

        Map<String, Object> world = new LinkedHashMap<>();
        java.util.DoubleSummaryStatistics all = pool.stream().mapToDouble(hype).summaryStatistics();
        world.put("count", pool.size());
        world.put("avgHype", pool.isEmpty() ? null : round1(all.getAverage()));
        world.put("maxHype", pool.isEmpty() ? null : round1(all.getMax()));
        world.put("creators", (int) pool.stream().map(HypeScoreCurrent::getOwnerId).filter(Objects::nonNull).distinct().count());
        world.put("countries", countries.size());

        // regiões do mundo só com quem tem país (sem país = só no "mundo", nunca em "Outras regiões" no globo)
        List<HypeScoreCurrent> located = byCountry.values().stream().flatMap(List::stream).toList();
        List<Map<String, Object>> regions = new ArrayList<>();
        for (String code : br.com.fashionai.application.taxonomy.WorldRegions.codes()) {
            List<HypeScoreCurrent> in = located.stream().filter(c -> code.equals(regionOf(c))).toList();
            if (!in.isEmpty() && !NO_REGION.equals(code)) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("key", code);
                m.put("label", br.com.fashionai.application.taxonomy.WorldRegions.label(code));
                m.put("count", in.size());
                m.put("avgHype", round1(in.stream().mapToDouble(hype).average().orElse(0)));
                regions.add(m);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("world", world);
        out.put("countries", countries);
        out.put("regions", regions);
        return out;
    }

    Map<String, Object> globeCountry(String co, List<HypeScoreCurrent> list, ToDoubleFunction<HypeScoreCurrent> hype,
                                     ToDoubleFunction<HypeScoreCurrent> metric, Map<UUID, List<String>> colors) {
        String region = br.com.fashionai.application.taxonomy.WorldRegions.of(co);
        java.util.DoubleSummaryStatistics st = list.stream().mapToDouble(hype).summaryStatistics();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("country", co);
        m.put("region", region);
        m.put("regionLabel", br.com.fashionai.application.taxonomy.WorldRegions.label(region));
        m.put("count", list.size());
        m.put("creators", (int) list.stream().map(HypeScoreCurrent::getOwnerId).filter(Objects::nonNull).distinct().count());
        m.put("avgHype", round1(st.getAverage()));
        m.put("maxHype", round1(st.getMax()));
        // faixa do número exibido (a régua configurada do HypeScoreConfig, a mesma do card) — a cor do globo é sempre a faixa
        m.put("avgLevel", core.config.level(round1(st.getAverage())).name());
        m.put("maxLevel", core.config.level(round1(st.getMax())).name());
        m.put("trend", round1(list.stream().mapToDouble(HypeRankFilters::trendOf).average().orElse(0)));   // crescimento, não volume
        m.put("rising", (int) list.stream().filter(c -> c.getMomentum() == HypeMomentum.RISING || c.getMomentum() == HypeMomentum.EMERGING).count());
        Map<String, Object> levels = new LinkedHashMap<>();
        for (br.com.fashionai.domain.model.enums.HypeLevel l : br.com.fashionai.domain.model.enums.HypeLevel.values()) {
            levels.put(l.name(), (int) list.stream().filter(c -> c.getLevel() == l).count());
        }
        m.put("levels", levels);
        m.put("topLevel", list.stream().map(HypeScoreCurrent::getLevel).filter(Objects::nonNull).max(Comparator.naturalOrder()).map(Enum::name).orElse(null));
        m.put("dominantColorHex", mostFrequent(list.stream().flatMap(c -> colors.getOrDefault(c.getEntityId(), List.of()).stream()).toList(),
                Comparator.naturalOrder()).map(Taxonomy::hex).orElse(null));
        m.put("topCategory", mostFrequent(list.stream().flatMap(c -> categoriesOf(c).stream().map(x -> x.toLowerCase(Locale.ROOT)).distinct()).toList(),
                Comparator.comparingInt(HypeRankFilters::categoryOrder).thenComparing(Comparator.naturalOrder())).orElse(null));
        m.put("candidates", list.stream().sorted(Comparator.comparingDouble(metric).reversed().thenComparing(c -> c.getEntityId().toString()))
                .limit(GLOBE_TOP_CANDIDATES).map(c -> c.getEntityId().toString()).toList());
        m.put("sufficient", list.size() >= GLOBE_MIN_ITEMS);
        return m;
    }

    /** O valor mais frequente (empate: a ordem dada). */
    static Optional<String> mostFrequent(List<String> values, Comparator<String> tie) {
        Map<String, Long> n = values.stream().filter(v -> !blank(v)).collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        return n.entrySet().stream().min(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey(tie))).map(Map.Entry::getKey);
    }

    /** Cores (taxonomia) de cada item do recorte: a da peça; no look, as das peças dele. Uma leitura só. */
    Map<UUID, List<String>> globeColors(HypeEntityType type, List<HypeScoreCurrent> pool) {
        if (pool.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = pool.stream().map(HypeScoreCurrent::getEntityId).toList();
        Map<UUID, List<String>> out = new HashMap<>();
        if (type == HypeEntityType.PIECE) {
            core.pieces.findByIdIn(ids).stream().filter(w -> !blank(w.getColor())).forEach(w -> out.put(w.getId(), List.of(w.getColor())));
        } else {
            core.schemeItems.findBySchemeIdIn(ids).stream().filter(si -> si.getWardrobeItem() != null && !blank(si.getWardrobeItem().getColor()))
                    .forEach(si -> out.computeIfAbsent(si.getScheme().getId(), k -> new ArrayList<>()).add(si.getWardrobeItem().getColor()));
        }
        return out;
    }
}
