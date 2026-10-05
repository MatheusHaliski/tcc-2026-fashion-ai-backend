package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.insights.InsightContext;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.WeekPlan;
import br.com.fashionai.domain.model.WeekPlanDay;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.WeekPlanStatus;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.WeekPlanDayRepository;
import br.com.fashionai.domain.repository.WeekPlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Autopiloto ligado ao objetivo: seis números por look (mesma régua do Copilot), modo que ordena e insights na resposta. */
@SuppressWarnings("unchecked")
class AutopilotScoresTest {
    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private WardrobeService wardrobe;
    private WardrobeItemRepository pieces;
    private SchemeRepository schemes;
    private SchemeItemRepository schemeItems;
    private WeekPlanRepository weekPlans;
    private WeekPlanDayRepository weekDays;
    private HypeQueryService hype;
    private InsightService insights;
    private AutopilotService autopilot;
    private final List<WardrobeItem> closet = new ArrayList<>();

    WardrobeItem piece(String name, String category, String subcategory, String style, int wears, int daysSinceWorn) {
        User u = new User();
        u.assignId(uid);
        u.setProfileType(ProfileType.PESSOAL);
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(u);
        w.setName(name);
        w.setCategory(category);
        w.setSubcategory(subcategory);
        w.setColor("black");
        w.setMaterial("COTTON");
        w.setStyleTags(style);
        w.setOccasionTags("casual");
        w.setWearCount(wears);
        w.setLastWornDate(LocalDate.now(FaiPointsService.ZONE).minusDays(daysSinceWorn));
        w.markCreatedAt(Instant.now().minusSeconds(200L * 86400));
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setDisponivel(true);
        return w;
    }

    @BeforeEach
    void setUp() {
        wardrobe = mock(WardrobeService.class);
        pieces = mock(WardrobeItemRepository.class);
        schemes = mock(SchemeRepository.class);
        schemeItems = mock(SchemeItemRepository.class);
        weekPlans = mock(WeekPlanRepository.class);
        weekDays = mock(WeekPlanDayRepository.class);
        UserPreferencesRepository preferences = mock(UserPreferencesRepository.class);
        PreferenceModel preferenceModel = mock(PreferenceModel.class);
        WeatherService weather = mock(WeatherService.class);
        AiEngine ai = mock(AiEngine.class);
        StyleDnaRepository dnas = mock(StyleDnaRepository.class);
        hype = mock(HypeQueryService.class);
        insights = mock(InsightService.class);
        autopilot = new AutopilotService(wardrobe, pieces, mock(SchemeService.class), schemes, schemeItems, mock(DailyLookService.class), weekPlans, weekDays,
                mock(UserRepository.class), preferences, preferenceModel, weather, ai, mock(Guard.class), dnas, hype, insights);

        closet.add(piece("Camiseta preta", "upper_piece", "t_shirt", "casual", 12, 2));
        closet.add(piece("Camisa listrada", "upper_piece", "shirt", "streetwear", 0, 120));
        closet.add(piece("Calça jeans", "lower_piece", "jeans", "casual", 9, 5));
        closet.add(piece("Calça cargo", "lower_piece", "cargo_pants", "streetwear", 1, 90));
        closet.add(piece("Tênis preto", "shoes_piece", "casual_sneakers", "casual", 15, 1));
        closet.add(piece("Bota", "shoes_piece", "ankle_boots", "streetwear", 0, 150));
        when(wardrobe.eligible(uid)).thenReturn(closet);
        when(pieces.countByUserId(uid)).thenReturn((long) closet.size());
        when(pieces.findByIdIn(anyCollection())).thenAnswer(inv -> closet.stream().filter(w -> ((java.util.Collection<UUID>) inv.getArgument(0)).contains(w.getId())).toList());
        when(weather.resolve(any(), any(), any())).thenReturn(WeatherService.Context.none(""));
        when(preferenceModel.of(uid)).thenReturn(new PreferenceModel.Model(Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), 0));
        when(preferences.findByUserId(any())).thenReturn(Optional.empty());
        when(ai.text(any())).thenReturn(new AiOutcome<>(null, null, AiCallResult.FALLBACK_LOCAL, true, "local", "local", 0, BigDecimal.ZERO, null, null, null));
        StyleDna dna = new StyleDna();
        dna.setStyleKeywords("casual");
        dna.setColorPalette("black");
        dna.setOccasionKeywords("casual");
        when(dnas.findByUserId(uid)).thenReturn(Optional.of(dna));
        when(schemes.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(List.of());
        Map<UUID, HypeScoreCurrent> h = new HashMap<>();
        for (WardrobeItem w : closet) {
            HypeScoreCurrent c = new HypeScoreCurrent();
            c.setEntityType(HypeEntityType.PIECE);
            c.setEntityId(w.getId());
            c.setStatus(HypeStatus.AVAILABLE);
            c.setScore(BigDecimal.valueOf("streetwear".equals(w.getStyleTags()) ? 90 : 30));
            c.setDimensions(new HypeDimensions());
            h.put(w.getId(), c);
        }
        when(hype.currentOf(eq(HypeEntityType.PIECE), anyCollection())).thenReturn(h);
        when(insights.itemsOrEmpty(me, InsightContext.AUTOPILOT)).thenReturn(List.of(Map.of("code", "IDLE_PIECES", "tone", "ATTENTION")));
    }

