package br.com.fashionai.application.service;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SealBondRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ExplorerService.MIN_BRAND_ITEMS;

/**
 * Buscar marcas & lojas (RF26.CA02 + RF53 · P1-04): a grade de perfis BRAND aprovados e das marcas só de catálogo (RF47),
 * com filtros de país, categoria, cor, estação e faixa mínima de Hype, e as ordenações HYPE e SCHEMES.
 */
final class ExplorerBrandGrid {
    private final AnalyticsQueryPort analytics;
    private final BrandProfileRepository brands;
    private final SealBondRepository bonds;
    private final ExplorerHype hypes;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;
    private final Supplier<CatalogService> catalogSource;

    ExplorerBrandGrid(AnalyticsQueryPort analytics, BrandProfileRepository brands, SealBondRepository bonds, ExplorerHype hypes,
                      HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig, Supplier<CatalogService> catalogSource) {
        this.analytics = analytics;
        this.brands = brands;
        this.bonds = bonds;
        this.hypes = hypes;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.catalogSource = catalogSource;
    }

    static Double hypeValue(Map<String, Object> card) {
        return card.get("hype") instanceof Map<?, ?> h && h.get("value") instanceof Number n ? n.doubleValue() : null;
    }

    /** Filtro mínimo de Hype pela faixa ({@code minLevel}); sem valor nunca passa. */
    private boolean passesHype(Map<String, Object> card, HypeLevel minLevel) {
        Double v = hypeValue(card);
        return minLevel == null || (v != null && v >= SearchHype.levelMinimum(hypeConfig, minLevel) - 0.5);
    }

