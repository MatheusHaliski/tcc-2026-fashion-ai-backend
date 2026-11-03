package br.com.fashionai.application.hype;

import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeRankFilters.blank;
import static br.com.fashionai.application.hype.HypeRankFilters.categoriesOf;
import static br.com.fashionai.application.hype.HypeRankFilters.hasCategory;
import static br.com.fashionai.application.hype.HypeRankFilters.inRegion;
import static br.com.fashionai.application.hype.HypeRankFilters.norm;
import static br.com.fashionai.application.hype.HypeRankFilters.regionOf;
import static br.com.fashionai.application.hype.HypeRankFilters.round1;
import static br.com.fashionai.application.hype.HypeRankFilters.subcategoriesOf;
import static br.com.fashionai.application.hype.HypeRankFilters.upper;

/** HypeScore v2 — contagens dos filtros do ranking e a comparação "Hype por região". */
final class HypeRankingFacets {
    private final HypeReadCore core;

    HypeRankingFacets(HypeReadCore core) {
        this.core = core;
    }

    /** Contagens dos filtros e a comparação "Hype por região" (média do Hype de cada região no tipo/categoria atuais). */
    Map<String, Object> rankingFacets(HypeEntityType type, int window, String region, String category) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        String r = upper(region);
        String cat = norm(category);
        return core.cache.get("ranking-facets:" + type + ":" + win + ":" + r + ":" + cat, () -> facets(type, win, r, cat));
    }

    Map<String, Object> facets(HypeEntityType type, int win, String region, String category) {
        List<HypeScoreCurrent> pool = core.publicPool(type);
        Map<UUID, Double> month = win == 30 ? core.monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet())) : Map.of();
        // "Hype" da região: o HypeScore atual (1 e 7 dias) ou a média do mês (30 dias) — o trend do "Hoje" ordena, mas não é Hype
        ToDoubleFunction<HypeScoreCurrent> hype = c -> month.getOrDefault(c.getEntityId(), c.getScore().doubleValue());
        List<HypeScoreCurrent> byCategory = pool.stream().filter(c -> hasCategory(c, category)).toList();
        List<HypeScoreCurrent> scoped = byCategory.stream().filter(c -> inRegion(c, region)).toList();

        List<Map<String, Object>> regions = new ArrayList<>();
        for (String code : br.com.fashionai.application.taxonomy.WorldRegions.codes()) {
            List<HypeScoreCurrent> in = byCategory.stream().filter(c -> code.equals(regionOf(c))).toList();
            if (!in.isEmpty()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("key", code);
                m.put("label", br.com.fashionai.application.taxonomy.WorldRegions.label(code));
                m.put("count", in.size());
                m.put("avgHype", round1(in.stream().mapToDouble(hype).average().orElse(0)));
                regions.add(m);
            }
        }
        Map<String, Object> world = new LinkedHashMap<>();
        world.put("count", byCategory.size());
        world.put("avgHype", byCategory.isEmpty() ? null : round1(byCategory.stream().mapToDouble(hype).average().orElse(0)));

        Map<String, Long> countryCount = scoped.stream().filter(c -> !blank(c.getCountry()))
                .collect(Collectors.groupingBy(c -> c.getCountry().trim().toUpperCase(Locale.ROOT), TreeMap::new, Collectors.counting()));
        List<Map<String, Object>> countries = countryCount.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(e -> Map.<String, Object>of("key", e.getKey(), "count", e.getValue())).toList();

        Map<String, Long> categoryCount = new TreeMap<>(Comparator.comparingInt(HypeRankFilters::categoryOrder).thenComparing(Comparator.naturalOrder()));
        pool.stream().filter(c -> inRegion(c, region))
                .forEach(c -> categoriesOf(c).stream().map(x -> x.toLowerCase(Locale.ROOT)).distinct().forEach(x -> categoryCount.merge(x, 1L, Long::sum)));
        List<Map<String, Object>> categories = categoryCount.entrySet().stream()
                .map(e -> Map.<String, Object>of("key", e.getKey(), "count", e.getValue())).toList();

        Map<String, Long> subCount = new TreeMap<>();
        Map<String, String> subCategory = new HashMap<>();
        for (HypeScoreCurrent c : scoped) {
            for (String s : subcategoriesOf(c).stream().map(x -> x.toLowerCase(Locale.ROOT)).distinct().toList()) {
                // peça: a própria categoria; look: a categoria da subcategoria na taxonomia (o look mistura várias)
                String owner = type == HypeEntityType.PIECE && c.getCategory() != null ? c.getCategory().toLowerCase(Locale.ROOT) : Taxonomy.categoryOf(s);
                if (!category.isEmpty() && !category.equalsIgnoreCase(owner)) {
                    continue;
                }
                subCount.merge(s, 1L, Long::sum);
                subCategory.putIfAbsent(s, owner);
            }
        }
        List<Map<String, Object>> subcategories = subCount.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("key", e.getKey());
                    m.put("category", subCategory.get(e.getKey()));
                    m.put("count", e.getValue());
                    return m;
                }).toList();

        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("region", region.isEmpty() ? null : region);
        filters.put("category", category.isEmpty() ? null : category);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("window", win);
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("filters", filters);
        out.put("total", scoped.size());
        out.put("world", world);
        out.put("regions", regions);
        out.put("countries", countries);
        out.put("categories", categories);
        out.put("subcategories", subcategories);
        return out;
    }
}
