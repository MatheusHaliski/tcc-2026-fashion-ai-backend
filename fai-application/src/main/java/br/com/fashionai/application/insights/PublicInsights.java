package br.com.fashionai.application.insights;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.service.ExplorerService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.WorldRegions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.ToDoubleFunction;
import java.util.stream.Stream;

import static br.com.fashionai.application.insights.Insight.HYPE_V2;
import static br.com.fashionai.application.insights.Insight.PUBLIC_AGGREGATES;
import static br.com.fashionai.application.insights.Insight.PUBLIC_RANKING;
import static br.com.fashionai.application.insights.Insight.Tone.ATTENTION;
import static br.com.fashionai.application.insights.Insight.Tone.NEUTRAL;
import static br.com.fashionai.application.insights.Insight.Tone.POSITIVE;
import static br.com.fashionai.application.insights.InsightMath.action;
import static br.com.fashionai.application.insights.InsightMath.args;
import static br.com.fashionai.application.insights.InsightMath.enc;
import static br.com.fashionai.application.insights.InsightMath.fmt0;
import static br.com.fashionai.application.insights.InsightMath.fmt1;
import static br.com.fashionai.application.insights.InsightMath.insight;
import static br.com.fashionai.application.insights.InsightMath.metric;
import static br.com.fashionai.application.insights.InsightMath.round;
import static br.com.fashionai.application.insights.InsightMath.round1;

/**
 * Insights públicos do Explorador. Leem SÓ a população {@code public_eligible} com score disponível (item privado, em
 * moderação, de perfil privado ou de conta de teste nunca entra) e agregados públicos que o {@link ExplorerService} já
 * calcula. Nada aqui depende de quem vê — por isso o resultado vai para o {@code HypeCache} por geração.
 */
final class PublicInsights {
    /** Recorte com menos itens que isso não vira "tendência" nem "líder". */
    static final int MIN_GROUP_ITEMS = 2;
    static final int MIN_REGION_ITEMS = 3;
    /** Atividade ponderada mínima na janela atual para falar em crescimento. */
    static final double MIN_ACTIVITY = 3;
    /** Crescimento mínimo (%) para "em crescimento". */
    static final double RISING_PERCENT = 10;
    static final double HOT_TREND = 60;

    record Filters(int window, String region, String category, String subcategory) {
        Filters withoutRegion() {
            return new Filters(window, "", category, subcategory);
        }
    }

    private final HypeScoreConfig config;
    private final HypeScoreCurrentRepository current;
    private final HypeQueryService hype;
    private final ExplorerService explorer;

    PublicInsights(HypeScoreConfig config, HypeScoreCurrentRepository current, HypeQueryService hype, ExplorerService explorer) {
        this.config = config;
        this.current = current;
        this.hype = hype;
        this.explorer = explorer;
    }

    List<Insight> build(InsightContext ctx, Filters f) {
        return switch (ctx) {
            case EXPLORER_TRENDING -> trending(f);
            case EXPLORER_RANKING -> ranking(f);
            case EXPLORER_MAP -> map(f);
            case EXPLORER_BRANDS -> brands(f);
            case EXPLORER_GLOBAL -> global(f);
            case EXPLORER_RUNWAY -> runway(f);
            default -> List.of();
        };
    }

    /** População pública do recorte (defesa em profundidade: confere de novo a elegibilidade de cada linha). */
    List<HypeScoreCurrent> pool(HypeEntityType type, Filters f) {
        List<HypeScoreCurrent> rows = current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(type, config.algorithmVersion(), HypeStatus.AVAILABLE);
        return (rows == null ? List.<HypeScoreCurrent>of() : rows).stream()
                .filter(Objects::nonNull)
                .filter(HypeScoreCurrent::isPublicEligible)
                .filter(c -> c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null)
                .filter(c -> f.region().isEmpty() || f.region().equals(InsightMath.regionOf(c)))
                .filter(c -> f.category().isEmpty() || InsightMath.categoriesOf(c).contains(f.category()))
                .filter(c -> f.subcategory().isEmpty() || InsightMath.subcategoriesOf(c).contains(f.subcategory()))
                .toList();
    }

    private String scope(Filters f) {
        return f.region().isEmpty() ? "" : Msg.t("insights.scope.region", regionLabel(f.region()));
    }

