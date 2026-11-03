package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.StyleArchetype;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Cenário fixo do retrato do Copilot (R86): um acervo de seis peças com ids estáveis, dois looks salvos, um look público
 * de outra pessoa, HypeScore v2 por peça e por look, um Momento ativo e respostas fixas dos serviços vizinhos (mocks).
 */
class CopilotRetratoFixture {
    final UUID uid = id("ana");
    final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    final User owner = user(uid);
    final User other = user(id("bia"));
    final List<WardrobeItem> closet = new ArrayList<>();
    final List<Scheme> looks = new ArrayList<>();
    final Map<UUID, List<SchemeItem>> items = new HashMap<>();
    final Map<UUID, HypeScoreCurrent> hypeRows = new HashMap<>();

    final WardrobeService wardrobe = mock(WardrobeService.class);
    final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    final SchemeRepository schemes = mock(SchemeRepository.class);
    final SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
    final DailyLookRepository dailyLooks = mock(DailyLookRepository.class);
    final StyleDnaRepository dnas = mock(StyleDnaRepository.class);
    final UserPreferencesRepository preferences = mock(UserPreferencesRepository.class);
    final RoomService room = mock(RoomService.class);
    final MirrorService mirror = mock(MirrorService.class);
    final InventoryScoreService inventory = mock(InventoryScoreService.class);
    final ChallengeService challenges = mock(ChallengeService.class);
    final AutopilotService autopilot = mock(AutopilotService.class);
    final DailyLookService dailyLookService = mock(DailyLookService.class);
    final WeatherService weather = mock(WeatherService.class);
    final AiEngine ai = mock(AiEngine.class);
    final Audit audit = mock(Audit.class);
    final SchemeService schemeService = mock(SchemeService.class);
    final BackgroundStudioService studio = mock(BackgroundStudioService.class);
    final HypeQueryService hype = mock(HypeQueryService.class);
    final InsightService insights = mock(InsightService.class);
    final MomentService moments = mock(MomentService.class);
    final CopilotService svc;

    static UUID id(String name) {
        return UUID.nameUUIDFromBytes(name.getBytes());
    }

    static User user(UUID id) {
        User u = new User();
        u.assignId(id);
        u.setProfileType(ProfileType.PESSOAL);
        return u;
    }

