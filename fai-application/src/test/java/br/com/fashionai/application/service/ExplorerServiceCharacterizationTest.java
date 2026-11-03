package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Portrait;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.testkit.Portrait.attempt;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caracterização do {@link ExplorerService} sobre um mundo fixo (ids {@code UUID(0xE7, n)}, Hype v2 gravado, analytics e
 * catálogo mockados): painel global, Marcas & lojas (filtros, ordenações, faixa mínima, catálogo), Insights globais (com e
 * sem quem vê), as regras puras e todas as chamadas aos repositórios têm de continuar idênticas ao retrato gravado em
 * {@code explorer/explorer-service-portrait.txt}.
 */
class ExplorerServiceCharacterizationTest {
    private static final String GOLDEN = "/explorer/explorer-service-portrait.txt";
    private static final Instant T0 = Instant.parse("2025-03-01T10:00:00Z");

    private final AnalyticsQueryPort analytics = mock(AnalyticsQueryPort.class);
    private final BrandProfileRepository brands = mock(BrandProfileRepository.class);
    private final SealBondRepository bonds = mock(SealBondRepository.class);
    private final AiEngine ai = mock(AiEngine.class);
    private final HypeScoreCurrentRepository hype = mock(HypeScoreCurrentRepository.class);
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final CatalogService catalog = mock(CatalogService.class);
    private final List<HypeScoreCurrent> rows = new ArrayList<>();
    private final List<WardrobeItem> pieceRows = new ArrayList<>();
    private final List<Scheme> schemeRows = new ArrayList<>();
    private final Portrait p = new Portrait("00000000-0000-00e7");
    private int seq;

    private UUID next() {
        return new UUID(0xE7, ++seq);
    }

    private static Map<String, Object> row(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }

    private HypeScoreCurrent score(HypeEntityType type, UUID id, double score, boolean eligible, Double trend, String category) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(id);
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(HypeScoreConfig.defaults().level(score));
        c.setPublicEligible(eligible);
        c.setCategory(category);
        c.setCalculatedAt(T0);
        HypeDimensions d = new HypeDimensions();
        d.setTrend(trend == null ? null : BigDecimal.valueOf(trend));
        c.setDimensions(d);
        rows.add(c);
        return c;
    }

    private WardrobeItem piece(String brand, Brand catalogBrand, String color, String category, double score, boolean eligible) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(next());
        w.setBrandName(brand);
        w.setBrand(catalogBrand);
        w.setColor(color);
        w.setCategory(category);
        pieceRows.add(w);
        score(HypeEntityType.PIECE, w.getId(), score, eligible, score / 2 + 20, seq % 3 == 0 ? null : category);
        return w;
    }

    private Scheme look(Season season, double score, boolean eligible) {
        Scheme s = new Scheme();
        s.assignId(next());
        s.setTitle("look " + seq);
        s.setSeason(season);
        schemeRows.add(s);
        score(HypeEntityType.SCHEME, s.getId(), score, eligible, null, null);
        return s;
    }

    private BrandProfile brand(String name, String country, String category) {
        User owner = new User();
        owner.assignId(next());
        owner.setProfileType(ProfileType.MARCA);
        BrandProfile b = new BrandProfile();
        b.assignId(next());
        b.setOwner(owner);
        b.setBrandName(name);
        b.setSlug(name.toLowerCase());
        b.setCountry(country);
        b.setFashionCategory(category);
        b.setLogoUrl("/logos/" + name + ".png");
        b.setStoreUrl("https://loja.example/" + name);
        b.setApprovalStatus(ApprovalStatus.APROVADO);
        return b;
    }

    private SealBond bond(Scheme s, Instant expires) {
        SealBond b = new SealBond();
        b.assignId(next());
        b.setScheme(s);
        b.setExpiresAt(expires);
        b.setStatus(SealBondStatus.APPROVED);
        return b;
    }

    private ExplorerService world() {
        when(hype.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(any(), eq(HypeScoreConfig.DEFAULT_VERSION), eq(HypeStatus.AVAILABLE)))
                .thenAnswer(a -> rows.stream().filter(r -> r.getEntityType() == a.getArgument(0) && r.isPublicEligible()).toList());
        when(hype.findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION))).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(1);
            return rows.stream().filter(r -> r.getEntityType() == a.getArgument(0) && ids.contains(r.getEntityId())).toList();
        });
        when(pieces.findByIdIn(anyCollection())).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(0);
            return pieceRows.stream().filter(w -> ids.contains(w.getId())).toList();
        });
        when(schemes.findByIdIn(anyCollection())).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(0);
            return schemeRows.stream().filter(s -> ids.contains(s.getId())).toList();
        });
        Brand farmBrand = new Brand("Farm", "farm", BrandSource.SEEDED);
        piece("Nike", null, "blue", "upper_piece", 82, true);
        piece("nike ", null, "black", "upper_piece", 71, true);
        piece("NIKE", null, "blue", "lower_piece", 64.4, true);
        piece("Nike", null, "blue", "upper_piece", 99, false);
        piece("Nike", null, "white", "footwear", 58, true);
        piece("Nike", null, "blue", "upper_piece", 91, true);
        piece("Zara", null, "white", "upper_piece", 45, true);
        piece("Zara", null, "black", "lower_piece", 52, true);
        piece(null, farmBrand, "green", "full_body_piece", 76, true);
        piece("Livre", farmBrand, "green", "full_body_piece", 68, true);
        piece("x", farmBrand, "green", "full_body_piece", 63, true);
        piece(" ", null, "black", "accessory", 40, true);
        Scheme l1 = look(Season.SUMMER, 88, true);
        Scheme l2 = look(Season.SUMMER, 72, true);
        Scheme l3 = look(Season.SUMMER, 61, true);
        Scheme l4 = look(Season.WINTER, 55, true);
        Scheme l5 = look(null, 90, true);
        Scheme l6 = look(Season.WINTER, 30, false);
        look(Season.WINTER, 47, true);
        look(Season.WINTER, 49, true);

        BrandProfile nike = brand("Nike", "BR", "sportswear");
        BrandProfile zara = brand("Zara", "ES", "fast_fashion");
        BrandProfile osklen = brand("Osklen", null, null);
        when(brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(nike, zara, osklen));
        Instant future = Instant.now().plusSeconds(86_400 * 30L);
        when(bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(eq(nike.getOwner().getId()), eq(SealBondStatus.APPROVED)))
                .thenReturn(List.of(bond(l1, null), bond(l2, future), bond(l3, null), bond(l1, null), bond(l5, T0), bond(null, null)));
        when(bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(eq(zara.getOwner().getId()), eq(SealBondStatus.APPROVED)))
                .thenReturn(List.of(bond(l4, null), bond(l6, null)));
        when(bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(eq(osklen.getOwner().getId()), eq(SealBondStatus.APPROVED))).thenReturn(List.of());

        when(analytics.countryColors()).thenReturn(List.of(row("country", "BR", "color", "blue", "total", 5L),
                row("country", "BR", "color", "black", "total", 7L), row("country", "US", "color", "white", "total", 3L),
                row("country", "BR", "color", "green", "total", 7L)));
        when(analytics.schemesByCountry(any())).thenReturn(List.of(row("country", "BR", "schemes", 4L), row("country", "US", "schemes", 1L)));
        when(analytics.piecesByCountry(any())).thenReturn(List.of(row("country", "BR", "pieces", 3L), row("country", "PT", "pieces", 2L),
                row("country", "AR", "pieces", 9L)));
        when(analytics.colorRanking(isNull(), anyInt())).thenReturn(List.of(row("color", "blue", "total", 9L), row("color", "black", "total", 4L)));
        when(analytics.colorRanking(eq("BR"), anyInt())).thenReturn(List.of(row("color", "green", "total", 3L)));
        when(analytics.looksBySeason("BR")).thenReturn(List.of(row("season", "SUMMER", "total", 2L)));
        when(analytics.brandFacets()).thenReturn(List.of(row("brand", "nike", "colors", "blue,black", "seasons", "summer,winter"),
                row("brand", "zara", "colors", "white", "seasons", "spring,null")));
        when(analytics.brandUsage(500)).thenReturn(List.of(row("brand", "Nike", "public_pieces", 5L), row("brand", "Zara", "public_pieces", 0L),
                row("brand", "Osklen", "public_pieces", 2L), row("brand", "Adidas", "public_pieces", 2L)));
        when(analytics.countries()).thenReturn(List.of(row("country", "BR", "public_schemes", 4L), row("country", "US", "public_schemes", 1L),
                row("country", "PT", "public_schemes", 7L)));
        when(catalog.catalogBrands()).thenReturn(List.of(
                row("name", "Farm", "slug", "farm", "logoUrl", "/f.png", "country", "BR", "categories", List.of("full_body_piece", "upper_piece"),
                        "catalogProducts", 12L, "storeUrl", "https://farm.example"),
                row("name", "nike", "slug", "nike-cat", "logoUrl", null, "country", "US", "categories", List.of("footwear"),
                        "catalogProducts", 3L, "storeUrl", null),
                row("name", "Hering", "slug", "hering", "logoUrl", null, "country", null, "categories", List.of(),
                        "catalogProducts", 1L, "storeUrl", null)));
        when(ai.text(any())).thenReturn(new AiOutcome<>("Leitura da IA", null, AiCallResult.SUCCESS, false, "local", "m", 1L,
                BigDecimal.ZERO, null, new AiOutcome.Explanation("INSIGHT_GENERATOR", "RF24", "local", "m", List.of("rankings"), "OK", "ok"), null));
        return new ExplorerService(analytics, brands, bonds, ai, hype, HypeScoreConfig.defaults(), pieces, schemes);
    }

    private static List<List<Object>> aggs(List<ExplorerService.Agg> list) {
        return list.stream().map(a -> List.<Object>of(a.key(), a.value(), a.items())).toList();
    }

    @Test
    @SuppressWarnings("unchecked")
    void retratoDoExplorador() throws Exception {
        ExplorerService explorer = world();
        CurrentUser viewer = new CurrentUser(new UUID(0xE7, 999), "visitante", "USER", ProfileType.PESSOAL, true,
                br.com.fashionai.domain.model.enums.AccountStatus.ACTIVE, "127.0.0.1", "jupiter");

        p.add("globalPanel.default", explorer.globalPanel(null, null));
        p.add("globalPanel.selected", explorer.globalPanel(viewer, "BR"));
        p.add("globalPanel.filtered", explorer.globalPanel(viewer, "", " summer ", " blue "));
        p.add("globalPanel.badSeason", attempt(() -> explorer.globalPanel(null, null, "monsoon", null)));
        p.add("globalPanel.badColor", attempt(() -> explorer.globalPanel(null, null, null, "cor-inventada")));

        p.add("brands.noCatalog.default", explorer.brandsAndStores(null, null, null, null, null));
        explorer.setCatalog(catalog);
        p.add("brands.default", explorer.brandsAndStores(null, null, null, null, null));
        p.add("brands.schemes", explorer.brandsAndStores(viewer, "", "", "", "schemes"));
        p.add("brands.term", explorer.brandsAndStores(null, " NI ", null, null, "HYPE"));
        p.add("brands.country", explorer.brandsAndStores(null, null, "br", null, null));
        p.add("brands.category", explorer.brandsAndStores(null, null, null, "full_body_piece", null));
        p.add("brands.category2", explorer.brandsAndStores(null, null, null, "SPORTSWEAR", null));
        p.add("brands.color", explorer.brandsAndStores(null, null, null, null, null, " black ", null, null));
        p.add("brands.season", explorer.brandsAndStores(null, null, null, null, null, null, " Spring ", null));
        p.add("brands.level", explorer.brandsAndStores(null, null, null, null, null, null, null, "relevant"));
        p.add("brands.levelHigh", explorer.brandsAndStores(null, null, null, null, "SCHEMES", "", "", "viral"));
        p.add("brands.badLevel", attempt(() -> explorer.brandsAndStores(null, null, null, null, null, null, null, "ESTILOSO")));

        p.add("insights.anonymous", explorer.insights(null));
        p.add("insights.viewer", explorer.insights(viewer));
        ArgumentCaptor<AiEngine.TextCall<String>> call = ArgumentCaptor.forClass(AiEngine.TextCall.class);
        verify(ai).text(call.capture());
        AiEngine.TextCall<String> c = call.getValue();
        // o JSON dos rankings sai de Map.of (ordem de iteração varia por JVM): o retrato relê o JSON com chaves ordenadas
        p.add("ai.call", List.of(c.userId(), c.capability(), c.system(), c.prompt().substring(0, 10),
                br.com.fashionai.application.common.Json.map(c.prompt().substring(10)), c.images(), c.maxTokens(), c.inputsUsed(),
                String.valueOf(c.protectedNames()), c.webSearch(), String.valueOf(c.local().get()), String.valueOf(c.parser().apply("  texto  ")),
                String.valueOf(c.parser().apply(" "))));

        p.add("hypeRankings", explorer.hypeRankings());
        p.add("seasonAverages", aggs(explorer.seasonAverages()));
        p.add("publicPieces", explorer.publicPieces().stream().map(x -> List.of(x.piece(), x.score())).toList());
        p.add("brandKey", java.util.Arrays.asList(ExplorerService.brandKey(null), ExplorerService.brandKey(pieceRows.get(1)),
                ExplorerService.brandKey(pieceRows.get(8)), ExplorerService.brandKey(pieceRows.get(11))));
        p.add("brandHype.bonded", ExplorerService.brandHype(List.of(80.0, 70.0, 61.0), List.of(10.0), null));
        p.add("brandHype.group", ExplorerService.brandHype(List.of(80.0), List.of(90.0, 10.0, 50.0, 60.0, 70.0, 80.0), HypeScoreConfig.defaults()));
        p.add("brandHype.none", ExplorerService.brandHype(null, List.of(1.0, 2.0), null));
        p.add("brandHype.nulls", ExplorerService.brandHype(null, null, null));
        p.add("averageBy", aggs(ExplorerService.averageBy(List.of("a1", "a2", "a3", "b1", "b2", "c1", "c2", "c3", "c4", " 9", "d"),
                x -> x.substring(0, 1), x -> x.startsWith("d") ? null : Double.valueOf(x.substring(1)), 2)));
        p.add("averageBy.all", aggs(ExplorerService.averageBy(List.of("a1", "a2", "a3", "c1", "c2", "c3", "c9"), x -> x.substring(0, 1),
                x -> Double.valueOf(x.substring(1)), 0)));
        p.add("constants", List.of(ExplorerService.MIN_DATA, ExplorerService.MIN_BRAND_ITEMS, ExplorerService.BRAND_TOP_ITEMS,
                ExplorerService.RANKING_ROWS, Set.of(HypeLevel.values()).size()));

        p.invocations("analytics", analytics);
        p.invocations("brands", brands);
        p.invocations("bonds", bonds);
        p.invocations("hype", hype);
        p.invocations("pieces", pieces);
        p.invocations("schemes", schemes);
        p.invocations("catalog", catalog);
        p.verify(ExplorerServiceCharacterizationTest.class, GOLDEN);
    }
}