    static String regionLabel(String code) {
        return Msg.resolve(WorldRegions.label(code));
    }

    static String countryLabel(String code) {
        if (code == null || code.isBlank()) {
            return "?";
        }
        String name = Locale.of("", code.trim().toUpperCase(Locale.ROOT)).getDisplayCountry(Msg.locale());
        return name == null || name.isBlank() ? code : name;
    }

    private static String label(String code) {
        return Taxonomy.label(code);
    }

    // ================================================================== Em alta (tendência ≠ popularidade)
    List<Insight> trending(Filters f) {
        List<HypeScoreCurrent> ps = pool(HypeEntityType.PIECE, f);
        List<HypeScoreCurrent> ls = pool(HypeEntityType.SCHEME, f);
        List<Insight> out = new ArrayList<>();
        String scope = scope(f);
        int wd = config.windowDays();
        double alpha = config.growthSmoothing();
        if (f.category().isEmpty()) {
            InsightMath.growthBy(ps, InsightMath::categoriesOf, f.window(), wd, alpha, MIN_GROUP_ITEMS, MIN_ACTIVITY).stream()
                    .filter(g -> g.percent() >= RISING_PERCENT).findFirst()
                    .ifPresent(g -> out.add(insight("CATEGORY_RISING", POSITIVE, 0.95, "insights.category_rising.text",
                            args(label(g.key()), fmt0(g.percent()), g.days(), scope),
                            metric("insights.metric.crescimento", round(g.percent()), "%"),
                            action("insights.action.ver_em_alta", "/explorer?tab=trending&category=" + enc(g.key())), HYPE_V2, PUBLIC_RANKING)));
            List<InsightMath.Avg> pop = InsightMath.averageBy(ps, InsightMath::categoriesOf, InsightMath::popularity, MIN_GROUP_ITEMS);
            List<InsightMath.Avg> tr = InsightMath.averageBy(ps, InsightMath::categoriesOf, InsightMath::trend, MIN_GROUP_ITEMS);
            if (!pop.isEmpty() && !tr.isEmpty() && !pop.get(0).key().equals(tr.get(0).key())) {
                out.add(insight("TREND_VS_POPULARITY", NEUTRAL, 0.9, "insights.trend_vs_popularity.text",
                        args(label(pop.get(0).key()), fmt0(pop.get(0).value()), label(tr.get(0).key()), fmt0(tr.get(0).value())),
                        metric("insights.metric.trend_medio", round(tr.get(0).value()), "pts"),
                        action("insights.action.ver_em_alta", "/explorer?tab=trending&category=" + enc(tr.get(0).key())), HYPE_V2, PUBLIC_RANKING));
            }
        }
        if (f.subcategory().isEmpty()) {
            InsightMath.growthBy(ps, InsightMath::subcategoriesOf, f.window(), wd, alpha, MIN_GROUP_ITEMS, MIN_ACTIVITY).stream()
                    .filter(g -> g.percent() >= RISING_PERCENT).findFirst()
                    .ifPresent(g -> out.add(insight("SUBCATEGORY_RISING", POSITIVE, 0.8, "insights.subcategory_rising.text",
                            args(label(g.key()), fmt0(g.percent()), g.days(), g.items(), scope),
                            metric("insights.metric.crescimento", round(g.percent()), "%"),
                            action("insights.action.ver_em_alta", "/explorer?tab=trending&subcategory=" + enc(g.key())), HYPE_V2, PUBLIC_RANKING)));
        }
        List<HypeScoreCurrent> all = Stream.concat(ps.stream(), ls.stream()).toList();
        InsightMath.growthBy(all, c -> Json.csv(c.getStyles()), f.window(), wd, alpha, MIN_GROUP_ITEMS, MIN_ACTIVITY).stream()
                .filter(g -> g.percent() >= RISING_PERCENT).findFirst()
                .ifPresent(g -> out.add(insight("STYLE_RISING", POSITIVE, 0.75, "insights.style_rising.text",
                        args(label(g.key()), fmt0(g.percent()), g.days(), scope),
                        metric("insights.metric.crescimento", round(g.percent()), "%"),
                        action("insights.action.ver_em_alta", "/explorer?tab=trending&style=" + enc(g.key())), HYPE_V2, PUBLIC_RANKING)));
        // a mesma régua do HypeCalculator: popular sem crescer × pequeno crescendo rápido
        long popularFlat = ps.stream().filter(c -> InsightMath.popularity(c) >= 70 && InsightMath.trend(c) < 55).count();
        long smallFast = ps.stream().filter(c -> InsightMath.popularity(c) <= 55 && InsightMath.trend(c) >= 70).count();
        if (popularFlat > 0) {
            out.add(insight("POPULAR_NOT_GROWING", NEUTRAL, 0.7, "insights.popular_not_growing.text", args(popularFlat),
                    metric("insights.metric.pecas", popularFlat, "peças"), null, HYPE_V2, PUBLIC_RANKING));
        }
        if (smallFast > 0) {
            out.add(insight("SMALL_BUT_GROWING", POSITIVE, 0.72, "insights.small_but_growing.text", args(smallFast),
                    metric("insights.metric.pecas", smallFast, "peças"),
                    action("insights.action.ver_em_alta", "/explorer?tab=trending&window=1"), HYPE_V2, PUBLIC_RANKING));
        }
        long emerging = all.stream().filter(c -> c.getMomentum() == HypeMomentum.EMERGING).count();
        if (all.size() >= MIN_REGION_ITEMS && emerging > 0) {
            double pct = 100.0 * emerging / all.size();
            out.add(insight("EMERGING_SHARE", POSITIVE, 0.6, "insights.emerging_share.text", args(fmt0(pct), emerging, all.size()),
                    metric("insights.metric.emergentes", round(pct), "%"), null, HYPE_V2, PUBLIC_RANKING));
        }
        return out;
    }