    static List<Map<String, Object>> suggestions(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("suggestions");
    }

    static RecommendationScoring.Scores scores(Map<String, Object> s) {
        Map<String, Object> m = (Map<String, Object>) s.get("scores");
        return new RecommendationScoring.Scores((Integer) m.get("compatibility"), (Integer) m.get("hype"), (Integer) m.get("novelty"),
                (Integer) m.get("reuse"), (Integer) m.get("usage"), (Integer) m.get("sustainability"));
    }

    @Test
    void everyDailyLookCarriesTheSixScoresAndTheResponseCarriesAutopilotInsights() {
        Map<String, Object> out = autopilot.daily(me, new AutopilotService.DailyRequest(List.of(), null, null, null, null, List.of()));

        assertThat(suggestions(out)).isNotEmpty().allSatisfy(s -> {
            assertThat((Map<String, Object>) s.get("scores")).containsOnlyKeys("compatibility", "hype", "novelty", "reuse", "usage", "sustainability");
            assertThat(scores(s).compatibility()).isNotNull();
            assertThat(scores(s).hype()).isNotNull();
            assertThat(s).containsKeys("key", "title", "pieceIds", "pieces", "criteria", "rationale", "mannequin");   // campos de antes intactos
        });
        assertThat(out).containsKeys("weather", "excludeKeys", "fallbackUsed", "explanation", "quota", "message");
        assertThat(out.get("mode")).isNull();
        assertThat((List<Map<String, Object>>) out.get("insights")).extracting(m -> m.get("code")).containsExactly("IDLE_PIECES");
    }

    @Test
    void modeOrdersTheAlternativesByItsWeights() {
        for (RecommendationScoring.Mode mode : RecommendationScoring.Mode.values()) {
            Map<String, Object> out = autopilot.daily(me, new AutopilotService.DailyRequest(List.of(), null, null, null, null, List.of(), mode.name().toLowerCase()));
            List<Map<String, Object>> list = suggestions(out);
            assertThat(out.get("mode")).isEqualTo(mode.name());
            assertThat(list).hasSizeGreaterThan(1);
            for (int i = 1; i < list.size(); i++) {
                assertThat(RecommendationScoring.rankValue(mode, scores(list.get(i - 1))))
                        .as(mode + " #" + i).isGreaterThanOrEqualTo(RecommendationScoring.rankValue(mode, scores(list.get(i))));
                assertThat(String.valueOf(list.get(i).get("title"))).startsWith("Look do Dia #" + (i + 1));
            }
            assertThat(String.valueOf(list.get(0).get("title"))).startsWith("Look do Dia #1");
        }
        // SAFE prioriza o DNA (casual/preto): o primeiro look no SEGURO é pelo menos tão compatível quanto o do EXPERIMENTAL
        Map<String, Object> safe = autopilot.daily(me, new AutopilotService.DailyRequest(List.of(), null, null, null, null, List.of(), "SEGURO"));
        assertThat(safe.get("mode")).isEqualTo("SAFE");
    }

    @Test
    void weekPlanDaysCarryScoresAndGapsDoNot() {
        WeekPlan plan = new WeekPlan();
        plan.assignId(UUID.randomUUID());
        plan.setWeekStart(LocalDate.now().with(java.time.DayOfWeek.MONDAY));
        plan.setStatus(WeekPlanStatus.ACTIVE);
        WeekPlanDay planned = new WeekPlanDay();
        planned.assignId(UUID.randomUUID());
        planned.setWeekPlan(plan);
        planned.setDayDate(plan.getWeekStart());
        planned.setPieceIdsJson(Json.write(List.of(closet.get(0).getId().toString(), closet.get(2).getId().toString(), closet.get(4).getId().toString())));
        WeekPlanDay gap = new WeekPlanDay();
        gap.assignId(UUID.randomUUID());
        gap.setWeekPlan(plan);
        gap.setDayDate(plan.getWeekStart().plusDays(1));
        gap.setPieceIdsJson("[]");
        when(weekPlans.findFirstByUserIdAndStatusOrderByWeekStartDesc(uid, WeekPlanStatus.ACTIVE)).thenReturn(Optional.of(plan));
        when(weekDays.findByWeekPlanIdOrderByDayDate(plan.getId())).thenReturn(List.of(planned, gap));

        Map<String, Object> week = autopilot.currentWeek(me);
        List<Map<String, Object>> days = (List<Map<String, Object>>) week.get("days");
        assertThat((Map<String, Object>) days.get(0).get("scores")).containsKeys("compatibility", "hype", "novelty", "reuse", "usage", "sustainability");
        // camiseta + jeans + tênis: casual e preto = 100% DNA; Hype 30 de média é contexto, não o motivo
        assertThat(((Map<String, Object>) days.get(0).get("scores")).get("compatibility")).isEqualTo(100);
        assertThat(((Map<String, Object>) days.get(0).get("scores")).get("hype")).isEqualTo(30);
        assertThat(days.get(1).get("scores")).isNull();
        assertThat(days.get(1).get("gap")).isEqualTo(true);
    }
}
