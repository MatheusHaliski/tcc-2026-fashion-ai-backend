package br.com.fashionai.application.insights;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeCache;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ExplorerService;
import br.com.fashionai.application.service.LookbookService;
import br.com.fashionai.application.service.RoomService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Insights dinâmicos (RF53): fundamentados nos dados, privacidade nos públicos, regras do produto nos pessoais. */
@SuppressWarnings("unchecked")
class InsightServiceTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private HypeQueryService hype;
    private HypeScoreCurrentRepository current;
    private RenderCachePort cachePort;
    private WardrobeItemRepository pieces;
    private SchemeRepository schemes;
    private SchemeItemRepository schemeItems;
    private StyleDnaRepository dnas;
    private UserPreferencesRepository preferences;
    private LookbookService lookbook;
    private ExplorerService explorer;
    private WardrobeService wardrobe;
    private AiEngine ai;
    private InsightService service;

    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private final LocalDate today = LocalDate.now(RoomService.ZONE);

    @BeforeEach
    void setUp() {
        hype = mock(HypeQueryService.class);
        when(hype.config()).thenReturn(config);
        current = mock(HypeScoreCurrentRepository.class);
        cachePort = mock(RenderCachePort.class);
        when(cachePort.get(any())).thenReturn(Optional.empty());
        pieces = mock(WardrobeItemRepository.class);
        schemes = mock(SchemeRepository.class);
        schemeItems = mock(SchemeItemRepository.class);
        dnas = mock(StyleDnaRepository.class);
        preferences = mock(UserPreferencesRepository.class);
        lookbook = mock(LookbookService.class);
        explorer = mock(ExplorerService.class);
        wardrobe = mock(WardrobeService.class);
        ai = mock(AiEngine.class);
        service = new InsightService(hype, current, new HypeCache(cachePort), pieces, schemes, schemeItems, dnas, preferences, lookbook, explorer, wardrobe, ai);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(any(), eq(HypeScoreConfig.DEFAULT_VERSION), eq(HypeStatus.AVAILABLE))).thenReturn(List.of());
        when(preferences.findByUserId(any())).thenReturn(Optional.empty());
        when(dnas.findByUserId(any())).thenReturn(Optional.empty());
    }

    // ================================================================== fixtures
    static HypeScoreCurrent row(HypeEntityType type, String category, String region, double score, double popularity, double trend,
                                double cur, double prev, boolean eligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(UUID.randomUUID());
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        HypeDimensions d = new HypeDimensions();
        d.setPopularity(BigDecimal.valueOf(popularity));
        d.setTrend(BigDecimal.valueOf(trend));
        d.setTrendVelocity(BigDecimal.valueOf(50));
        c.setDimensions(d);
        c.setPublicEligible(eligible);
        c.setCategory(category);
        c.setRegion(region);
        c.setSignalsJson(Json.write(Map.of("windowCurrent", cur, "windowPrevious", prev)));
        c.setCalculatedAt(Instant.now());
        c.setWindowStart(Instant.now());
        c.setWindowEnd(Instant.now());
        return c;
    }

    WardrobeItem piece(String name, String category, String subcategory, int wears, Integer daysSinceWorn) {
        User u = new User();
        u.assignId(uid);
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(u);
        w.setName(name);
        w.setCategory(category);
        w.setSubcategory(subcategory);
        w.setColor("black");
        w.setStyleTags("casual");
        w.setOccasionTags("casual,work");
        w.setWearCount(wears);
        w.setLastWornDate(daysSinceWorn == null ? null : today.minusDays(daysSinceWorn));
        w.markCreatedAt(Instant.now().minusSeconds(400L * 86400));
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.setDisponivel(true);
        return w;
    }

    static HypeScoreCurrent own(WardrobeItem w, double score, double trend, String direction, Double delta) {
        HypeScoreCurrent c = row(HypeEntityType.PIECE, w.getCategory(), null, score, 40, trend, 2, 2, false);
        c.setEntityId(w.getId());
        c.setDirection(direction);
        c.setDeltaPoints(delta == null ? null : BigDecimal.valueOf(delta));
        return c;
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> items(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("items");
    }

    static List<String> codes(Map<String, Object> out) {
        return items(out).stream().map(m -> String.valueOf(m.get("code"))).toList();
    }

    static Map<String, Object> item(Map<String, Object> out, String code) {
        return items(out).stream().filter(m -> code.equals(m.get("code"))).findFirst().orElseThrow(() -> new AssertionError("sem " + code + " em " + codes(out)));
    }

    @SuppressWarnings("unchecked")
    static List<String> basis(Map<String, Object> item) {
        return (List<String>) item.get("basis");
    }

    // ================================================================== públicos
    @Test
    void trendingFindsTheFastestGrowingCategoryAndKeepsTrendApartFromPopularity() {
        List<HypeScoreCurrent> rows = List.of(
                row(HypeEntityType.PIECE, "shoes_piece", "AMERICA_DO_SUL", 60, 30, 80, 12, 3, true),
                row(HypeEntityType.PIECE, "shoes_piece", "AMERICA_DO_SUL", 58, 30, 80, 12, 3, true),
                row(HypeEntityType.PIECE, "upper_piece", "EUROPA", 85, 90, 45, 5, 5, true),
                row(HypeEntityType.PIECE, "upper_piece", "EUROPA", 82, 90, 45, 5, 5, true));
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE)).thenReturn(rows);

        Map<String, Object> out = service.insights(null, "EXPLORER_TRENDING", 7, null, null, null, false);

        assertThat(out).containsEntry("context", "EXPLORER_TRENDING").containsEntry("algorithmVersion", HypeScoreConfig.DEFAULT_VERSION).containsEntry("source", "local");
        assertThat(items(out)).hasSizeBetween(2, 5);
        // (24 + 3) ÷ (6 + 3) − 1 = +200% em 7 dias, a mesma suavização do HypeCalculator
        Map<String, Object> rising = item(out, "CATEGORY_RISING");
        assertThat(String.valueOf(rising.get("text"))).contains("Calçados").contains("200%").contains("7 dias");
        assertThat((Map<String, Object>) rising.get("metric")).containsEntry("value", 200L).containsEntry("unit", "%");
        assertThat(basis(rising)).contains("HYPE_V2", "PUBLIC_RANKING");
        // popular (parte superior) ≠ crescendo (calçados)
        assertThat(String.valueOf(item(out, "TREND_VS_POPULARITY").get("text"))).contains("Parte superior").contains("Calçados");
        assertThat(codes(out)).contains("POPULAR_NOT_GROWING", "SMALL_BUT_GROWING");
        items(out).forEach(m -> assertThat(String.valueOf(m.get("text"))).doesNotContainIgnoringCase("é boa").doesNotContainIgnoringCase("melhor peça"));
    }

    @Test
    void publicContextsNeverUsePrivateOrNonEligibleRowsNorPersonalData() {
        HypeScoreCurrent pub1 = row(HypeEntityType.PIECE, "shoes_piece", "AMERICA_DO_SUL", 60, 30, 80, 12, 3, true);
        HypeScoreCurrent pub2 = row(HypeEntityType.PIECE, "shoes_piece", "AMERICA_DO_SUL", 61, 30, 80, 12, 3, true);
        // linha privada que vazou do repositório: crescimento enorme, mas NUNCA pode aparecer
        HypeScoreCurrent priv1 = row(HypeEntityType.PIECE, "accessory_piece", "EUROPA", 99, 10, 99, 500, 0, false);
        HypeScoreCurrent priv2 = row(HypeEntityType.PIECE, "accessory_piece", "EUROPA", 99, 10, 99, 500, 0, false);
        HypeScoreCurrent insufficient = row(HypeEntityType.PIECE, "accessory_piece", "EUROPA", 99, 10, 99, 500, 0, true);
        insufficient.setStatus(HypeStatus.INSUFFICIENT_DATA);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE))
                .thenReturn(List.of(pub1, pub2, priv1, priv2, insufficient));

        for (String ctx : List.of("EXPLORER_TRENDING", "EXPLORER_RANKING", "EXPLORER_RUNWAY")) {
            Map<String, Object> out = service.insights(null, ctx, 7, null, null, null, false);
            items(out).forEach(m -> {
                assertThat(String.valueOf(m.get("text"))).as(ctx).doesNotContain("Acessórios").doesNotContain("Europa");
                assertThat(String.valueOf(m.get("action"))).as(ctx).doesNotContain("accessory_piece");
            });
        }
        Map<String, Object> ranking = service.insights(null, "EXPLORER_RANKING", 7, null, null, null, false);
        assertThat(String.valueOf(item(ranking, "RANKING_BASE").get("text"))).startsWith("2 itens públicos");
        verify(current, never()).findByEntityTypeAndAlgorithmVersion(any(), any());
        verify(current, never()).findByOwnerIdAndEntityTypeAndAlgorithmVersion(any(), any(), any());
        verifyNoInteractions(pieces, schemes, dnas, lookbook, wardrobe, ai);
    }

    @Test
    void rankingNamesTheLeadingRegionAndItsTopCategory() {
        List<HypeScoreCurrent> rows = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            rows.add(row(HypeEntityType.PIECE, "shoes_piece", "AMERICA_DO_SUL", 80, 50, 50, 4, 4, true));
            rows.add(row(HypeEntityType.PIECE, "upper_piece", "EUROPA", 60, 50, 50, 4, 4, true));
        }
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE)).thenReturn(rows);

        Map<String, Object> out = service.insights(null, "EXPLORER_RANKING", 7, null, null, null, false);

        Map<String, Object> leader = item(out, "REGION_LEADER");
        assertThat(String.valueOf(leader.get("text"))).contains("América do Sul").contains("80").contains("3 itens");
        assertThat(String.valueOf(((Map<?, ?>) leader.get("action")).get("href"))).isEqualTo("/explorer?tab=ranking&region=AMERICA_DO_SUL");
        assertThat(String.valueOf(item(out, "REGION_TOP_CATEGORY").get("text"))).contains("América do Sul").contains("Calçados");
        assertThat(String.valueOf(item(out, "RANKING_BASE").get("text"))).contains("6 itens públicos").contains("2 regiões");
    }

    @Test
    void publicContextsAreCachedByHypeGeneration() {
        service.insights(null, "EXPLORER_TRENDING", 30, "america_do_sul", "Shoes_Piece", null, false);
        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(cachePort, atLeastOnce()).put(key.capture(), anyString(), any());
        assertThat(key.getAllValues()).anyMatch(k -> k.startsWith("hype:g0:insights:EXPLORER_TRENDING:30:AMERICA_DO_SUL:shoes_piece:"));
    }

    @Test
    void unknownContextOrRegionIsABadRequest() {
        assertThatThrownBy(() -> service.insights(null, "NOPE", 7, null, null, null, false))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(400));
        assertThatThrownBy(() -> service.insights(null, "EXPLORER_RANKING", 7, "MARTE", null, null, false))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(400));
    }

    @Test
    void anonymousWithAiStillGetsTheLocalTextWithoutCallingTheAi() {
        Map<String, Object> out = service.insights(null, "EXPLORER_BRANDS", 7, null, null, null, true);
        assertThat(out).containsEntry("source", "local");
        verifyNoInteractions(ai);
    }

    // ================================================================== pessoais
    @Test
    void personalContextsRejectAnonymous() {
        for (InsightContext ctx : EnumSet.allOf(InsightContext.class)) {
            if (ctx.isPublic()) {
                continue;
            }
            assertThatThrownBy(() -> service.insights(null, ctx.name(), null, null, null, null, false)).as(ctx.name())
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(401));
        }
        assertThat(service.itemsOrEmpty(null, InsightContext.COPILOT)).isEmpty();
        verifyNoInteractions(pieces, dnas, lookbook);
    }

    @Test
    void rediscoveryFollowsTheSixtyDayRule() {
        WardrobeItem recent = piece("Jaqueta jeans", "upper_piece", "jacket", 4, RoomService.FORGOTTEN_DAYS - 1);
        WardrobeItem idle = piece("Blazer xadrez", "upper_piece", "blazer", 2, RoomService.FORGOTTEN_DAYS + 1);
        when(pieces.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(List.of(recent, idle));
        when(hype.currentOf(eq(HypeEntityType.PIECE), anyCollection())).thenReturn(Map.of(recent.getId(), own(recent, 50, 50, "STABLE", 0.0),
                idle.getId(), own(idle, 45, 50, "STABLE", 0.0)));
        // o painel do Hype manda as duas como "redescoberta"; só a parada há 60+ dias pode virar insight
        List<Map<String, Object>> recs = List.of(
                new LinkedHashMap<>(Map.of("id", recent.getId().toString(), "idleDays", 59L, "similarGrowthPercent", 40L, "trend", 50L)),
                new LinkedHashMap<>(Map.of("id", idle.getId().toString(), "idleDays", 61L, "similarGrowthPercent", 31L, "trend", 50L)));
        when(hype.wardrobe(me)).thenReturn(Map.of("rediscoveries", recs));

        Map<String, Object> out = service.insights(me, "COPILOT", null, null, null, null, false);

        Map<String, Object> rediscovery = item(out, "IDLE_REDISCOVERY");
        assertThat(String.valueOf(rediscovery.get("text"))).contains("Blazer xadrez").contains("61 dias").contains("31%").doesNotContain("Jaqueta");
        assertThat((Map<String, Object>) rediscovery.get("metric")).containsEntry("value", 61L).containsEntry("unit", "dias");
        assertThat(basis(rediscovery)).contains("HYPE_V2", "WARDROBE_USAGE");

        // sem a peça parada, nada de redescoberta (a de 59 dias nunca é "esquecida")
        when(pieces.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(List.of(recent));
        assertThat(codes(service.insights(me, "COPILOT", null, null, null, null, false))).doesNotContain("IDLE_REDISCOVERY", "IDLE_PIECES");
    }

    @Test
    void hypeNeverAppearsWithoutCompatibilityOrUsageInPersonalContexts() {
        richPersonalData();
        for (InsightContext ctx : EnumSet.allOf(InsightContext.class)) {
            if (ctx.isPublic()) {
                continue;
            }
            Map<String, Object> out = service.insights(me, ctx.name(), null, null, null, null, false);
            assertThat(items(out)).as(ctx.name()).isNotEmpty().hasSizeLessThanOrEqualTo(5);
            for (Map<String, Object> m : items(out)) {
                List<String> b = basis(m);
                if (b.contains("HYPE_V2") || String.valueOf(m.get("text")).contains("Hype ")) {
                    assertThat(b).as(ctx + " " + m.get("code")).containsAnyOf("STYLE_DNA", "WARDROBE_USAGE");
                }
                assertThat(m.get("title")).as(ctx + " " + m.get("code")).isNotNull().asString().doesNotStartWith("insights.");
                assertThat(String.valueOf(m.get("text"))).as(ctx + " " + m.get("code")).doesNotStartWith("insights.").doesNotContain("{");
            }
        }
    }

    @Test
    void capsuleShowsVersatilityAndReuseBeforeAnyPurchase() {
        richPersonalData();
        Map<String, Object> out = service.insights(me, "CAPSULE", null, null, null, null, false);
        List<String> codes = codes(out);
        assertThat(String.valueOf(item(out, "CAPSULE_VERSATILITY").get("text"))).contains("3 peças-base").contains("6 looks").contains("2");
        assertThat(codes).contains("CAPSULE_BASE_PIECE", "CAPSULE_IDLE_REDISCOVERY");
        int gap = codes.indexOf("CAPSULE_GAP_COMBOS");
        if (gap >= 0) {
            assertThat(gap).isEqualTo(codes.size() - 1);   // compra só depois do reuso
            assertThat(String.valueOf(items(out).get(gap).get("text"))).contains("sem marca");
        }
        // peça-base: uso (looks), Hype e DNA lado a lado
        Map<String, Object> base = item(out, "CAPSULE_BASE_PIECE");
        assertThat(basis(base)).contains("CAPSULE", "WARDROBE_USAGE", "HYPE_V2", "STYLE_DNA");
        assertThat(String.valueOf(base.get("text"))).contains("Calça preta").contains("4 dos seus 6 looks").contains("Hype 70").contains("% de compatibilidade");
    }

    @Test
    void textIsDeterministicForTheSameData() {
        richPersonalData();
        for (String ctx : List.of("CAPSULE", "COPILOT", "AUTOPILOT", "HISTORY", "CLOSET", "LOOKS")) {
            assertThat(items(service.insights(me, ctx, null, null, null, null, false)))
                    .as(ctx).isEqualTo(items(service.insights(me, ctx, null, null, null, null, false)));
        }
    }

    @Test
    void aiRewriteMustKeepExactlyTheSameNumbers() {
        assertThat(InsightService.sameNumbers("Calçados cresceram 23% em 7 dias.", "Em 7 dias, os calçados subiram 23%.")).isTrue();
        assertThat(InsightService.sameNumbers("Calçados cresceram 23% em 7 dias.", "Calçados cresceram 25% em 7 dias.")).isFalse();
        assertThat(InsightService.sameNumbers("Fator 2,5.", "Fator 2.5.")).isTrue();
        assertThat(InsightService.parseTexts("```json\n{\"texts\":[\"a\",\"b\"]}\n```", 2)).containsExactly("a", "b");
        assertThat(InsightService.parseTexts("{\"texts\":[\"a\"]}", 2)).isNull();
    }

    @Test
    void purchaseSuggestionAlwaysGoesLastAndNeverAlone() {
        Insight reuse = new Insight("IDLE_PIECES", Insight.Tone.ATTENTION, "t", "x", null, null, List.of("WARDROBE_USAGE"), 0.75);
        Insight gap = new Insight("GAP_COMBOS", Insight.Tone.NEUTRAL, "t", "x", null, null, List.of("INVENTORY_COMBOS"), 0);
        List<Insight> many = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            many.add(new Insight("X" + i, Insight.Tone.NEUTRAL, "t", "x", null, null, List.of("WARDROBE_USAGE"), i / 10.0));
        }
        many.add(0, gap);
        List<Insight> out = InsightService.finish(many);
        assertThat(out).hasSize(5);
        assertThat(out.get(4).code()).isEqualTo("GAP_COMBOS");
        assertThat(out.get(0).code()).isEqualTo("X6");
        assertThat(InsightService.finish(List.of(gap))).isEmpty();
        assertThat(InsightService.finish(List.of(gap, reuse))).extracting(Insight::code).containsExactly("IDLE_PIECES", "GAP_COMBOS");
    }

    /** Guarda-roupa com DNA, Hype, uso, cápsula, looks e painel do Hype (movers/redescobertas). */
    private void richPersonalData() {
        WardrobeItem pants = piece("Calça preta", "lower_piece", "jeans", 9, 3);
        WardrobeItem tee = piece("Camiseta branca", "upper_piece", "t_shirt", 1, 10);
        tee.setPrice(BigDecimal.valueOf(80));
        WardrobeItem sneakers = piece("Tênis branco", "shoes_piece", "casual_sneakers", 5, 20);
        WardrobeItem blazer = piece("Blazer xadrez", "upper_piece", "blazer", 2, 90);
        List<WardrobeItem> all = List.of(pants, tee, sneakers, blazer);
        when(pieces.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(all);
        when(wardrobe.eligible(uid)).thenReturn(all);
        when(hype.currentOf(eq(HypeEntityType.PIECE), anyCollection())).thenReturn(Map.of(
                pants.getId(), own(pants, 70, 65, "UP", 6.5),
                tee.getId(), own(tee, 35, 40, "DOWN", -4.0),
                sneakers.getId(), own(sneakers, 55, 50, "STABLE", 0.5),
                blazer.getId(), own(blazer, 45, 72, "STABLE", 1.0)));
        StyleDna dna = new StyleDna();
        dna.setStyleKeywords("casual");
        dna.setColorPalette("black");
        dna.setOccasionKeywords("casual");
        when(dnas.findByUserId(uid)).thenReturn(Optional.of(dna));
        Map<String, Object> rec = Map.of("id", blazer.getId().toString(), "idleDays", 90L, "similarGrowthPercent", 31L, "trend", 72L);
        when(hype.wardrobe(me)).thenReturn(Map.of("rediscoveries", List.of(rec)));
        Map<String, Object> capsule = new LinkedHashMap<>();
        capsule.put("basePieces", 3);
        capsule.put("looks", 6);
        capsule.put("factor", 2.0);
        capsule.put("cards", List.of(Map.of("piece", Map.of("id", pants.getId().toString()), "looks", 4),
                Map.of("piece", Map.of("id", tee.getId().toString()), "looks", 3),
                Map.of("piece", Map.of("id", sneakers.getId().toString()), "looks", 2)));
        when(lookbook.capsule(me, null)).thenReturn(capsule);

        Scheme look = new Scheme();
        look.assignId(UUID.randomUUID());
        look.setTitle("Sexta casual");
        look.setLookDoDiaCount(3);
        look.setRemixCount(2);
        look.setStatus(SchemeStatus.PUBLISHED);
        Scheme unworn = new Scheme();
        unworn.assignId(UUID.randomUUID());
        unworn.setTitle("Jantar");
        unworn.setStatus(SchemeStatus.PUBLISHED);
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(uid, SchemeStatus.ARCHIVED)).thenReturn(List.of(look, unworn));
        HypeScoreCurrent lookHype = row(HypeEntityType.SCHEME, null, null, 66, 40, 78, 6, 2, false);
        lookHype.setEntityId(look.getId());
        lookHype.setMomentum(HypeMomentum.EMERGING);
        when(hype.currentOf(eq(HypeEntityType.SCHEME), anyCollection())).thenReturn(Map.of(look.getId(), lookHype));
        when(schemeItems.findBySchemeIdOrderBySortOrder(any())).thenReturn(List.of());
        when(hype.movers(eq(me), anyInt())).thenReturn(Map.of(
                "risers", List.of(Map.of("type", "PIECE", "id", pants.getId().toString(), "value", 6.5)),
                "fallers", List.of(Map.of("type", "PIECE", "id", tee.getId().toString(), "value", -4.0)),
                "rediscoveries", List.of(rec),
                "emergingLooks", List.of(Map.of("type", "SCHEME", "id", look.getId().toString(), "value", 78.0))));
        when(hype.trendingGroups(isNull(), any(), anyInt(), any(), any(), any(), anyInt())).thenReturn(Map.of("items", List.of()));
    }
}