    // ================================================================== Ranking por região
    List<Insight> ranking(Filters f) {
        List<HypeScoreCurrent> all = Stream.concat(pool(HypeEntityType.PIECE, f).stream(), pool(HypeEntityType.SCHEME, f).stream()).toList();
        List<Insight> out = new ArrayList<>();
        if (all.isEmpty()) {
            return out;
        }
        boolean today = f.window() <= 1;
        ToDoubleFunction<HypeScoreCurrent> metric = today ? InsightMath::trend : InsightMath::score;
        String unitLabel = today ? "insights.metric.trend_medio" : "insights.metric.hype_medio";
        int wd = config.windowDays();
        double alpha = config.growthSmoothing();
        List<HypeScoreCurrent> located = all.stream().filter(c -> !"OUTRAS".equals(InsightMath.regionOf(c))).toList();
        if (f.region().isEmpty()) {
            List<InsightMath.Avg> regions = InsightMath.averageBy(located, c -> List.of(InsightMath.regionOf(c)), metric, MIN_REGION_ITEMS);
            if (!regions.isEmpty()) {
                InsightMath.Avg leader = regions.get(0);
                out.add(insight("REGION_LEADER", POSITIVE, 0.95, today ? "insights.region_leader.text_trend" : "insights.region_leader.text",
                        args(regionLabel(leader.key()), fmt1(leader.value()), leader.items()),
                        metric(unitLabel, round1(leader.value()), "pts"),
                        action("insights.action.ver_ranking", "/explorer?tab=ranking&region=" + enc(leader.key())), HYPE_V2, PUBLIC_RANKING));
                topCategory(located.stream().filter(c -> leader.key().equals(InsightMath.regionOf(c))).toList(), leader.key(), metric, unitLabel, today)
                        .ifPresent(out::add);
            }
            InsightMath.Growth best = null;
            String bestRegion = null;
            for (String r : located.stream().map(InsightMath::regionOf).distinct().sorted().toList()) {
                List<HypeScoreCurrent> in = located.stream().filter(c -> r.equals(InsightMath.regionOf(c))).toList();
                List<InsightMath.Growth> g = InsightMath.growthBy(in, InsightMath::categoriesOf, f.window(), wd, alpha, MIN_GROUP_ITEMS, MIN_ACTIVITY);
                if (!g.isEmpty() && g.get(0).percent() >= RISING_PERCENT && (best == null || g.get(0).percent() > best.percent())) {
                    best = g.get(0);
                    bestRegion = r;
                }
            }
            if (best != null) {
                out.add(regionRising(bestRegion, best));
            }
        } else {
            List<HypeScoreCurrent> world = Stream.concat(pool(HypeEntityType.PIECE, f.withoutRegion()).stream(),
                    pool(HypeEntityType.SCHEME, f.withoutRegion()).stream()).toList();
            if (all.size() >= MIN_REGION_ITEMS && !world.isEmpty()) {
                double here = all.stream().mapToDouble(metric).average().orElse(0);
                double there = world.stream().mapToDouble(metric).average().orElse(0);
                out.add(insight("REGION_VS_WORLD", here >= there ? POSITIVE : NEUTRAL, 0.9,
                        today ? "insights.region_vs_world.text_trend" : "insights.region_vs_world.text",
                        args(regionLabel(f.region()), fmt1(here), fmt1(there), all.size()),
                        metric(unitLabel, round1(here), "pts"), null, HYPE_V2, PUBLIC_RANKING));
            }
            topCategory(all, f.region(), metric, unitLabel, today).ifPresent(out::add);
            InsightMath.growthBy(all, InsightMath::categoriesOf, f.window(), wd, alpha, MIN_GROUP_ITEMS, MIN_ACTIVITY).stream()
                    .filter(g -> g.percent() >= RISING_PERCENT).findFirst().ifPresent(g -> out.add(regionRising(f.region(), g)));
        }
        long piecesN = all.stream().filter(c -> c.getEntityType() == HypeEntityType.PIECE).count();
        long regionsN = located.stream().map(InsightMath::regionOf).distinct().count();
        out.add(insight("RANKING_BASE", NEUTRAL, 0.5, "insights.ranking_base.text", args(all.size(), piecesN, all.size() - piecesN, regionsN),
                metric("insights.metric.itens_publicos", all.size(), null), null, PUBLIC_RANKING));
        return out;
    }

