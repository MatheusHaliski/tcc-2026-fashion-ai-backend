package br.com.fashionai.application.hype;

import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Caracterização das leituras do HypeScore (todos os métodos públicos do {@link HypeQueryService}) num universo fixo:
 * cards, detalhe, histórico, Em alta, agregados, painel pessoal, ranking regional, filtros, posições e globo. O retrato
 * foi gravado no código original, antes da divisão do serviço em colaboradores.
 */
class HypeQueryGoldenTest {
    private static final Instant CALCULATED = Instant.parse("2026-01-02T03:04:05Z");
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private final LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
    private final Random rnd = new Random(1512L);
    private final List<WardrobeItem> catalog = new ArrayList<>();
    private final List<Scheme> looks = new ArrayList<>();
    private final List<SchemeItem> lookItems = new ArrayList<>();
    private final List<HypeScoreCurrent> rows = new ArrayList<>();
    private final List<HypeScoreSnapshot> snaps = new ArrayList<>();
    private final User me = user("me", "BR");
    private final User ana = user("ana", "FR");
    private final User bia = user("bia", null);
    private final User blocked = user("blocked", "US");
    private final CurrentUser viewer = new CurrentUser(me.getId(), "me", "USER", null, true, null, null, null);
    private HypeQueryService query;

    static UUID id(String key) {
        return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
    }

    static User user(String key, String country) {
        User u = new User();
        u.assignId(id(key));
        u.setUsername(key);
        u.setCountry(country);
        u.setProfileVisibility(Visibility.PUBLIC);
        u.setProfileType(br.com.fashionai.domain.model.enums.ProfileType.PESSOAL);
        return u;
    }

    static BigDecimal dec(double v) {
        return BigDecimal.valueOf(v);
    }

    HypeScoreCurrent row(HypeEntityType type, UUID entity, User owner, String category, String subcategory, boolean eligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(entity);
        c.setOwnerId(owner.getId());
        c.setAlgorithmVersion(config.algorithmVersion());
        boolean available = rnd.nextInt(8) != 0;
        c.setStatus(available ? HypeStatus.AVAILABLE : HypeStatus.INSUFFICIENT_DATA);
        double score = 10 + rnd.nextInt(90) + rnd.nextInt(10) / 10.0;
        c.setScore(available ? dec(score) : null);
        c.setLevel(available ? config.level(score) : null);
        HypeDimensions d = new HypeDimensions();
        d.setPopularity(dec(rnd.nextInt(100)));
        d.setEngagement(rnd.nextBoolean() ? dec(rnd.nextInt(100)) : null);
        d.setTrend(rnd.nextInt(6) == 0 ? null : dec(rnd.nextInt(1000) / 10.0));
        d.setTrendVelocity(dec(rnd.nextInt(100)));
        d.setLongevity(rnd.nextBoolean() ? dec(40 + rnd.nextInt(60)) : null);
        d.setRarity(rnd.nextBoolean() ? dec(rnd.nextInt(100)) : null);
        d.setNovelty(dec(rnd.nextInt(100)));
        c.setDimensions(d);
        boolean hasDelta = rnd.nextInt(4) != 0;
        double delta = rnd.nextInt(30) - 15 + 0.5;
        c.setDeltaPoints(hasDelta ? dec(delta) : null);
        c.setDeltaPercent(hasDelta ? dec(delta * 2) : null);
        c.setDirection(hasDelta ? (delta >= 2 ? "UP" : delta <= -2 ? "DOWN" : "STABLE") : null);
        c.setMomentum(HypeMomentum.values()[rnd.nextInt(HypeMomentum.values().length)]);
        c.setPublicEligible(eligible);
        c.setCategory(type == HypeEntityType.PIECE ? category : null);
        c.setCategories(category);
        c.setSubcategories(subcategory);
        c.setStyles(rnd.nextBoolean() ? "casual,street" : "classic");
        c.setOccasions(rnd.nextBoolean() ? "work" : "party");
        c.setCountry(owner.getCountry());
        c.setRegion(owner.getCountry() == null ? null : br.com.fashionai.application.taxonomy.WorldRegions.of(owner.getCountry()));
        c.setSignalsJson(rnd.nextBoolean() ? "{\"similarGrowthPercent\":" + (rnd.nextInt(60) - 10) + ",\"events\":12}" : "{}");
        c.setReasonsJson("[{\"code\":\"TREND_STRONG\",\"tone\":\"POSITIVE\"}]");
        c.setCalculatedAt(CALCULATED);
        rows.add(c);
        for (int k = 0; k < 6; k++) {
            HypeScoreSnapshot s = new HypeScoreSnapshot();
            s.setEntityType(type);
            s.setEntityId(entity);
            s.setSnapshotDate(today.minusDays(k * 5L));
            s.setStatus(HypeStatus.AVAILABLE);
            s.setScore(k == 3 ? null : dec(20 + rnd.nextInt(70)));
            s.setLevel(config.level(50));
            s.setDimensions(d);
            snaps.add(s);
        }
        return c;
    }

