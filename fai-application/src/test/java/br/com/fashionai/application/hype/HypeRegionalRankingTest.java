package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Explorador → Ranking de HypeScore (RF53): recortes por região do mundo, país, categoria e subcategoria; o look entra
 * pelas peças que o compõem; só a população pública elegível; posições do item; contagens dos filtros; bloqueios.
 */
class HypeRegionalRankingTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private HypeScoreCurrentRepository current;
    private WardrobeItemRepository pieces;
    private SchemeRepository schemes;
    private SchemeItemRepository schemeItems;
    private Guard guard;
    private SchemeService schemeService;
    private HypeQueryService query;

    private final List<WardrobeItem> catalog = new ArrayList<>();
    private final List<Scheme> looks = new ArrayList<>();
    private final List<SchemeItem> lookItems = new ArrayList<>();
    private final List<HypeScoreCurrent> pieceRows = new ArrayList<>();
    private final List<HypeScoreCurrent> lookRows = new ArrayList<>();

    private final User ana = user("ana", "BR");
    private final User bia = user("bia", "FR");
    private final User cai = user("cai", "US");
    private final User dan = user("dan", null);
    private final User eva = user("eva", "AR");

    private WardrobeItem sneakerAna;
    private WardrobeItem teeAna;
    private WardrobeItem heelsBia;
    private WardrobeItem privateAna;
    private Scheme lookAna;
    private Scheme lookBia;

    static User user(String name, String country) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(name);
        u.setCountry(country);
        u.setProfileVisibility(Visibility.PUBLIC);
        u.setProfileType(ProfileType.PESSOAL);
        return u;
    }

    static String regionOf(String country) {
        return country == null ? null : br.com.fashionai.application.taxonomy.WorldRegions.of(country);
    }

    HypeScoreCurrent row(HypeEntityType type, UUID id, User owner, double score, boolean eligible, String categories, String subcategories) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(id);
        c.setOwnerId(owner.getId());
        c.setAlgorithmVersion("HYPE_V2");
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setPublicEligible(eligible);
        c.setCategory(type == HypeEntityType.PIECE ? categories : null);
        c.setCategories(categories);
        c.setSubcategories(subcategories);
        c.setCountry(owner.getCountry());
        c.setRegion(regionOf(owner.getCountry()));
        c.setCalculatedAt(Instant.now());
        c.setWindowStart(Instant.now());
        c.setWindowEnd(Instant.now());
        return c;
    }

    WardrobeItem piece(User owner, String category, String subcategory, double score, boolean eligible) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setName(subcategory + " de " + owner.getUsername());
        w.setCategory(category);
        w.setSubcategory(subcategory);
        w.setVisibility(eligible ? Visibility.PUBLIC : Visibility.PRIVATE);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        catalog.add(w);
        pieceRows.add(row(HypeEntityType.PIECE, w.getId(), owner, score, eligible, category, subcategory));
        return w;
    }

    Scheme look(User owner, double score, WardrobeItem... parts) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(owner);
        looks.add(s);
        int order = 0;
        for (WardrobeItem w : parts) {
            SchemeItem si = new SchemeItem();
            si.assignId(UUID.randomUUID());
            si.setScheme(s);
            si.setWardrobeItem(w);
            si.setSortOrder(order++);
            lookItems.add(si);
        }
        // como o job grava: categorias/subcategorias das peças do look (CSV ordenado, sem repetição)
        String cats = String.join(",", java.util.Arrays.stream(parts).map(WardrobeItem::getCategory).distinct().sorted().toList());
        String subs = String.join(",", java.util.Arrays.stream(parts).map(WardrobeItem::getSubcategory).distinct().sorted().toList());
        lookRows.add(row(HypeEntityType.SCHEME, s.getId(), owner, score, true, cats, subs));
        return s;
    }

    static <T> List<T> byIds(Collection<?> ids, List<T> all, java.util.function.Function<T, UUID> id) {
        return all.stream().filter(x -> ids.contains(id.apply(x))).toList();
    }

    @BeforeEach
    void setUp() {
        current = mock(HypeScoreCurrentRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        schemes = mock(SchemeRepository.class);
        schemeItems = mock(SchemeItemRepository.class);
        guard = mock(Guard.class);
        schemeService = mock(SchemeService.class);
        WardrobeService wardrobe = mock(WardrobeService.class);
        // cache de verdade (em memória): o ranking volta do JSON guardado, como no Redis
        Map<String, String> store = new java.util.HashMap<>();
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
        query = new HypeQueryService(config, current, null, pieces, schemes, schemeItems, null, guard, wardrobe, schemeService, new HypeCache(cache));

        sneakerAna = piece(ana, "shoes_piece", "casual_sneakers", 90, true);
        teeAna = piece(ana, "upper_piece", "t_shirt", 70, true);
        heelsBia = piece(bia, "shoes_piece", "heels", 80, true);
        piece(cai, "shoes_piece", "casual_sneakers", 60, true);
        piece(dan, "lower_piece", "jeans", 50, true);                    // sem país: "Outras regiões"
        piece(eva, "shoes_piece", "loafers", 85, true);
        privateAna = piece(ana, "shoes_piece", "casual_sneakers", 99, false);   // privada: nunca entra
        WardrobeItem jeansBia = piece(bia, "lower_piece", "jeans", 40, true);

        lookAna = look(ana, 75, sneakerAna, teeAna);   // tem calçado e parte de cima
        lookBia = look(bia, 88, jeansBia, heelsBia);   // tem calçado e parte de baixo
        look(cai, 66, teeAna);                          // só parte de cima

        // a consulta do repositório já filtra; a linha não elegível aqui prova a defesa extra do serviço
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, "HYPE_V2", HypeStatus.AVAILABLE)).thenReturn(pieceRows);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME, "HYPE_V2", HypeStatus.AVAILABLE)).thenReturn(lookRows);
        when(current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), anyCollection(), eq("HYPE_V2")))
                .thenAnswer(a -> byIds(a.getArgument(1), pieceRows, HypeScoreCurrent::getEntityId));
        when(current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.SCHEME), anyCollection(), eq("HYPE_V2")))
                .thenAnswer(a -> byIds(a.getArgument(1), lookRows, HypeScoreCurrent::getEntityId));
        when(current.findByEntityTypeAndEntityIdAndAlgorithmVersion(any(), any(), eq("HYPE_V2")))
                .thenAnswer(a -> (a.getArgument(0) == HypeEntityType.PIECE ? pieceRows : lookRows).stream()
                        .filter(c -> c.getEntityId().equals(a.getArgument(1))).findFirst());
        when(pieces.findByIdIn(anyCollection())).thenAnswer(a -> byIds(a.getArgument(0), catalog, WardrobeItem::getId));
        when(pieces.findById(any())).thenAnswer(a -> catalog.stream().filter(w -> w.getId().equals(a.getArgument(0))).findFirst());
        when(schemes.findByIdIn(anyCollection())).thenAnswer(a -> byIds(a.getArgument(0), looks, Scheme::getId));
        when(schemes.findById(any())).thenAnswer(a -> looks.stream().filter(s -> s.getId().equals(a.getArgument(0))).findFirst());
        when(schemeItems.findBySchemeIdIn(anyCollection())).thenAnswer(a -> lookItems.stream().filter(si -> ((Collection<?>) a.getArgument(0)).contains(si.getScheme().getId())).toList());
        when(guard.canView(any(), any(), eq(Visibility.PUBLIC))).thenReturn(true);
        when(guard.canView(any(), any(), eq(Visibility.PRIVATE))).thenReturn(false);
        when(schemeService.canView(any(), any())).thenReturn(true);
        when(schemeService.view(any(), any(), any())).thenAnswer(a -> mock(Views.SchemeView.class));
        when(wardrobe.viewerState(any(), any())).thenReturn(Views.ViewerState.NONE);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> items(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("items");
    }

    static List<String> ids(Map<String, Object> out) {
        return items(out).stream().map(m -> String.valueOf(m.get("id"))).toList();
    }

    Map<String, Object> pieces(String region, String country, String category, String subcategory) {
        return query.ranking(null, HypeEntityType.PIECE, 7, region, country, category, subcategory, 0, 24);
    }

    @Test
    void worldRankingIsOnlyThePublicEligiblePopulationInScoreOrder() {
        Map<String, Object> out = pieces(null, null, null, null);
        assertThat(out.get("total")).isEqualTo(7);
        assertThat(ids(out)).doesNotContain(privateAna.getId().toString()).first().isEqualTo(sneakerAna.getId().toString());
        assertThat(items(out)).extracting(m -> m.get("rank")).containsExactly(1, 2, 3, 4, 5, 6, 7);
        Map<String, Object> top = items(out).get(0);
        assertThat(top.get("region")).isEqualTo("AMERICA_DO_SUL");
        assertThat(top.get("country")).isEqualTo("BR");
        assertThat(top.get("value")).isEqualTo(90.0);
        assertThat(top.get("piece")).isInstanceOf(Views.PieceView.class);
        assertThat(((Map<?, ?>) top.get("hype")).get("score")).isEqualTo(90.0);
        verify(current, never()).findByEntityTypeAndAlgorithmVersion(any(), any());
    }

    @Test
    void filtersByRegionCountryCategoryAndSubcategory() {
        // América do Sul: Ana (BR) e Eva (AR)
        assertThat(pieces("america_do_sul", null, null, null).get("total")).isEqualTo(3);
        // país dentro da região
        assertThat(ids(pieces("AMERICA_DO_SUL", "ar", null, null))).hasSize(1);
        // calçados no mundo: 90 (Ana), 85 (Eva), 80 (Bia), 60 (Cai) — a privada de 99 nunca
        Map<String, Object> shoes = pieces(null, null, "shoes_piece", null);
        assertThat(items(shoes)).extracting(m -> (Object) ((Map<?, ?>) m.get("hype")).get("score")).containsExactly(90.0, 85.0, 80.0, 60.0);
        // subcategoria + região
        assertThat(ids(pieces("AMERICA_DO_NORTE", null, "shoes_piece", "casual_sneakers"))).hasSize(1);
        // sem país = Outras regiões
        Map<String, Object> others = pieces("OUTRAS", null, null, null);
        assertThat(items(others)).singleElement().satisfies(m -> assertThat(m.get("region")).isEqualTo("OUTRAS"));
        @SuppressWarnings("unchecked")
        Map<String, Object> filters = (Map<String, Object>) pieces("europa", "fr", "SHOES_PIECE", null).get("filters");
        assertThat(filters).containsEntry("region", "EUROPA").containsEntry("country", "FR").containsEntry("category", "shoes_piece").containsEntry("subcategory", null);
    }

    @Test
    void paginatesWithStablePublicRanks() {
        Map<String, Object> p1 = query.ranking(null, HypeEntityType.PIECE, 7, null, null, null, null, 1, 3);
        assertThat(p1.get("page")).isEqualTo(1);
        assertThat(p1.get("hasMore")).isEqualTo(true);
        assertThat(items(p1)).extracting(m -> m.get("rank")).containsExactly(4, 5, 6);
        Map<String, Object> last = query.ranking(null, HypeEntityType.PIECE, 7, null, null, null, null, 2, 3);
        assertThat(last.get("hasMore")).isEqualTo(false);
        assertThat(items(last)).extracting(m -> m.get("rank")).containsExactly(7);
    }

    @Test
    void looksAreMatchedThroughTheirPiecesAndCarryEachPieceHype() {
        // "um look que tem calçado": o de Bia (88) e o de Ana (75); o de Cai (só camiseta) fica fora
        Map<String, Object> shoes = query.ranking(null, HypeEntityType.SCHEME, 7, null, null, "shoes_piece", null, 0, 24);
        assertThat(ids(shoes)).containsExactly(lookBia.getId().toString(), lookAna.getId().toString());
        // pela subcategoria de uma das peças, numa região
        Map<String, Object> sneakersSouth = query.ranking(null, HypeEntityType.SCHEME, 7, "AMERICA_DO_SUL", null, null, "casual_sneakers", 0, 24);
        Map<String, Object> only = items(sneakersSouth).get(0);
        assertThat(items(sneakersSouth)).hasSize(1);
        assertThat(only.get("id")).isEqualTo(lookAna.getId().toString());
        assertThat(only.get("scheme")).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) only.get("pieces");
        assertThat(parts).extracting(p -> p.get("id")).containsExactly(sneakerAna.getId().toString(), teeAna.getId().toString());
        assertThat(parts).extracting(p -> (Object) ((Map<?, ?>) p.get("hype")).get("score")).containsExactly(90.0, 70.0);
        assertThat(parts.get(0).get("category")).isEqualTo("shoes_piece");
    }

    @Test
    void blockedOwnersDisappearForTheViewerWithoutRenumbering() {
        CurrentUser viewer = new CurrentUser(UUID.randomUUID(), "leitor", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        when(guard.canView(eq(viewer), eq(bia.getId()), any())).thenReturn(false);   // bloqueio entre as contas
        Map<String, Object> out = query.ranking(viewer, HypeEntityType.PIECE, 7, null, null, "shoes_piece", null, 0, 24);
        assertThat(out.get("total")).isEqualTo(4);
        assertThat(ids(out)).doesNotContain(heelsBia.getId().toString());
        assertThat(items(out)).extracting(m -> m.get("rank")).containsExactly(1, 2, 4);   // a posição pública dos demais não muda
    }

    @Test
    void anItemThatStoppedBeingPublicAfterTheCachedRankingNeverShows() {
        assertThat(ids(pieces(null, null, null, null))).contains(sneakerAna.getId().toString());   // ranking calculado e guardado no cache
        pieceRows.stream().filter(c -> c.getEntityId().equals(sneakerAna.getId())).forEach(c -> c.setPublicEligible(false));
        assertThat(ids(pieces(null, null, null, null))).doesNotContain(sneakerAna.getId().toString());
    }

    @Test
    void facetsCountOnlyPublicRowsAndAverageTheHypeOfEachRegion() {
        Map<String, Object> f = query.rankingFacets(HypeEntityType.PIECE, 7, null, "shoes_piece");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> regions = (List<Map<String, Object>>) f.get("regions");
        assertThat(regions).extracting(m -> m.get("key")).containsExactly("AMERICA_DO_SUL", "AMERICA_DO_NORTE", "EUROPA");
        Map<String, Object> south = regions.get(0);
        assertThat(south.get("count")).isEqualTo(2);              // 90 (Ana) e 85 (Eva) — a privada de Ana não conta
        assertThat(south.get("avgHype")).isEqualTo(87.5);
        assertThat(String.valueOf(south.get("label"))).contains("worldRegions.america_do_sul");
        assertThat(((Map<?, ?>) f.get("world")).get("count")).isEqualTo(4);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> categories = (List<Map<String, Object>>) f.get("categories");
        assertThat(categories).extracting(m -> m.get("key")).containsExactly("upper_piece", "lower_piece", "shoes_piece");
        assertThat(categories).filteredOn(m -> "shoes_piece".equals(m.get("key"))).singleElement().satisfies(m -> assertThat(((Number) m.get("count")).intValue()).isEqualTo(4));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> subs = (List<Map<String, Object>>) f.get("subcategories");
        assertThat(subs).extracting(m -> m.get("key")).containsExactly("casual_sneakers", "heels", "loafers");
        assertThat(subs.get(0)).containsEntry("category", "shoes_piece");
        assertThat(((Number) subs.get(0).get("count")).intValue()).isEqualTo(2);

        Map<String, Object> south2 = query.rankingFacets(HypeEntityType.PIECE, 7, "AMERICA_DO_SUL", null);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> countries = (List<Map<String, Object>>) south2.get("countries");
        assertThat(countries).extracting(m -> m.get("key")).containsExactly("BR", "AR");   // dentro da região, mais itens primeiro
    }

    @Test
    void lookFacetsSplitSubcategoriesByTheirOwnCategory() {
        Map<String, Object> f = query.rankingFacets(HypeEntityType.SCHEME, 7, null, "shoes_piece");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> subs = (List<Map<String, Object>>) f.get("subcategories");
        // o look de Ana também tem camiseta e o de Bia, jeans — mas no filtro de calçados só entram as subcategorias de calçado
        assertThat(subs).extracting(m -> m.get("key")).containsExactlyInAnyOrder("casual_sneakers", "heels");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cats = (List<Map<String, Object>>) f.get("categories");
        assertThat(cats).filteredOn(m -> "upper_piece".equals(m.get("key"))).singleElement().satisfies(m -> assertThat(((Number) m.get("count")).intValue()).isEqualTo(2));
    }

    @Test
    @SuppressWarnings("unchecked")
    void positionsOfAPieceInEveryScope() {
        Map<String, Object> out = query.positions(null, HypeEntityType.PIECE, heelsBia.getId());
        assertThat(out.get("eligible")).isEqualTo(true);
        assertThat(out.get("window")).isEqualTo(7);
        List<Map<String, Object>> pos = (List<Map<String, Object>>) out.get("positions");
        assertThat(pos).extracting(m -> m.get("scope")).containsExactly("GLOBAL", "CATEGORY", "SUBCATEGORY", "REGION", "COUNTRY");
        assertThat(pos.get(0)).containsEntry("rank", 3L).containsEntry("total", 7);     // 90, 85, 80 — a privada de 99 não conta
        assertThat(pos.get(1)).containsEntry("key", "shoes_piece").containsEntry("rank", 3L).containsEntry("total", 4);
        assertThat(pos.get(2)).containsEntry("key", "heels").containsEntry("rank", 1L).containsEntry("total", 1);
        assertThat(pos.get(3)).containsEntry("key", "EUROPA").containsEntry("rank", 1L).containsEntry("total", 2);
        assertThat(pos.get(4)).containsEntry("key", "FR").containsEntry("rank", 1L).containsEntry("total", 2);
        assertThat(String.valueOf(pos.get(4).get("label"))).isNotBlank();
    }

    @Test
    @SuppressWarnings("unchecked")
    void positionsOfALookAreGlobalRegionAndCountry() {
        List<Map<String, Object>> pos = (List<Map<String, Object>>) query.positions(null, HypeEntityType.SCHEME, lookAna.getId()).get("positions");
        assertThat(pos).extracting(m -> m.get("scope")).containsExactly("GLOBAL", "REGION", "COUNTRY");
        assertThat(pos.get(0)).containsEntry("rank", 2L).containsEntry("total", 3);
        assertThat(pos.get(1)).containsEntry("key", "AMERICA_DO_SUL").containsEntry("rank", 1L).containsEntry("total", 1);
    }

    @Test
    void privateOrNotCalculatedItemsHaveNoPublicPosition() {
        CurrentUser owner = new CurrentUser(ana.getId(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        Map<String, Object> mine = query.positions(owner, HypeEntityType.PIECE, privateAna.getId());   // a dona vê a peça, mas ela não é pública
        assertThat(mine.get("eligible")).isEqualTo(false);
        assertThat(mine.get("positions")).asList().isEmpty();
        // terceiros nem enxergam a peça privada: 404, como no detalhe
        assertThatThrownBy(() -> query.positions(null, HypeEntityType.PIECE, privateAna.getId())).isInstanceOf(ApiException.class);
        // sem cálculo ainda
        WardrobeItem fresh = piece(cai, "upper_piece", "hoodie", 10, true);
        pieceRows.removeIf(c -> c.getEntityId().equals(fresh.getId()));
        assertThat(query.positions(null, HypeEntityType.PIECE, fresh.getId()).get("eligible")).isEqualTo(false);
    }
}