    private java.util.Optional<Insight> topCategory(List<HypeScoreCurrent> rows, String region, ToDoubleFunction<HypeScoreCurrent> metric, String unitLabel,
                                                    boolean today) {
        return InsightMath.averageBy(rows, InsightMath::categoriesOf, metric, MIN_GROUP_ITEMS).stream().findFirst()
                .map(a -> insight("REGION_TOP_CATEGORY", NEUTRAL, 0.85, today ? "insights.region_top_category.text_trend" : "insights.region_top_category.text",
                        args(regionLabel(region), label(a.key()), fmt1(a.value()), a.items()),
                        metric(unitLabel, round1(a.value()), "pts"),
                        action("insights.action.ver_ranking", "/explorer?tab=ranking&region=" + enc(region) + "&category=" + enc(a.key())), HYPE_V2, PUBLIC_RANKING));
    }

    private Insight regionRising(String region, InsightMath.Growth g) {
        return insight("REGION_CATEGORY_RISING", POSITIVE, 0.9, "insights.region_category_rising.text",
                args(regionLabel(region), label(g.key()), fmt0(g.percent()), g.days()),
                metric("insights.metric.crescimento", round(g.percent()), "%"),
                action("insights.action.ver_ranking", "/explorer?tab=ranking&region=" + enc(region) + "&category=" + enc(g.key())), HYPE_V2, PUBLIC_RANKING);
    }