    /**
     * RF26.CA02 + RF53 (P1-04) — grade de perfis BRAND (e marcas do catálogo) com filtros de país, categoria, cor, estação
     * e faixa mínima de Hype ({@code minLevel}). Campo aditivo {@code hype} (v2, só público, ver {@link ExplorerHype#brandHype});
     * {@code sort=HYPE} ordena pelo {@code hype.value} (sem valor = por último). {@code pieces} conta só peças públicas.
     */
    Map<String, Object> brandsAndStores(CurrentUser viewer, String term, String country, String category, String sort,
                                               String color, String season, String minLevel) {
        CatalogService catalog = catalogSource.get();
        HypeLevel min = SearchHype.parseLevel(minLevel);
        Map<String, Map<String, Object>> facets = new HashMap<>();
        analytics.brandFacets().forEach(r -> facets.put(String.valueOf(r.get("brand")), r));
        Set<String> countries = new java.util.TreeSet<>();
        Set<String> categories = new java.util.TreeSet<>();
        Map<String, Map<String, Object>> usage = new HashMap<>();
        analytics.brandUsage(500).forEach(r -> usage.put(String.valueOf(r.get("brand")).toLowerCase(Locale.ROOT), r));
        Map<String, List<Double>> brandScores = new HashMap<>();
        hypes.publicPieces().forEach(p -> {
            String key = ExplorerHype.brandKey(p.piece());
            if (key != null) {
                brandScores.computeIfAbsent(key, k -> new ArrayList<>()).add(p.score());
            }
        });
        record Pending(Map<String, Object> card, String key, Set<UUID> bondedLooks) {
        }
        List<Pending> pending = new ArrayList<>();
        Instant now = Instant.now();
        for (BrandProfile b : brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)) {
            if (b.getCountry() != null) {
                countries.add(b.getCountry());
            }
            if (b.getFashionCategory() != null) {
                categories.add(b.getFashionCategory());
            }
            Map<String, Object> fx = facets.getOrDefault(b.getBrandName().toLowerCase(Locale.ROOT), Map.of());
            List<String> brandColors = Json.csv(String.valueOf(fx.getOrDefault("colors", "")));
            List<String> brandSeasons = Json.csv(String.valueOf(fx.getOrDefault("seasons", "")));
            if (color != null && !color.isBlank() && !brandColors.contains(color.trim())) {
                continue;
            }
            if (season != null && !season.isBlank() && !brandSeasons.contains(season.trim().toLowerCase(Locale.ROOT))) {
                continue;
            }
            if (term != null && !term.isBlank() && !b.getBrandName().toLowerCase(Locale.ROOT).contains(term.trim().toLowerCase(Locale.ROOT))) {
                continue;
            }
            if (country != null && !country.isBlank() && !country.equalsIgnoreCase(String.valueOf(b.getCountry()))) {
                continue;
            }
            if (category != null && !category.isBlank() && !category.equalsIgnoreCase(String.valueOf(b.getFashionCategory()))) {
                continue;
            }
            Map<String, Object> u = usage.getOrDefault(b.getBrandName().toLowerCase(Locale.ROOT), Map.of());
            List<SealBond> approved = bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(b.getOwner().getId(), SealBondStatus.APPROVED);
            long schemesCount = approved.stream().filter(x -> x.getScheme() != null).map(x -> x.getScheme().getId()).distinct().count();
            // looks com selo aprovado E vigente: a base do Hype da marca quando há vínculos suficientes
            Set<UUID> bonded = approved.stream().filter(x -> x.getScheme() != null && (x.getExpiresAt() == null || x.getExpiresAt().isAfter(now)))
                    .map(x -> x.getScheme().getId()).collect(Collectors.toCollection(LinkedHashSet::new));
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", b.getOwner().getId());
            m.put("slug", b.getSlug());
            m.put("name", b.getBrandName());
            m.put("logoUrl", b.getLogoUrl());
            m.put("country", b.getCountry());
            m.put("category", b.getFashionCategory());
            m.put("schemes", schemesCount);
            // só peças PÚBLICAS: a contagem total da view incluía peças privadas e a grade é pública e anônima
            m.put("pieces", u.get("public_pieces") instanceof Number n ? n.longValue() : 0L);
            m.put("storeUrl", b.getStoreUrl());
            m.put("colors", brandColors.stream().limit(4).map(c -> Map.of("color", c, "hex", String.valueOf(Taxonomy.hex(c)))).toList());
            m.put("seasons", brandSeasons.stream().filter(x -> !x.isBlank() && !"null".equals(x)).toList());
            pending.add(new Pending(m, b.getBrandName().trim().toLowerCase(Locale.ROOT), bonded));
        }
        // uma consulta para o Hype de todos os looks vinculados da grade
        Map<UUID, HypeScoreCurrent> lookHype = SearchHype.hypeRows(hypeScores, hypeConfig, HypeEntityType.SCHEME,
                pending.stream().flatMap(x -> x.bondedLooks().stream()).collect(Collectors.toSet()));
        List<Map<String, Object>> cards = new ArrayList<>();
        for (Pending x : pending) {
            List<Double> looks = x.bondedLooks().stream().map(id -> SearchHype.publicScore(lookHype.get(id))).filter(Objects::nonNull).toList();
            x.card().put("hype", ExplorerHype.brandHype(looks, brandScores.getOrDefault(x.key(), List.of()), hypeConfig));
            if (passesHype(x.card(), min)) {
                cards.add(x.card());
            }
        }
        // RF47 · marcas que só existem no catálogo (seed/ingestão) — sem conta de marca, sem perfil inventado
        if (catalog != null && (color == null || color.isBlank()) && (season == null || season.isBlank())) {
            Set<String> withProfile = new java.util.HashSet<>();
            pending.forEach(c -> withProfile.add(String.valueOf(c.card().get("name")).toLowerCase(Locale.ROOT)));
            for (Map<String, Object> cb : catalog.catalogBrands()) {
                String name = String.valueOf(cb.get("name"));
                if (withProfile.contains(name.toLowerCase(Locale.ROOT))) {
                    continue;
                }
                @SuppressWarnings("unchecked")
                List<String> cats = (List<String>) cb.get("categories");
                if (cb.get("country") != null) {
                    countries.add(String.valueOf(cb.get("country")));
                }
                categories.addAll(cats);
                if (term != null && !term.isBlank() && !name.toLowerCase(Locale.ROOT).contains(term.trim().toLowerCase(Locale.ROOT))) {
                    continue;
                }
                if (country != null && !country.isBlank() && !country.equalsIgnoreCase(String.valueOf(cb.get("country")))) {
                    continue;
                }
                if (category != null && !category.isBlank() && !cats.contains(category)) {
                    continue;
                }
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("userId", null);
                m.put("slug", cb.get("slug"));
                m.put("name", name);
                m.put("logoUrl", cb.get("logoUrl"));
                m.put("country", cb.get("country"));
                m.put("category", cats.isEmpty() ? null : cats.get(0));
                m.put("schemes", 0L);
                m.put("pieces", cb.get("catalogProducts"));
                m.put("storeUrl", cb.get("storeUrl"));
                m.put("colors", List.of());
                m.put("seasons", List.of());
                m.put("catalog", true);
                m.put("catalogProducts", cb.get("catalogProducts"));
                // marca só de catálogo: o Hype vem das peças públicas com essa marca (sem selo, sem looks vinculados)
                m.put("hype", ExplorerHype.brandHype(List.of(), brandScores.getOrDefault(name.trim().toLowerCase(Locale.ROOT), List.of()), hypeConfig));
                if (passesHype(m, min)) {
                    cards.add(m);
                }
            }
        }
        Comparator<Map<String, Object>> byName = Comparator.comparing(m -> String.valueOf(m.get("name")).toLowerCase(Locale.ROOT));
        Comparator<Map<String, Object>> cmp = "SCHEMES".equalsIgnoreCase(sort)
                ? Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("schemes")).longValue()).reversed().thenComparing(byName)
                : Comparator.comparing(ExplorerBrandGrid::hypeValue, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byName);
        cards.sort(cmp);
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("term", String.valueOf(term));
        filters.put("country", String.valueOf(country));
        filters.put("category", String.valueOf(category));
        filters.put("color", String.valueOf(color));
        filters.put("season", String.valueOf(season));
        filters.put("minLevel", String.valueOf(min));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("brands", cards);
        out.put("filters", filters);
        out.put("sorts", List.of("HYPE", "SCHEMES"));
        out.put("countries", countries);
        out.put("categories", categories);
        out.put("seasons", List.of("spring", "summer", "autumn", "winter"));
        out.put("levels", java.util.Arrays.stream(HypeLevel.values()).map(Enum::name).toList());
        out.put("minItems", MIN_BRAND_ITEMS);
        out.put("algorithmVersion", hypeConfig == null ? null : hypeConfig.algorithmVersion());
        return out;
    }
}