    WardrobeItem piece(String name, String category, String sub, String color, String material, int idleDays, double hypeScore,
                       Double rarity, Double trend) {
        WardrobeItem w = CopilotAnswerTest.piece(owner, name, category, sub, 3);
        w.assignId(id(name));
        w.setColor(color);
        w.setMaterial(material);
        w.setStyleTags(closet.size() % 2 == 0 ? "casual,streetwear" : "classic");
        w.setLastWornDate(LocalDate.now(FaiPointsService.ZONE).minusDays(idleDays));
        closet.add(w);
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(w.getId());
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(hypeScore));
        c.getDimensions().setRarity(rarity == null ? null : BigDecimal.valueOf(rarity));
        c.getDimensions().setTrend(trend == null ? null : BigDecimal.valueOf(trend));
        c.setDeltaPoints(BigDecimal.valueOf(trend == null ? -1 : 2));
        c.setSignalsJson("{\"similarGrowthPercent\": 20}");
        hypeRows.put(w.getId(), c);
        return w;
    }

    Scheme look(String title, User by, WardrobeItem... parts) {
        Scheme s = new Scheme();
        s.assignId(id(title));
        s.setUser(by);
        s.setTitle(title);
        s.setOccasion("work");
        List<SchemeItem> list = new ArrayList<>();
        for (WardrobeItem w : parts) {
            SchemeItem si = new SchemeItem();
            si.setScheme(s);
            si.setWardrobeItem(w);
            list.add(si);
        }
        items.put(s.getId(), list);
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityId(s.getId());
        c.setScore(BigDecimal.valueOf(50 + title.length()));
        c.getDimensions().setTrend(BigDecimal.valueOf(40 + title.length()));
        c.getDimensions().setTrendVelocity(BigDecimal.valueOf(10));
        hypeRows.put(s.getId(), c);
        return s;
    }

    @SuppressWarnings("unchecked")
    CopilotRetratoFixture() {
        WardrobeItem tee = piece("Camiseta branca", "upper_piece", "t_shirt", "white", "COTTON", 3, 72, 55.0, 70.0);
        WardrobeItem shirt = piece("Camisa azul", "upper_piece", "shirt", "blue", "COTTON", 90, 40, 20.0, 65.0);
        WardrobeItem jeans = piece("Calça jeans", "lower_piece", "jeans", "denim", "COTTON", 5, 61, 10.0, null);
        WardrobeItem tailored = piece("Calça de alfaiataria", "lower_piece", "tailored_pants", "black", "WOOL", 120, 35, 80.0, 20.0);
        WardrobeItem sneakers = piece("Tênis branco", "shoes_piece", "casual_sneakers", "white", "LEATHER", 1, 80, null, 30.0);
        piece("Mocassim marrom", "shoes_piece", "loafers", "brown", "LEATHER", 200, 20, 60.0, 10.0);
        looks.add(look("Trabalho leve", owner, shirt, tailored, sneakers));
        looks.add(look("Fim de semana", owner, tee, jeans, sneakers));
        Scheme publico = look("Look da Bia", other, tee);
        when(wardrobe.eligible(uid)).thenReturn(closet);
        when(mirror.eligible(uid)).thenReturn(closet);
        when(pieces.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(closet);
        when(pieces.countByUserId(uid)).thenReturn((long) closet.size());
        when(pieces.findByIdIn(anyCollection())).thenAnswer(inv -> closet.stream()
                .filter(w -> ((Collection<UUID>) inv.getArgument(0)).contains(w.getId())).toList());
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(eq(uid), any())).thenReturn(looks);
        when(schemes.countByUserId(uid)).thenReturn((long) looks.size());
        when(schemes.findPublicFeed(any())).thenReturn(List.of(publico, looks.get(0)));
        when(schemeItems.findBySchemeIdOrderBySortOrder(any())).thenAnswer(inv -> items.getOrDefault(inv.getArgument(0), List.of()));
        when(schemeService.canView(any(), any())).thenReturn(true);
        when(dailyLooks.findTop30ByUserIdOrderByLookDateDesc(uid)).thenReturn(List.of());
        StyleDna dna = new StyleDna();
        dna.setArchetype(StyleArchetype.CLASSIC);
        dna.setColorPalette("white,navy");
        dna.setStyleKeywords("classic,minimalist");
        when(dnas.findByUserId(uid)).thenReturn(Optional.of(dna));
        when(preferences.findByUserId(uid)).thenReturn(Optional.empty());
        when(room.locateAll(uid)).thenAnswer(inv -> new HashMap<>(Map.of(sneakers.getId(),
                new RoomService.Location(new RoomAddress("SAPATEIRA", 2, 1), "Sapateira, prateleira 2", "mod-shoes"))));
        when(room.locate(any(), any())).thenReturn(Optional.empty());
        when(room.lastDiaryDates(eq(uid), any())).thenReturn(Map.of(tee.getId(), LocalDate.now(FaiPointsService.ZONE).minusDays(2)));
        when(inventory.improvementHints(uid)).thenReturn(Map.of("eligible", true, "score", 58,
                "weakest", List.of(new InventoryScoreService.Dimension("USE", "Uso", 31, 0.2, "use mais", List.of())),
                "actions", List.of(Map.of("type", "CHALLENGE")), "suggestedChallenges", List.of("SECOND_CHANCE")));
        when(inventory.album(me)).thenReturn(Map.of("message", "3 combinações novas", "undiscovered", List.of("a+b")));
        when(inventory.computeIsolated(eq(uid), anyBoolean())).thenThrow(new IllegalStateException("sem cache"));
        when(challenges.activeSummary(uid)).thenReturn(List.of(Map.of("code", "SECOND_CHANCE")));
        when(challenges.restriction(uid)).thenReturn(Optional.empty());
        when(weather.resolve(any(), any(), any())).thenReturn(WeatherService.Context.none(""));
        when(hype.currentOf(any(), anyCollection())).thenAnswer(inv -> {
            Map<UUID, HypeScoreCurrent> out = new HashMap<>();
            ((Collection<UUID>) inv.getArgument(1)).forEach(k -> {
                if (hypeRows.containsKey(k)) out.put(k, hypeRows.get(k));
            });
            return out;
        });
        HypeScoreConfig config = mock(HypeScoreConfig.class);
        when(config.deltaWindowDays()).thenReturn(7);
        when(hype.config()).thenReturn(config);
        when(insights.itemsOrEmpty(any(), any())).thenReturn(List.of(Map.of("kind", "REDISCOVERY")));
        // TreeMap: a ordem das chaves entra no JSON do prompt da IA e precisa ser a mesma em toda execução
        when(moments.activeSummary(uid)).thenReturn(List.of(new TreeMap<>(Map.of("id", id("m"), "slug", "halloween-2026", "name", "Halloween 2026",
                "occasionTags", List.of("party"), "styleTags", List.of("edgy"), "colorTags", List.of("black"),
                "interpretations", List.of(new TreeMap<>(Map.of("key", "dark", "styleTags", List.of("streetwear"), "colorTags", List.of("black"))))))));
        when(autopilot.daily(any(), any(), any(), any())).thenAnswer(inv -> Map.of("message", "ok", "suggestions",
                new ArrayList<>(List.of(new HashMap<>(Map.of("key", "k1", "title", "Look 1", "rationale", "porque sim",
                        "pieceIds", List.of(tee.getId(), jeans.getId(), sneakers.getId())))))));
        Scheme created = look("Criado pelo Copilot", owner, tee);
        when(autopilot.createScheme(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(created);
        when(dailyLookService.register(any(), any(), any(), any())).thenReturn(new DailyLook());
        when(dailyLookService.view(any())).thenReturn(Map.of("dailyLook", true));
        when(ai.text(any())).thenAnswer(inv -> new AiOutcome<>("Combine a [[p1]] com a [[p2]] e a [[p99]].", null, AiCallResult.SUCCESS,
                false, "remote", "test", 0, BigDecimal.ZERO, null, null, null));
        svc = new CopilotService(wardrobe, pieces, schemes, schemeItems, dailyLooks, dnas, preferences, room, mirror, inventory, challenges,
                autopilot, dailyLookService, weather, ai, audit, schemeService, studio, hype, insights);
        svc.setMoments(moments);
    }

    /** Catálogo do Background Studio lido do manifesto real (como no CopilotLexiconTest). */
    void catalog(Map<String, Object> manifest) {
        when(studio.catalog()).thenReturn(Map.of("auraPresets", manifest.get("auraPresets"), "materials", manifest.get("materials"),
                "gradients", manifest.get("gradientAuraPresets"), "seasonal", manifest.get("seasonalPresets")));
        when(studio.recommend(any(), any())).thenReturn(Map.of("aura", "aura_electro__01_cyan_pulse", "skin", "atelier", "material", "cetim_liquido"));
    }
}