    // ================================================================== Painel global (globo)
    @SuppressWarnings("unchecked")
    List<Insight> map(Filters f) {
        List<Insight> out = new ArrayList<>();
        Map<String, Object> panel = explorer.globalPanel(null, null);
        List<Map<String, Object>> countries = panel != null && panel.get("countries") instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
        countries = countries.stream().filter(m -> m.get("country") != null && !"null".equals(String.valueOf(m.get("country"))))
                .filter(m -> f.region().isEmpty() || f.region().equals(WorldRegions.of(String.valueOf(m.get("country"))))).toList();
        countries.stream().max(Comparator.comparingLong((Map<String, Object> m) -> longOf(m.get("total"))).thenComparing(m -> String.valueOf(m.get("country")),
                        Comparator.reverseOrder()))
                .filter(m -> longOf(m.get("total")) > 0)
                .ifPresent(m -> out.add(insight("MAP_MOST_ACTIVE_COUNTRY", NEUTRAL, 0.85, "insights.map_most_active_country.text",
                        args(countryLabel(String.valueOf(m.get("country"))), longOf(m.get("total")), longOf(m.get("pieces")), longOf(m.get("schemes"))),
                        metric("insights.metric.itens_publicos", longOf(m.get("total")), null),
                        action("insights.action.ver_no_globo", "/explorer?tab=map&country=" + enc(String.valueOf(m.get("country")))), PUBLIC_AGGREGATES)));
        countries.stream().filter(m -> Boolean.TRUE.equals(m.get("sufficient")) && m.get("avg_hype") instanceof Number)
                .max(Comparator.comparingDouble((Map<String, Object> m) -> ((Number) m.get("avg_hype")).doubleValue()).thenComparing(m -> String.valueOf(m.get("country")),
                        Comparator.reverseOrder()))
                .ifPresent(m -> out.add(insight("MAP_HYPE_COUNTRY", NEUTRAL, 0.7, "insights.map_hype_country.text",
                        args(countryLabel(String.valueOf(m.get("country"))), fmt1(((Number) m.get("avg_hype")).doubleValue())),
                        metric("insights.metric.hype_medio", round1(((Number) m.get("avg_hype")).doubleValue()), "pts"),
                        action("insights.action.ver_no_globo", "/explorer?tab=map&country=" + enc(String.valueOf(m.get("country")))), PUBLIC_AGGREGATES)));
        long sufficient = countries.stream().filter(m -> Boolean.TRUE.equals(m.get("sufficient"))).count();
        if (sufficient > 0) {
            out.add(insight("MAP_COVERAGE", NEUTRAL, 0.6, "insights.map_coverage.text", args(sufficient, ExplorerService.MIN_DATA),
                    metric("insights.metric.paises", sufficient, null), null, PUBLIC_AGGREGATES));
        }
        // Hype v2: onde o crescimento médio (trend) é maior — crescimento, não volume
        List<HypeScoreCurrent> located = Stream.concat(pool(HypeEntityType.PIECE, f).stream(), pool(HypeEntityType.SCHEME, f).stream())
                .filter(c -> !"OUTRAS".equals(InsightMath.regionOf(c))).toList();
        InsightMath.averageBy(located, c -> List.of(InsightMath.regionOf(c)), InsightMath::trend, MIN_REGION_ITEMS).stream().findFirst()
                .ifPresent(a -> out.add(insight("MAP_REGION_TREND", POSITIVE, 0.8, "insights.map_region_trend.text",
                        args(regionLabel(a.key()), fmt0(a.value()), a.items()),
                        metric("insights.metric.trend_medio", round(a.value()), "pts"),
                        action("insights.action.ver_ranking", "/explorer?tab=ranking&region=" + enc(a.key()) + "&window=1"), HYPE_V2, PUBLIC_RANKING)));
        return out;
    }

