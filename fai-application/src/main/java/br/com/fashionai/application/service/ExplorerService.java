package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * RF26 — Explorador Global: Painel global (globo por País, intensidade = hype médio), Buscar marcas & lojas (grade com
 * filtros de país, categoria, cor e ordenação por hype) e Insights globais (rankings + leitura textual pelo mesmo motor
 * de IA). Só cruza dados já coletados; nenhum campo novo além de User.country. Agregações de volume feitas no MySQL
 * (views e GROUP BY da V6).
 * <p>
 * RF53 (Lote 1 da auditoria de abas): Marcas & lojas e Insights globais leem o HypeScore v2 ({@code hype_scores}) só da
 * população pública ({@code publicEligible} + AVAILABLE) — o fallback {@code vw_brand_usage.avg_hype}, que tirava a média
 * de peças privadas também, saiu; grupos com menos de {@link #MIN_BRAND_ITEMS} itens públicos ficam sem valor ("—").
 * O painel global (globo) mostra volume por país; o Hype por país vem do {@code /api/hype/globe}. A limpeza do v1 (P3-16)
 * tirou daqui as faixas de juízo do RF6, o filtro {@code hypeBand}, o {@code hypeMin} e as médias de {@code hype_score}.
 */
@Service
public class ExplorerService {
    private final AnalyticsQueryPort analytics;
    private final BrandProfileRepository brands;
    private final SealBondRepository bonds;
    private final AiEngine ai;
    /** HypeScore v2: estado atual lido direto do repositório (GET nunca recalcula). */
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;

    public ExplorerService(AnalyticsQueryPort analytics, BrandProfileRepository brands, SealBondRepository bonds, AiEngine ai,
                           HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig, WardrobeItemRepository pieces, SchemeRepository schemes) {
        this.analytics = analytics;
        this.brands = brands;
        this.bonds = bonds;
        this.ai = ai;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.pieces = pieces;
        this.schemes = schemes;
    }

    /** RF47 · marcas do catálogo global (opcional nos testes): entram na grade ao lado dos perfis BRAND. */
    private br.com.fashionai.application.catalog.CatalogService catalog;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setCatalog(br.com.fashionai.application.catalog.CatalogService catalog) {
        this.catalog = catalog;
    }

    /** Mínimo de peças + looks públicos para um país acender no globo (CA01 — "com dados suficientes"). */
    public static final int MIN_DATA = 3;
    public Map<String, Object> globalPanel(CurrentUser viewer, String selectedCountry) {
        return globalPanel(viewer, selectedCountry, null, null);
    }

    /**
     * RF26.CA01 — painel global: um ponto por país com dados suficientes, agrupando peças e esquemas públicos pelo país do
     * dono (User.country — CA04: nenhum campo de região em peça/esquema), com recorte por estação e cor. Só volume: o Hype
     * por país é do {@code /api/hype/globe} (v2, só público).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> globalPanel(CurrentUser viewer, String selectedCountry, String season, String color) {
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

    /** Buscar marcas & lojas — grade de cards (userType = BRAND) com filtros e ordenação por hype. */
    @Transactional(readOnly = true)
    public Map<String, Object> brandsAndStores(CurrentUser viewer, String term, String country, String category, String sort) {
        return brandsAndStores(viewer, term, country, category, sort, null, null, null);
    }

    // ================================================================== HypeScore v2 agregado (RF53 · P1-04, P2-04)
    /** Itens públicos mínimos para um grupo (marca, cor, categoria, estação) ter Hype: um item sozinho não representa o grupo. */
    public static final int MIN_BRAND_ITEMS = 3;
    /** Hype da marca pelas peças (BRAND_GROUP): média dos N itens mais relevantes — a mesma régua do "Em alta" de marcas. */
    static final int BRAND_TOP_ITEMS = 5;
    /** Quantas linhas cada ranking de Insights mostra. */
    static final int RANKING_ROWS = 5;

    /** Peça pública com Hype v2 disponível (a única população que entra em agregado público). */
    record PublicPiece(HypeScoreCurrent hype, WardrobeItem piece) {
        double score() {
            return hype.getScore().doubleValue();
        }
    }

    /**
     * População pública de peças: {@code publicEligible} + AVAILABLE no {@code hype_scores} (peça privada, de perfil privado,
     * em moderação ou de conta de teste nunca entra). Uma consulta no estado v2 + um {@code findByIdIn} das peças.
     */
    List<PublicPiece> publicPieces() {
        if (hypeScores == null || hypeConfig == null || pieces == null) {
            return List.of();
        }
        List<HypeScoreCurrent> pool = hypeScores.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE,
                hypeConfig.algorithmVersion(), HypeStatus.AVAILABLE).stream().filter(c -> SearchService.publicRow(c) != null).toList();
        if (pool.isEmpty()) {
            return List.of();
        }
        Map<UUID, WardrobeItem> byId = pieces.findByIdIn(pool.stream().map(HypeScoreCurrent::getEntityId).toList()).stream()
                .collect(Collectors.toMap(WardrobeItem::getId, Function.identity(), (a, b) -> a));
        return pool.stream().filter(c -> byId.containsKey(c.getEntityId())).map(c -> new PublicPiece(c, byId.get(c.getEntityId()))).toList();
    }

    /** Chave da marca de uma peça: catálogo (RF47) ou texto livre, normalizado (minúsculas, sem espaços nas pontas). */
    static String brandKey(WardrobeItem w) {
        String name = w == null ? null : w.getBrand() != null ? w.getBrand().getName() : w.getBrandName();
        return name == null || name.isBlank() ? null : name.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Hype v2 da marca: {@code {value, level, items, basis, sufficient, minItems}}. Com ≥ {@link #MIN_BRAND_ITEMS} looks
     * vinculados (selo aprovado e vigente) com Hype público, é a média deles ({@code BONDED_LOOKS}, como o "Hype do selo");
     * senão, com ≥ {@link #MIN_BRAND_ITEMS} peças públicas da marca, a média das 5 mais relevantes ({@code BRAND_GROUP});
     * senão não há valor (a tela mostra "—", nunca 0). Patrocínio, cupom e ponto nunca entram.
     */
    static Map<String, Object> brandHype(List<Double> bondedLooks, List<Double> brandPieces, HypeScoreConfig cfg) {
        List<Double> looks = bondedLooks == null ? List.of() : bondedLooks;
        List<Double> ps = brandPieces == null ? List.of() : brandPieces;
        Double value = null;
        String basis = null;
        int items;
        if (looks.size() >= MIN_BRAND_ITEMS) {
            value = looks.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            basis = "BONDED_LOOKS";
            items = looks.size();
        } else if (ps.size() >= MIN_BRAND_ITEMS) {
            value = ps.stream().sorted(Comparator.reverseOrder()).limit(BRAND_TOP_ITEMS).mapToDouble(Double::doubleValue).average().orElse(0);
            basis = "BRAND_GROUP";
            items = ps.size();
        } else {
            items = Math.max(looks.size(), ps.size());
        }
        Map<String, Object> h = new LinkedHashMap<>();
        Double v = value == null ? null : SearchService.round1(value);
        h.put("value", v);
        h.put("level", v == null ? null : (cfg == null ? HypeScoreConfig.defaults() : cfg).level(v).name());
        h.put("items", items);
        h.put("basis", basis);
        h.put("sufficient", v != null);
        h.put("minItems", MIN_BRAND_ITEMS);
        return h;
    }

    private static Double hypeValue(Map<String, Object> card) {
        return card.get("hype") instanceof Map<?, ?> h && h.get("value") instanceof Number n ? n.doubleValue() : null;
    }

    /** Filtro mínimo de Hype pela faixa ({@code minLevel}); sem valor nunca passa. */
    private boolean passesHype(Map<String, Object> card, HypeLevel minLevel) {
        Double v = hypeValue(card);
        return minLevel == null || (v != null && v >= SearchService.levelMinimum(hypeConfig, minLevel) - 0.5);
    }

    /**
     * RF26.CA02 + RF53 (P1-04) — grade de perfis BRAND (e marcas do catálogo) com filtros de país, categoria, cor, estação
     * e faixa mínima de Hype ({@code minLevel}). Campo aditivo {@code hype} (v2, só público, ver {@link #brandHype});
     * {@code sort=HYPE} ordena pelo {@code hype.value} (sem valor = por último). {@code pieces} conta só peças públicas.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> brandsAndStores(CurrentUser viewer, String term, String country, String category, String sort,
                                               String color, String season, String minLevel) {
        HypeLevel min = SearchService.parseLevel(minLevel);
        Map<String, Map<String, Object>> facets = new HashMap<>();
        analytics.brandFacets().forEach(r -> facets.put(String.valueOf(r.get("brand")), r));
        Set<String> countries = new java.util.TreeSet<>();
        Set<String> categories = new java.util.TreeSet<>();
        Map<String, Map<String, Object>> usage = new HashMap<>();
        analytics.brandUsage(500).forEach(r -> usage.put(String.valueOf(r.get("brand")).toLowerCase(Locale.ROOT), r));
        Map<String, List<Double>> brandScores = new HashMap<>();
        publicPieces().forEach(p -> {
            String key = brandKey(p.piece());
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
        Map<UUID, HypeScoreCurrent> lookHype = SearchService.hypeRows(hypeScores, hypeConfig, HypeEntityType.SCHEME,
                pending.stream().flatMap(x -> x.bondedLooks().stream()).collect(Collectors.toSet()));
        List<Map<String, Object>> cards = new ArrayList<>();
        for (Pending x : pending) {
            List<Double> looks = x.bondedLooks().stream().map(id -> SearchService.publicScore(lookHype.get(id))).filter(Objects::nonNull).toList();
            x.card().put("hype", brandHype(looks, brandScores.getOrDefault(x.key(), List.of()), hypeConfig));
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
                m.put("hype", brandHype(List.of(), brandScores.getOrDefault(name.trim().toLowerCase(Locale.ROOT), List.of()), hypeConfig));
                if (passesHype(m, min)) {
                    cards.add(m);
                }
            }
        }
        Comparator<Map<String, Object>> byName = Comparator.comparing(m -> String.valueOf(m.get("name")).toLowerCase(Locale.ROOT));
        Comparator<Map<String, Object>> cmp = "SCHEMES".equalsIgnoreCase(sort)
                ? Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("schemes")).longValue()).reversed().thenComparing(byName)
                : Comparator.comparing(ExplorerService::hypeValue, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byName);
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

    // ================================================================== Insights globais (RF26 + RF53 · P2-04)
    /** Uma linha agregada: rótulo, média, quantos itens públicos e (quando é score) a faixa. */
    record Agg(String key, double value, int items) {
    }

    /** Média por grupo, só grupos com ≥ {@link #MIN_BRAND_ITEMS} itens; {@code top} limita a média aos N maiores (marcas). */
    static <T> List<Agg> averageBy(List<T> pool, Function<T, String> key, Function<T, Double> value, int top) {
        Map<String, List<Double>> groups = new LinkedHashMap<>();
        for (T x : pool) {
            String k = key.apply(x);
            Double v = value.apply(x);
            if (k != null && !k.isBlank() && v != null) {
                groups.computeIfAbsent(k, z -> new ArrayList<>()).add(v);
            }
        }
        List<Agg> out = new ArrayList<>();
        groups.forEach((k, vs) -> {
            if (vs.size() >= MIN_BRAND_ITEMS) {
                double avg = vs.stream().sorted(Comparator.reverseOrder()).limit(top <= 0 ? vs.size() : top).mapToDouble(Double::doubleValue).average().orElse(0);
                out.add(new Agg(k, SearchService.round1(avg), vs.size()));
            }
        });
        out.sort(Comparator.comparingDouble(Agg::value).reversed().thenComparing(Agg::key));
        return out;
    }

    private List<Map<String, Object>> rows(List<Agg> list, boolean withLevel, Function<String, String> label, boolean withHex) {
        return list.stream().limit(RANKING_ROWS).map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", label.apply(a.key()));
            m.put("value", a.value());
            if (withLevel) {
                m.put("level", (hypeConfig == null ? HypeScoreConfig.defaults() : hypeConfig).level(a.value()).name());
            }
            m.put("items", a.items());
            if (withHex) {
                m.put("hex", String.valueOf(Taxonomy.hex(a.key())));
            }
            return m;
        }).toList();
    }

    /**
     * Rankings de Hype v2 sobre a população pública ({@code publicEligible} + AVAILABLE): categorias, cores e marcas pela
     * média (marca = média das 5 mais relevantes, como no "Em alta"), estações pelos looks e o CRESCIMENTO (dimensão
     * TREND) por categoria — separado de volume/popularidade. Grupo com menos de {@link #MIN_BRAND_ITEMS} itens fica fora.
     */
    Map<String, Object> hypeRankings() {
        List<PublicPiece> ps = publicPieces();
        Map<String, String> brandName = new HashMap<>();
        ps.forEach(p -> {
            String k = brandKey(p.piece());
            if (k != null) {
                String n = p.piece().getBrand() != null ? p.piece().getBrand().getName() : p.piece().getBrandName();
                brandName.putIfAbsent(k, n.trim());
            }
        });
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", hypeConfig == null ? null : hypeConfig.algorithmVersion());
        out.put("minItems", MIN_BRAND_ITEMS);
        out.put("byCategory", rows(averageBy(ps, p -> p.hype().getCategory() != null ? p.hype().getCategory() : p.piece().getCategory(), PublicPiece::score, 0),
                true, Function.identity(), false));
        out.put("byColor", rows(averageBy(ps, p -> p.piece().getColor(), PublicPiece::score, 0), true, Function.identity(), true));
        out.put("byBrand", rows(averageBy(ps, p -> brandKey(p.piece()), PublicPiece::score, BRAND_TOP_ITEMS), true,
                k -> brandName.getOrDefault(k, k), false));
        out.put("bySeason", rows(seasonAverages(), true, Function.identity(), false));
        // crescimento ≠ popularidade: média da dimensão TREND (50 = estável), não volume nem curtidas
        out.put("growthByCategory", rows(averageBy(ps, p -> p.hype().getCategory() != null ? p.hype().getCategory() : p.piece().getCategory(),
                p -> SearchService.trendFor(p.hype(), false), 0), false, Function.identity(), false));
        return out;
    }

    /** Hype v2 médio por estação, a partir dos looks públicos (mesma base do ranking v1, agora sem o v1). */
    List<Agg> seasonAverages() {
        if (hypeScores == null || hypeConfig == null || schemes == null) {
            return List.of();
        }
        List<HypeScoreCurrent> pool = hypeScores.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME,
                hypeConfig.algorithmVersion(), HypeStatus.AVAILABLE).stream().filter(c -> SearchService.publicRow(c) != null).toList();
        if (pool.isEmpty()) {
            return List.of();
        }
        Map<UUID, Scheme> byId = schemes.findByIdIn(pool.stream().map(HypeScoreCurrent::getEntityId).toList()).stream()
                .collect(Collectors.toMap(Scheme::getId, Function.identity(), (a, b) -> a));
        return averageBy(pool, c -> byId.get(c.getEntityId()) == null || byId.get(c.getEntityId()).getSeason() == null ? null
                : byId.get(c.getEntityId()).getSeason().name(), c -> c.getScore().doubleValue(), 0);
    }

    /** Insights globais — rankings + leitura textual (Insight Generator, RF24; fallback local). */
    @Transactional(readOnly = true)
    public Map<String, Object> insights(CurrentUser viewer) {
        Map<String, Object> hype = hypeRankings();
        Map<String, Object> rankings = new LinkedHashMap<>();
        // volume (popularidade): só peças públicas — a contagem total da view incluía peças privadas
        rankings.put("topBrands", analytics.brandUsage(500).stream().filter(r -> r.get("public_pieces") instanceof Number n && n.longValue() > 0)
                .sorted(Comparator.comparingLong((Map<String, Object> r) -> ((Number) r.get("public_pieces")).longValue()).reversed()
                        .thenComparing(r -> String.valueOf(r.get("brand"))))
                .limit(RANKING_ROWS).map(r -> Map.of("label", r.get("brand"), "value", r.get("public_pieces"))).toList());
        // Hype: v2 público (mesmas chaves de antes, agora com faixa e base de itens; o v1 saiu desta aba)
        rankings.put("hypeBySeason", hype.get("bySeason"));
        rankings.put("topColors", analytics.colorRanking(null, 5).stream().map(r -> Map.of("label", r.get("color"), "value", r.get("total"),
                "hex", String.valueOf(Taxonomy.hex(String.valueOf(r.get("color")))))).toList());
        rankings.put("hypeByColor", hype.get("byColor"));
        rankings.put("hypeByBrand", hype.get("byBrand"));
        rankings.put("topCountries", analytics.countries().stream().sorted(Comparator.comparingLong((Map<String, Object> r) ->
                ((Number) r.get("public_schemes")).longValue()).reversed()).limit(5).map(r -> Map.of("label", r.get("country"), "value", r.get("public_schemes"))).toList());
        Map<String, Object> forText = new LinkedHashMap<>(rankings);
        forText.put("growthByCategory", hype.get("growthByCategory"));
        String local = LocalAdvisors.insightText(forText);
        if (viewer == null) {
            return Map.of("rankings", rankings, "hype", hype, "aiInsight", local, "explanation", Msg.t("explorer.leitura_local_faca_login_para"),
                    "fallbackUsed", false, "note", Msg.t("explorer.cores_de_status_do_dataviz"));
        }
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(viewer.id(), AiCapability.INSIGHT_GENERATOR,
                "Você é o Insight Generator do Fashion AI. Escreva UMA leitura de tendência (até 2 frases, em " + Msg.languageName() + ") a partir dos rankings agregados. "
                        + "Não invente números; use só os dados. HypeScore mede relevância atual (não qualidade) e é diferente de volume; "
                        + "growthByCategory é crescimento recente (tendência), não popularidade.", "Rankings: " + Json.write(forText), List.of(), 250,
                List.of(Msg.t("explorer.rankings_agregados_sem_dados_pessoais")), text -> text == null || text.isBlank() ? null : InputSanitizer.clean(text, 400), () -> local, null));
        return Map.of("rankings", rankings, "hype", hype, "aiInsight", outcome.value() == null ? local : outcome.value(), "explanation", outcome.explanation(),
                "fallbackUsed", outcome.fallbackUsed(), "note", Msg.t("explorer.cores_de_status_do_dataviz"));
    }
}
