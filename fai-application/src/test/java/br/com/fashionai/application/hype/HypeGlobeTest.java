package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Explorador → Painel global com camadas de Hype (RF53 × RF26): agregado por país (país do dono), mínimo de itens para
 * acender, destaque que respeita a visibilidade de quem vê, filtros de categoria e nível mínimo, média do mês na janela de
 * 30 dias e itens sem país só no "mundo".
 */
class HypeGlobeTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private HypeScoreCurrentRepository current;
    private HypeScoreSnapshotRepository snapshots;
    private WardrobeItemRepository pieces;
    private SchemeRepository schemes;
    private SchemeItemRepository schemeItems;
    private Guard guard;
    private HypeQueryService query;

    private final List<WardrobeItem> catalog = new ArrayList<>();
    private final List<Scheme> looks = new ArrayList<>();
    private final List<SchemeItem> lookItems = new ArrayList<>();
    private final List<HypeScoreCurrent> pieceRows = new ArrayList<>();
    private final List<HypeScoreCurrent> lookRows = new ArrayList<>();
    private final List<HypeScoreSnapshot> month = new ArrayList<>();

    private final User ana = HypeRegionalRankingTest.user("ana", "BR");
    private final User bia = HypeRegionalRankingTest.user("bia", "BR");
    private final User caio = HypeRegionalRankingTest.user("caio", "BR");
    private final User dan = HypeRegionalRankingTest.user("dan", "FR");
    private final User eva = HypeRegionalRankingTest.user("eva", "FR");
    private final User semPais = HypeRegionalRankingTest.user("sem.pais", null);

    private WardrobeItem sneakerAna;
    private WardrobeItem teeAna;
    private WardrobeItem heelsBia;
    private WardrobeItem jeansCaio;

    HypeScoreCurrent row(HypeEntityType type, UUID id, User owner, double score, double trend, HypeMomentum momentum, boolean eligible, String categories) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(id);
        c.setOwnerId(owner.getId());
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(config.level(score));
        c.getDimensions().setTrend(BigDecimal.valueOf(trend));
        c.setMomentum(momentum);
        c.setPublicEligible(eligible);
        c.setCategory(type == HypeEntityType.PIECE ? categories : null);
        c.setCategories(categories);
        c.setCountry(owner.getCountry());
        c.setRegion(HypeRegionalRankingTest.regionOf(owner.getCountry()));
        c.setCalculatedAt(Instant.now());
        c.setWindowStart(Instant.now());
        c.setWindowEnd(Instant.now());
        return c;
    }

    WardrobeItem piece(User owner, String category, String color, double score, double trend, HypeMomentum momentum, boolean eligible) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setName(category + " de " + owner.getUsername());
        w.setCategory(category);
        w.setColor(color);
        w.setImageUrl("/assets_pecas/" + owner.getUsername() + ".png");
        w.setVisibility(eligible ? Visibility.PUBLIC : Visibility.PRIVATE);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        catalog.add(w);
        pieceRows.add(row(HypeEntityType.PIECE, w.getId(), owner, score, trend, momentum, eligible, category));
        return w;
    }

    void snapshot(WardrobeItem w, double score, int daysAgo) {
        HypeScoreSnapshot s = new HypeScoreSnapshot();
        s.setEntityType(HypeEntityType.PIECE);
        s.setEntityId(w.getId());
        s.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        s.setStatus(HypeStatus.AVAILABLE);
        s.setScore(BigDecimal.valueOf(score));
        s.setSnapshotDate(LocalDate.now(HypeSignalRecorder.ZONE).minusDays(daysAgo));
        month.add(s);
    }

    @BeforeEach
    void setUp() {
        current = mock(HypeScoreCurrentRepository.class);
        snapshots = mock(HypeScoreSnapshotRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        schemes = mock(SchemeRepository.class);
        schemeItems = mock(SchemeItemRepository.class);
        guard = mock(Guard.class);
        SchemeService schemeService = mock(SchemeService.class);
        WardrobeService wardrobe = mock(WardrobeService.class);
        // cache de verdade (em memória): a segunda leitura volta do JSON guardado, como no Redis
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
        query = new HypeQueryService(config, current, snapshots, pieces, schemes, schemeItems, null, guard, wardrobe, schemeService, new HypeCache(cache));

        // Brasil: 4 itens de 3 pessoas — 90 (viral), 70 (em alta), 50 (relevante), 30 (nicho)
        sneakerAna = piece(ana, "shoes_piece", "black", 90, 80, HypeMomentum.RISING, true);
        teeAna = piece(ana, "upper_piece", "white", 70, 40, HypeMomentum.STABLE, true);
        heelsBia = piece(bia, "shoes_piece", "black", 50, 85, HypeMomentum.EMERGING, true);
        jeansCaio = piece(caio, "lower_piece", "blue", 30, 20, HypeMomentum.COOLING, true);
        // França: só 2 itens (abaixo do mínimo para acender)
        piece(dan, "upper_piece", "white", 80, 50, HypeMomentum.STABLE, true);
        piece(eva, "shoes_piece", "white", 60, 50, HypeMomentum.STABLE, true);
        // sem país: entra no mundo, nunca no globo
        piece(semPais, "shoes_piece", "white", 95, 50, HypeMomentum.STABLE, true);
        // privada: nunca entra (a consulta já filtra; a linha prova a defesa extra do serviço)
        piece(ana, "shoes_piece", "white", 99, 99, HypeMomentum.RISING, false);

        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE)).thenReturn(pieceRows);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE)).thenReturn(lookRows);
        when(current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION)))
                .thenAnswer(a -> HypeRegionalRankingTest.byIds(a.getArgument(1), pieceRows, HypeScoreCurrent::getEntityId));
        when(current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.SCHEME), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION)))
                .thenAnswer(a -> HypeRegionalRankingTest.byIds(a.getArgument(1), lookRows, HypeScoreCurrent::getEntityId));
        when(pieces.findByIdIn(anyCollection())).thenAnswer(a -> HypeRegionalRankingTest.byIds(a.getArgument(0), catalog, WardrobeItem::getId));
        when(schemes.findByIdIn(anyCollection())).thenAnswer(a -> HypeRegionalRankingTest.byIds(a.getArgument(0), looks, Scheme::getId));
        when(schemeItems.findBySchemeIdIn(anyCollection())).thenAnswer(a -> lookItems.stream().filter(si -> ((Collection<?>) a.getArgument(0)).contains(si.getScheme().getId())).toList());
        when(snapshots.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(eq(HypeEntityType.PIECE), eq(HypeScoreConfig.DEFAULT_VERSION), any(), any())).thenReturn(month);
        when(guard.canView(any(), any(), eq(Visibility.PUBLIC))).thenReturn(true);
        when(guard.canView(any(), any(), eq(Visibility.PRIVATE))).thenReturn(false);
        when(schemeService.canView(any(), any())).thenReturn(true);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> countries(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("countries");
    }

    static Map<String, Object> country(Map<String, Object> out, String iso) {
        return countries(out).stream().filter(m -> iso.equals(m.get("country"))).findFirst().orElse(null);
    }

    static double num(Object v) {
        return ((Number) v).doubleValue();
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> map(Object v) {
        return (Map<String, Object>) v;
    }

    Map<String, Object> globe(int window, String category, String minLevel) {
        return query.globe(null, HypeEntityType.PIECE, window, category, null, minLevel);
    }

    @Test
    void aggregatesThePublicPopulationPerOwnerCountry() {
        Map<String, Object> out = globe(7, null, null);
        assertThat(out.get("type")).isEqualTo("PIECE");
        assertThat(out.get("window")).isEqualTo(7);
        assertThat(out.get("minItems")).isEqualTo(HypeQueryService.GLOBE_MIN_ITEMS);
        assertThat(countries(out)).extracting(m -> m.get("country")).containsExactly("BR", "FR");   // mais itens primeiro

        Map<String, Object> br = country(out, "BR");
        assertThat(br.get("region")).isEqualTo("AMERICA_DO_SUL");
        assertThat(String.valueOf(br.get("regionLabel"))).contains("worldRegions.america_do_sul");
        assertThat(num(br.get("count"))).isEqualTo(4);          // a privada de 99 da Ana não conta
        assertThat(num(br.get("creators"))).isEqualTo(3);       // Ana (2 peças), Bia e Caio
        assertThat(num(br.get("avgHype"))).isEqualTo(60.0);     // (90 + 70 + 50 + 30) / 4
        assertThat(num(br.get("maxHype"))).isEqualTo(90.0);
        assertThat(br.get("avgLevel")).isEqualTo("HOT");
        assertThat(br.get("maxLevel")).isEqualTo("VIRAL");
        assertThat(num(br.get("trend"))).isEqualTo(56.3);       // média da dimensão TREND (80, 40, 85, 20): crescimento, não volume
        assertThat(num(br.get("rising"))).isEqualTo(2);         // RISING + EMERGING
        assertThat(map(br.get("levels"))).containsOnlyKeys("LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL");
        assertThat(map(br.get("levels"))).extractingByKeys("LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL").containsExactly(0, 1, 1, 1, 0, 1);
        assertThat(br.get("topLevel")).isEqualTo("VIRAL");
        assertThat(br.get("dominantColorHex")).isEqualTo("#12100F");   // preto: 2 das 4 peças
        assertThat(br.get("topCategory")).isEqualTo("shoes_piece");
        assertThat(br).doesNotContainKey("candidates");

        Map<String, Object> top = map(br.get("top"));
        assertThat(top.get("id")).isEqualTo(sneakerAna.getId().toString());
        assertThat(top.get("type")).isEqualTo("PIECE");
        assertThat(top.get("name")).isEqualTo(sneakerAna.getName());
        assertThat(top.get("imageUrl")).isEqualTo("/assets_pecas/ana.png");
        assertThat(top.get("category")).isEqualTo("shoes_piece");
        assertThat(map(top.get("owner")).get("username")).isEqualTo("ana");
        assertThat(map(top.get("hype")).get("score")).isEqualTo(90.0);
        assertThat(map(top.get("hype")).get("level")).isEqualTo("VIRAL");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> regions = (List<Map<String, Object>>) out.get("regions");
        assertThat(regions).extracting(m -> m.get("key")).containsExactly("AMERICA_DO_SUL", "EUROPA");
        assertThat(num(regions.get(1).get("avgHype"))).isEqualTo(70.0);
    }

    @Test
    void countriesBelowTheMinimumAreNotSufficient() {
        Map<String, Object> out = globe(7, null, null);
        assertThat(country(out, "BR").get("sufficient")).isEqualTo(true);
        Map<String, Object> fr = country(out, "FR");
        assertThat(fr.get("sufficient")).isEqualTo(false);
        assertThat(num(fr.get("count"))).isEqualTo(2);
        assertThat(num(fr.get("creators"))).isEqualTo(2);
    }

    @Test
    void itemsWithoutCountryCountOnlyInTheWorld() {
        Map<String, Object> out = globe(7, null, null);
        Map<String, Object> world = map(out.get("world"));
        assertThat(num(world.get("count"))).isEqualTo(7);       // 4 BR + 2 FR + 1 sem país
        assertThat(num(world.get("maxHype"))).isEqualTo(95.0);  // o 95 sem país está no mundo...
        assertThat(num(world.get("avgHype"))).isEqualTo(67.9);  // 475 / 7
        assertThat(num(world.get("creators"))).isEqualTo(6);
        // ...mas nunca no globo (nem como país, nem como "Outras regiões")
        assertThat(countries(out)).extracting(m -> m.get("country")).doesNotContainNull().containsExactly("BR", "FR");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> regions = (List<Map<String, Object>>) out.get("regions");
        assertThat(regions).extracting(m -> m.get("key")).doesNotContain("OUTRAS");
        assertThat(countries(out).stream().mapToDouble(m -> num(m.get("maxHype"))).max().orElse(0)).isEqualTo(90.0);
    }

    @Test
    void theTopRespectsWhoIsLookingAndFallsToTheNextVisibleItem() {
        CurrentUser viewer = new CurrentUser(UUID.randomUUID(), "leitor", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        when(guard.canView(eq(viewer), eq(ana.getId()), any())).thenReturn(false);   // bloqueio entre as contas
        // anônimo primeiro: o agregado vai para o cache e o top é a peça da Ana
        assertThat(map(country(globe(7, null, null), "BR").get("top")).get("id")).isEqualTo(sneakerAna.getId().toString());

        Map<String, Object> blocked = query.globe(viewer, HypeEntityType.PIECE, 7, null, null, null);
        Map<String, Object> br = country(blocked, "BR");
        // as duas peças da Ana (90 e 70) somem do destaque; vale a próxima: o salto da Bia (50)
        assertThat(map(br.get("top")).get("id")).isEqualTo(heelsBia.getId().toString());
        // bloqueio não se aplica a agregados: as contagens não mudam
        assertThat(num(br.get("count"))).isEqualTo(4);
        assertThat(num(br.get("maxHype"))).isEqualTo(90.0);
        // o agregado saiu do cache (uma leitura da população só)
        verify(current, times(1)).findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE);
    }

    @Test
    void anItemThatStoppedBeingPublicAfterTheCacheIsNotTheTop() {
        globe(7, null, null);
        pieceRows.stream().filter(c -> c.getEntityId().equals(sneakerAna.getId())).forEach(c -> c.setPublicEligible(false));
        assertThat(map(country(globe(7, null, null), "BR").get("top")).get("id")).isEqualTo(teeAna.getId().toString());
    }

    @Test
    void filtersByCategoryAndMinimumLevel() {
        Map<String, Object> shoes = globe(7, "SHOES_PIECE", null);
        assertThat(map(shoes.get("filters"))).containsEntry("category", "shoes_piece").containsEntry("minLevel", null);
        assertThat(num(country(shoes, "BR").get("count"))).isEqualTo(2);     // tênis da Ana e salto da Bia
        assertThat(num(country(shoes, "BR").get("avgHype"))).isEqualTo(70.0);
        assertThat(num(map(shoes.get("world")).get("count"))).isEqualTo(4);  // + o da Eva (FR) e o sem país

        Map<String, Object> hot = globe(7, null, "hot");
        assertThat(map(hot.get("filters"))).containsEntry("minLevel", "HOT");
        Map<String, Object> br = country(hot, "BR");
        assertThat(num(br.get("count"))).isEqualTo(2);                       // 90 (viral) e 70 (em alta); 50 e 30 ficam fora
        assertThat(map(br.get("levels"))).extractingByKeys("NICHE", "RELEVANT", "HOT", "VIRAL").containsExactly(0, 0, 1, 1);
        assertThat(br.get("sufficient")).isEqualTo(false);
        assertThat(num(map(hot.get("world")).get("count"))).isEqualTo(5);

        assertThatThrownBy(() -> globe(7, null, "SUPER")).isInstanceOf(ApiException.class);
    }

    @Test
    void windowOfThirtyDaysUsesTheMonthAverage() {
        snapshot(sneakerAna, 30, 3);
        snapshot(sneakerAna, 50, 10);    // média do mês do tênis: 40
        snapshot(heelsBia, 90, 1);       // média do mês do salto: 90
        // camiseta (70) e jeans (30) sem snapshot no mês: valem o score atual
        Map<String, Object> out = globe(30, null, null);
        assertThat(out.get("window")).isEqualTo(30);
        Map<String, Object> br = country(out, "BR");
        assertThat(num(br.get("avgHype"))).isEqualTo(57.5);     // (40 + 70 + 90 + 30) / 4
        assertThat(num(br.get("maxHype"))).isEqualTo(90.0);
        assertThat(br.get("avgLevel")).isEqualTo("RELEVANT");
        assertThat(map(br.get("top")).get("id")).isEqualTo(heelsBia.getId().toString());   // o destaque segue a média do mês

        // hoje: o trend ordena o destaque (85 do salto > 80 do tênis), o Hype exibido continua o score atual
        Map<String, Object> today = country(globe(1, null, null), "BR");
        assertThat(map(today.get("top")).get("id")).isEqualTo(heelsBia.getId().toString());
        assertThat(num(today.get("avgHype"))).isEqualTo(60.0);
        // 7 dias: o HypeScore atual
        assertThat(map(country(globe(7, null, null), "BR").get("top")).get("id")).isEqualTo(sneakerAna.getId().toString());
        assertThat(jeansCaio).isNotNull();
    }

    @Test
    void looksUseTheColorsOfTheirPiecesAndTheirTitle() {
        Scheme look = new Scheme();
        look.assignId(UUID.randomUUID());
        look.setUser(dan);
        look.setTitle("Look de inverno");
        looks.add(look);
        int order = 0;
        for (WardrobeItem w : List.of(jeansCaio, teeAna)) {
            SchemeItem si = new SchemeItem();
            si.assignId(UUID.randomUUID());
            si.setScheme(look);
            si.setWardrobeItem(w);
            si.setSortOrder(order++);
            lookItems.add(si);
        }
        lookRows.add(row(HypeEntityType.SCHEME, look.getId(), dan, 77, 60, HypeMomentum.RISING, true, "lower_piece,upper_piece"));
        Map<String, Object> out = query.globe(null, HypeEntityType.SCHEME, 7, null, null, null);
        assertThat(out.get("type")).isEqualTo("SCHEME");
        Map<String, Object> fr = country(out, "FR");
        assertThat(num(fr.get("count"))).isEqualTo(1);
        assertThat(fr.get("dominantColorHex")).isIn("#2A5FA8", "#FFFFFF");
        Map<String, Object> top = map(fr.get("top"));
        assertThat(top.get("name")).isEqualTo("Look de inverno");
        assertThat(top.get("type")).isEqualTo("SCHEME");
        assertThat(top.get("imageUrl")).isEqualTo("/assets_pecas/caio.png");   // sem capa: a primeira peça do look
        assertThat(top.get("category")).isEqualTo("lower_piece");
    }
}