    // ================================================================== Insights globais
    @SuppressWarnings("unchecked")
    List<Insight> global(Filters f) {
        List<Insight> out = new ArrayList<>();
        Map<String, Object> g = explorer.insights(null);   // sem quem vê: só a leitura local dos rankings agregados
        Map<String, Object> rankings = g != null && g.get("rankings") instanceof Map<?, ?> r ? (Map<String, Object>) r : Map.of();
        first(rankings.get("topCountries")).ifPresent(m -> out.add(insight("GLOBAL_TOP_COUNTRY", NEUTRAL, 0.75, "insights.global_top_country.text",
                args(countryLabel(String.valueOf(m.get("label"))), longOf(m.get("value"))),
                metric("insights.metric.looks", longOf(m.get("value")), "looks"),
                action("insights.action.ver_no_globo", "/explorer?tab=map&country=" + enc(String.valueOf(m.get("label")))), PUBLIC_AGGREGATES)));
        first(rankings.get("topColors")).ifPresent(m -> out.add(insight("GLOBAL_TOP_COLOR", NEUTRAL, 0.7, "insights.global_top_color.text",
                args(label(String.valueOf(m.get("label"))), longOf(m.get("value"))),
                metric("insights.metric.itens_publicos", longOf(m.get("value")), null), null, PUBLIC_AGGREGATES)));
        first(rankings.get("hypeByColor")).filter(m -> m.get("value") instanceof Number).ifPresent(m -> out.add(insight("GLOBAL_COLOR_HYPE", NEUTRAL, 0.65,
                "insights.global_color_hype.text", args(label(String.valueOf(m.get("label"))), fmt1(((Number) m.get("value")).doubleValue())),
                metric("insights.metric.hype_medio", round1(((Number) m.get("value")).doubleValue()), "pts"), null, PUBLIC_AGGREGATES)));
        first(rankings.get("topBrands")).ifPresent(m -> out.add(insight("GLOBAL_TOP_BRAND", NEUTRAL, 0.55, "insights.global_top_brand.text",
                args(String.valueOf(m.get("label")), longOf(m.get("value"))),
                metric("insights.metric.pecas", longOf(m.get("value")), "peças"), null, PUBLIC_AGGREGATES)));
        // Hype v2: onde há mais peças públicas emergindo agora (a mesma leitura das "novas tendências")
        List<HypeScoreCurrent> emerging = pool(HypeEntityType.PIECE, f).stream().filter(c -> c.getMomentum() == HypeMomentum.EMERGING).toList();
        InsightMath.countBy(emerging, InsightMath::categoriesOf).stream().findFirst()
                .ifPresent(e -> out.add(insight("GLOBAL_EMERGING_CATEGORY", POSITIVE, 0.9, "insights.global_emerging_category.text",
                        args(label(e.getKey()), e.getValue()),
                        metric("insights.metric.emergentes", e.getValue(), "peças"),
                        action("insights.action.ver_em_alta", "/explorer?tab=trending&category=" + enc(e.getKey())), HYPE_V2, PUBLIC_RANKING)));
        return out;
    }

    private static java.util.Optional<Map<String, Object>> first(Object list) {
        if (list instanceof List<?> l && !l.isEmpty() && l.get(0) instanceof Map<?, ?> m && m.get("label") != null) {
            @SuppressWarnings("unchecked") Map<String, Object> x = (Map<String, Object>) m;
            return java.util.Optional.of(x);
        }
        return java.util.Optional.empty();
    }

    private static long longOf(Object o) {
        return o instanceof Number n ? n.longValue() : 0;
    }

    // ================================================================== Marcas
    @SuppressWarnings("unchecked")
    List<Insight> brands(Filters f) {
        List<Insight> out = new ArrayList<>();
        String cat = f.category().isEmpty() ? null : f.category();
        Map<String, Object> rising = hype.trendingGroups(null, HypeQueryService.RankGroup.BRAND, 1, cat, null, null, 10);
        Map<String, Object> leaders = hype.trendingGroups(null, HypeQueryService.RankGroup.BRAND, f.window() >= 30 ? 30 : 7, cat, null, null, 50);
        List<Map<String, Object>> r = rising != null && rising.get("items") instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
        List<Map<String, Object>> top = leaders != null && leaders.get("items") instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
        Map<String, Object> riser = r.stream().filter(m -> m.get("name") != null && m.get("value") instanceof Number).findFirst().orElse(null);
        Map<String, Object> leader = top.stream().filter(m -> m.get("name") != null && m.get("value") instanceof Number).findFirst().orElse(null);
        if (riser != null) {
            out.add(insight("BRAND_RISING", POSITIVE, 0.9, "insights.brand_rising.text",
                    args(riser.get("name"), fmt0(((Number) riser.get("value")).doubleValue()), longOf(riser.get("items"))),
                    metric("insights.metric.trend_medio", round(((Number) riser.get("value")).doubleValue()), "pts"),
                    action("insights.action.ver_marcas", "/explorer?tab=trending&type=BRAND&window=1"), HYPE_V2, PUBLIC_RANKING));
        }
        if (leader != null) {
            out.add(insight("BRAND_LEADER", NEUTRAL, 0.85, "insights.brand_leader.text",
                    args(leader.get("name"), fmt1(((Number) leader.get("value")).doubleValue()), longOf(leader.get("items"))),
                    metric("insights.metric.hype_medio", round1(((Number) leader.get("value")).doubleValue()), "pts"),
                    action("insights.action.ver_marcas", "/explorer?tab=trending&type=BRAND"), HYPE_V2, PUBLIC_RANKING));
        }
        if (riser != null && leader != null && !String.valueOf(riser.get("key")).equals(String.valueOf(leader.get("key")))) {
            out.add(insight("BRAND_POPULAR_VS_RISING", NEUTRAL, 0.8, "insights.brand_popular_vs_rising.text", args(leader.get("name"), riser.get("name")),
                    null, null, HYPE_V2, PUBLIC_RANKING));
        }
        if (!top.isEmpty()) {
            Object min = leaders.get("minItems");
            out.add(insight("BRANDS_BASE", NEUTRAL, 0.5, "insights.brands_base.text", args(top.size(), min == null ? 3 : min),
                    metric("insights.metric.marcas", top.size(), null), null, PUBLIC_RANKING));
        }
        return out;
    }