    WardrobeItem piece(String key, User owner, String category, String sub, String color, Visibility v) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(id(key));
        w.setUser(owner);
        w.setName(key);
        w.setCategory(category);
        w.setSubcategory(sub);
        w.setColor(color);
        w.setBrandName(rnd.nextBoolean() ? (rnd.nextBoolean() ? "Nike" : " zara ") : null);
        w.setStyleTags("casual,street");
        w.setOccasionTags("work");
        w.setVisibility(v);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.setThumbnailUrl(rnd.nextBoolean() ? "https://img/" + key + ".png" : null);
        w.setLastWornDate(rnd.nextBoolean() ? today.minusDays(rnd.nextInt(200)) : null);
        w.markCreatedAt(Instant.now().minus(30 + rnd.nextInt(300), ChronoUnit.DAYS));
        catalog.add(w);
        row(HypeEntityType.PIECE, w.getId(), owner, category, sub, v == Visibility.PUBLIC);
        return w;
    }

    Scheme look(String key, User owner, WardrobeItem... parts) {
        Scheme s = new Scheme();
        s.assignId(id(key));
        s.setUser(owner);
        s.setTitle(key);
        s.setVisibility(Visibility.PUBLIC);
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setStyle("casual");
        s.setOccasion("work");
        s.setRemixCount(rnd.nextInt(5));
        s.setCoverImageUrl(rnd.nextBoolean() ? "https://cover/" + key : null);
        looks.add(s);
        for (int i = 0; i < parts.length; i++) {
            SchemeItem si = new SchemeItem();
            si.assignId(id(key + i));
            si.setScheme(s);
            si.setWardrobeItem(parts[i]);
            si.setSortOrder(parts.length - i);
            lookItems.add(si);
        }
        String cats = String.join(",", java.util.Arrays.stream(parts).map(WardrobeItem::getCategory).distinct().sorted().toList());
        String subs = String.join(",", java.util.Arrays.stream(parts).map(WardrobeItem::getSubcategory).distinct().sorted().toList());
        row(HypeEntityType.SCHEME, s.getId(), owner, cats, subs, true);
        return s;
    }

    static <T> List<T> byIds(Collection<?> ids, List<T> all, java.util.function.Function<T, UUID> id) {
        return all.stream().filter(x -> ids.contains(id.apply(x))).toList();
    }

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        String[][] kinds = {{"upper_piece", "t_shirt", "white"}, {"shoes_piece", "casual_sneakers", "black"}, {"lower_piece", "jeans", "blue"},
                {"shoes_piece", "heels", "red"}};
        List<User> owners = List.of(me, ana, bia, blocked, me);
        for (int i = 0; i < 24; i++) {
            String[] k = kinds[i % kinds.length];
            piece("p" + i, owners.get(i % owners.size()), k[0], k[1], k[2], i % 7 == 6 ? Visibility.PRIVATE : Visibility.PUBLIC);
        }
        catalog.get(4).setDisponivel(false);
        for (int i = 0; i < 6; i++) {
            look("l" + i, owners.get(i % owners.size()), catalog.get(i), catalog.get(i + 5), catalog.get((i * 3) % 24));
        }
        WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
        SchemeRepository schemes = mock(SchemeRepository.class);
        SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
        HypeScoreCurrentRepository current = mock(HypeScoreCurrentRepository.class);
        HypeScoreSnapshotRepository snapshots = mock(HypeScoreSnapshotRepository.class);
        StyleDnaRepository dnas = mock(StyleDnaRepository.class);
        Guard guard = mock(Guard.class);
        SchemeService schemeService = mock(SchemeService.class);
        WardrobeService wardrobe = mock(WardrobeService.class);
        when(pieces.findByIdIn(anyCollection())).thenAnswer(a -> byIds(a.getArgument(0), catalog, WardrobeItem::getId));
        when(pieces.findById(any())).thenAnswer(a -> catalog.stream().filter(w -> w.getId().equals(a.getArgument(0))).findFirst());
        when(pieces.findByUserIdOrderByCreatedAtDesc(any())).thenAnswer(a -> catalog.stream().filter(w -> w.getUser().getId().equals(a.getArgument(0))).toList());
        when(schemes.findByIdIn(anyCollection())).thenAnswer(a -> byIds(a.getArgument(0), looks, Scheme::getId));
        when(schemes.findById(any())).thenAnswer(a -> looks.stream().filter(s -> s.getId().equals(a.getArgument(0))).findFirst());
        when(schemes.findByUserIdOrderByCreatedAtDesc(any())).thenAnswer(a -> looks.stream().filter(s -> s.getUser().getId().equals(a.getArgument(0))).toList());
        when(schemeItems.findBySchemeIdIn(anyCollection())).thenAnswer(a -> lookItems.stream()
                .filter(si -> ((Collection<UUID>) a.getArgument(0)).contains(si.getScheme().getId())).toList());
        when(schemeItems.findBySchemeIdOrderBySortOrder(any())).thenAnswer(a -> lookItems.stream().filter(si -> si.getScheme().getId().equals(a.getArgument(0)))
                .sorted(java.util.Comparator.comparingInt(SchemeItem::getSortOrder)).toList());
        when(schemeItems.countByWardrobeItemId(any())).thenAnswer(a -> lookItems.stream().filter(si -> si.getWardrobeItem().getId().equals(a.getArgument(0))).count());
        when(current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), anyCollection(), any())).thenAnswer(a -> rows.stream()
                .filter(c -> c.getEntityType() == a.getArgument(0) && ((Collection<UUID>) a.getArgument(1)).contains(c.getEntityId())).toList());
        when(current.findByEntityTypeAndEntityIdAndAlgorithmVersion(any(), any(), any())).thenAnswer(a -> rows.stream()
                .filter(c -> c.getEntityType() == a.getArgument(0) && c.getEntityId().equals(a.getArgument(1))).findFirst());
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(any(), any(), any())).thenAnswer(a -> rows.stream()
                .filter(c -> c.getEntityType() == a.getArgument(0) && c.isPublicEligible() && c.getStatus() == a.getArgument(2)).toList());
        when(current.findByOwnerIdAndEntityTypeAndAlgorithmVersion(any(), any(), any())).thenAnswer(a -> rows.stream()
                .filter(c -> c.getOwnerId().equals(a.getArgument(0)) && c.getEntityType() == a.getArgument(1)).toList());
        when(snapshots.findByEntityTypeAndEntityIdAndAlgorithmVersionAndSnapshotDateGreaterThanEqualOrderBySnapshotDateAsc(any(), any(), any(), any()))
                .thenAnswer(a -> snaps.stream().filter(s -> s.getEntityType() == a.getArgument(0) && s.getEntityId().equals(a.getArgument(1))
                        && !s.getSnapshotDate().isBefore(a.getArgument(3))).sorted(java.util.Comparator.comparing(HypeScoreSnapshot::getSnapshotDate)).toList());
        when(snapshots.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(any(), any(), any(), any())).thenAnswer(a -> snaps.stream()
                .filter(s -> s.getEntityType() == a.getArgument(0) && !s.getSnapshotDate().isBefore(a.getArgument(2)) && !s.getSnapshotDate().isAfter(a.getArgument(3))).toList());
        when(snapshots.findByEntityTypeAndEntityIdInAndAlgorithmVersionAndSnapshotDateGreaterThanEqual(any(), anyCollection(), any(), any())).thenAnswer(a -> snaps.stream()
                .filter(s -> s.getEntityType() == a.getArgument(0) && ((Collection<UUID>) a.getArgument(1)).contains(s.getEntityId())
                        && !s.getSnapshotDate().isBefore(a.getArgument(3))).toList());
        StyleDna dna = new StyleDna();
        dna.setStyleKeywords("casual");
        dna.setColorPalette("black,white");
        dna.setOccasionKeywords("work");
        when(dnas.findByUserId(me.getId())).thenReturn(Optional.of(dna));
        when(guard.canView(any(), any(), any())).thenAnswer(a -> !blocked.getId().equals(a.getArgument(1)) && a.getArgument(2) == Visibility.PUBLIC
                || me.getId().equals(a.getArgument(1)));
        when(schemeService.canView(any(), any())).thenAnswer(a -> !blocked.getId().equals(((Scheme) a.getArgument(1)).getUser().getId()));
        when(schemeService.view(any(), any(), any())).thenAnswer(a -> {
            Views.SchemeView v = mock(Views.SchemeView.class);
            when(v.id()).thenReturn(((Scheme) a.getArgument(1)).getId());
            return v;
        });
        Map<String, String> store = new HashMap<>();
        RenderCachePort cache = new RenderCachePort() {
            @Override
            public Optional<String> get(String key) {
                return Optional.ofNullable(store.get(key));
            }

            @Override
            public void put(String key, String value, java.time.Duration ttl) {
                store.put(key, value);
            }

            @Override
            public void evict(String key) {
                store.remove(key);
            }
        };
        query = new HypeQueryService(config, current, snapshots, pieces, schemes, schemeItems, dnas, guard, wardrobe, schemeService, new HypeCache(cache), null);
        AuraHypeDropService drops = mock(AuraHypeDropService.class);
        when(drops.classifications(any(), anyCollection())).thenAnswer(a -> ((Collection<UUID>) a.getArgument(1)).contains(id("p1"))
                ? Map.of(id("p1"), Map.of("tier", "GOLD")) : Map.of());
        query.setFashionDrops(drops);
    }

    @Test
    void leiturasIguaisAoRetrato() throws Exception {
        Map<String, Object> out = new LinkedHashMap<>();
        List<UUID> ids = catalog.stream().map(WardrobeItem::getId).toList();
        out.put("summaries", query.summaries(null, HypeEntityType.PIECE, ids));
        out.put("summariesLooks", query.summaries(viewer, HypeEntityType.SCHEME, looks.stream().map(Scheme::getId).toList()));
        out.put("detailPiece", query.detail(viewer, HypeEntityType.PIECE, id("p1")));
        out.put("detailLook", query.detail(viewer, HypeEntityType.SCHEME, id("l0")));
        out.put("history", query.history(null, HypeEntityType.PIECE, id("p2"), 30));
        out.put("currentOf", query.currentOf(HypeEntityType.PIECE, ids.subList(0, 5)).keySet());
        for (HypeEntityType t : HypeEntityType.values()) {
            for (int w : new int[]{1, 7, 30}) {
                out.put("trending" + t + w, query.trending(viewer, t, w, null, null, null, 10));
                out.put("ranking" + t + w, query.ranking(viewer, t, w, null, null, null, null, 0, 6));
                out.put("facets" + t + w, query.rankingFacets(t, w, null, null));
                out.put("globe" + t + w, query.globe(null, t, w, null, null, null));
            }
            out.put("positions" + t, query.positions(viewer, t, t == HypeEntityType.PIECE ? id("p5") : id("l1")));
        }
        out.put("trendingCut", query.trending(null, HypeEntityType.PIECE, 7, "shoes_piece", "casual", "work", 3));
        out.put("rankingCut", query.ranking(null, HypeEntityType.PIECE, 7, "EUROPA", "fr", "shoes_piece", null, 1, 2));
        out.put("facetsCut", query.rankingFacets(HypeEntityType.SCHEME, 7, "OUTRAS", "shoes_piece"));
        out.put("globeCut", query.globe(viewer, HypeEntityType.PIECE, 30, "shoes_piece", null, "niche"));
        for (HypeQueryService.RankGroup g : HypeQueryService.RankGroup.values()) {
            for (int w : new int[]{1, 7, 30}) {
                out.put("groups" + g + w, query.trendingGroups(viewer, g, w, null, null, null, 10));
            }
            out.put("chips" + g, query.groups(viewer, g, List.of("nike", "zara", me.getId().toString(), ana.getId().toString(), "x"), 30));
        }
        out.put("wardrobe", query.wardrobe(viewer));
        out.put("movers", query.movers(viewer, 30));
        HypeGolden.assertMatches("query-reads", HypeGolden.canonical(out));
    }
}