    // ================================================================== Passarela (looks)
    List<Insight> runway(Filters f) {
        List<HypeScoreCurrent> looks = pool(HypeEntityType.SCHEME, f);
        List<Insight> out = new ArrayList<>();
        if (looks.isEmpty()) {
            return out;
        }
        List<HypeScoreCurrent> hot = looks.stream().filter(c -> InsightMath.trend(c) >= HOT_TREND).toList();
        if (!hot.isEmpty()) {
            double max = hot.stream().mapToDouble(InsightMath::trend).max().orElse(0);
            out.add(insight("RUNWAY_LOOKS_RISING", POSITIVE, 0.9, "insights.runway_looks_rising.text", args(hot.size(), fmt0(max), looks.size()),
                    metric("insights.metric.looks", hot.size(), "looks"),
                    action("insights.action.ver_em_alta", "/explorer?tab=trending&type=LOOK&window=1"), HYPE_V2, PUBLIC_RANKING));
            if (hot.size() >= MIN_GROUP_ITEMS) {
                InsightMath.countBy(hot, c -> Json.csv(c.getStyles())).stream().findFirst().filter(e -> e.getValue() >= MIN_GROUP_ITEMS)
                        .ifPresent(e -> out.add(insight("RUNWAY_TOP_STYLE", NEUTRAL, 0.8, "insights.runway_top_style.text",
                                args(label(e.getKey()), e.getValue(), hot.size()),
                                metric("insights.metric.looks", e.getValue(), "looks"),
                                action("insights.action.ver_em_alta", "/explorer?tab=trending&type=LOOK&style=" + enc(e.getKey())), HYPE_V2, PUBLIC_RANKING)));
                InsightMath.countBy(hot, c -> Json.csv(c.getOccasions())).stream().findFirst().filter(e -> e.getValue() >= MIN_GROUP_ITEMS)
                        .ifPresent(e -> out.add(insight("RUNWAY_TOP_OCCASION", NEUTRAL, 0.7, "insights.runway_top_occasion.text",
                                args(label(e.getKey()), e.getValue(), hot.size()),
                                metric("insights.metric.looks", e.getValue(), "looks"),
                                action("insights.action.ver_em_alta", "/explorer?tab=trending&type=LOOK&occasion=" + enc(e.getKey())), HYPE_V2, PUBLIC_RANKING)));
            }
        } else {
            out.add(insight("RUNWAY_LOOKS_STABLE", ATTENTION, 0.6, "insights.runway_looks_stable.text", args(looks.size(), fmt0(HOT_TREND)),
                    metric("insights.metric.looks", looks.size(), "looks"), null, HYPE_V2, PUBLIC_RANKING));
        }
        long emerging = looks.stream().filter(c -> c.getMomentum() == HypeMomentum.EMERGING).count();
        if (emerging > 0) {
            double pct = 100.0 * emerging / looks.size();
            out.add(insight("RUNWAY_EMERGING_LOOKS", POSITIVE, 0.75, "insights.runway_emerging_looks.text", args(fmt0(pct), emerging, looks.size()),
                    metric("insights.metric.emergentes", round(pct), "%"), null, HYPE_V2, PUBLIC_RANKING));
        }
        long influential = looks.stream().filter(c -> InsightMath.dims(c).getInfluence() != null && InsightMath.dims(c).getInfluence().signum() > 0).count();
        if (influential > 0) {
            out.add(insight("RUNWAY_REMIX_INFLUENCE", NEUTRAL, 0.6, "insights.runway_remix_influence.text", args(influential),
                    metric("insights.metric.looks", influential, "looks"), null, HYPE_V2, PUBLIC_RANKING));
        }
        return out;
    }
}
