package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AuraPermissionsService.AuraType;
import br.com.fashionai.application.service.FaiPointsService.Level;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairGameReward;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.FlairGameRewardRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Glass Empire — serviço dos jogos: bloqueio por nível ANTES de qualquer avaliação do CBC, check com o bloco glass,
 * submit com bônus de perfeição e recompensas, 404 para linha sem série, catálogo e resumo com contagens.
 */
class FlairGameServiceTest {
    static final Instant NOW = Instant.parse("2026-11-05T15:00:00Z");
    static final String SLOTS = "[{\"key\":\"caco\",\"position\":\"CAL\",\"label\":{\"pt-BR\":\"Caco\",\"en\":\"Shard\"},"
            + "\"effects\":{\"comum\":{\"pt-BR\":\"Reflexo simples\"},\"metamorfose\":{\"pt-BR\":\"Reflexo vivo\"},\"impersonation\":{\"pt-BR\":\"Reflexo da estrela\"}},"
            + "\"bonus\":{\"metamorfose\":2,\"impersonation\":3}},"
            + "{\"key\":\"moldura\",\"position\":\"SUP\"},{\"key\":\"base\",\"position\":\"INF\"},"
            + "{\"key\":\"extra\",\"position\":\"ACE\",\"accepts\":{\"optional\":true}}]";
    static final String HYPE = "{\"deckMin\":\"LOW_SIGNAL\",\"mandatoryMin\":\"NICHE\",\"mandatoryMax\":\"HOT\",\"play\":{\"mode\":\"BONUS_ABOVE_RELEVANT\",\"cap\":3},\"partial\":{\"mode\":\"UP_DOWN\"}}";
    static final String FICHA = "{\"objective\":{\"pt-BR\":\"Junte os cacos\",\"en\":\"Gather the shards\"},\"scenario\":{\"pt-BR\":\"O espelho partiu\",\"en\":\"The mirror broke\",\"es\":\"El espejo se rompió\"}}";
    static final String REWARDS = "[{\"type\":\"ITEM\",\"code\":\"GE-A01-MOLDURA\",\"names\":{\"pt-BR\":\"Moldura Prisma\"}},"
            + "{\"type\":\"SPECIAL_CARD\",\"code\":\"GE-A01-ESPELHO\",\"names\":{\"pt-BR\":\"Espelho Inteiro\"},\"condition\":\"perfect\"}]";

    private Kit kit;
    private FlairGameService service;
    private FlairChallengeService cbc;
    private FaiPointsService points;
    private InventoryScoreService inventory;
    private AuraPermissionsService auras;
    private GlassRewards rewards;
    private User ana;
    private CurrentUser anaU;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = kit.save(UserRepository.class, Kit.user("ana"));
        anaU = Kit.as(ana);
        lenient().when(kit.dep(MomentService.class).canSee(any(), any())).thenReturn(true);
        points = kit.dep(FaiPointsService.class);
        lenient().when(points.award(any(), anyString(), anyString(), anyString(), any())).thenAnswer(i -> {
            Integer p = i.getArgument(4);
            return new FaiPointsService.Award(true, p == null ? 10 : p, false, "", null, false);
        });
        lenient().when(points.level(any())).thenReturn(Level.STUDIO);
        inventory = kit.dep(InventoryScoreService.class);
        auras = kit.dep(AuraPermissionsService.class);
        lenient().when(kit.dep(FlairCollectionService.class).visible(any(), any())).thenReturn(true);
        kit.atelier();
        FlairChallengeService real = kit.build(FlairChallengeService.class);
        real.useClock(Clock.fixed(NOW, ZoneOffset.UTC));
        cbc = Mockito.spy(real);
        kit.with(cbc);
        kit.real(GlassAccess.class);
        rewards = Mockito.spy(kit.build(GlassRewards.class));
        kit.with(rewards);
        service = kit.build(FlairGameService.class);
    }

    // ------------------------------------------------------------------ apoio
    FlairChallenge game(int number, String slug, String tier, String wardrobe) {
        FlairChallenge c = new FlairChallenge();
        c.setSlug(slug);
        c.setName("Jogo " + number);
        c.setScenario("livre");
        c.setDifficulty(FlairChallengeDifficulty.EASY);
        c.setSlotsJson(SLOTS);
        c.setRequirementsJson("[]");
        c.setPoints(20);
        c.setLocksCards(false);
        c.setSortOrder(number);
        c.setSeries("A");
        c.setGameNumber(number);
        c.setDistrict("SUITE");
        c.setRarity("COMMON");
        c.setRequiredLevel(tier);
        c.setRequiredWardrobeLevel(wardrobe);
        c.setHypeJson(HYPE);
        c.setFichaJson(FICHA);
        c.setRewardsJson(REWARDS);
        c.setThumbnail("/flair/games/" + slug + ".webp");
        return kit.save(FlairChallengeRepository.class, c);
    }

    FlairCardInstance card(String position, String color, String styles, Double hyp, String backgroundConfig) {
        String category = switch (position) {
            case "CAL" -> "shoes_piece";
            case "INF" -> "lower_piece";
            case "ACE" -> "accessory_piece";
            default -> "upper_piece";
        };
        WardrobeItem w = Kit.piece(ana, "peça " + position + " " + color, category, "t_shirt", color);
        w.markCreatedAt(NOW.minusSeconds(86_400L * 100));
        w.setStyleTags(styles);
        w.setLastWornDate(LocalDate.ofInstant(NOW, ZoneOffset.UTC).minusDays(3));
        w.setBackgroundConfigJson(backgroundConfig);
        kit.save(WardrobeItemRepository.class, w);
        FlairCardInstance c = new FlairCardInstance();
        c.setOwnerId(ana.getId());
        c.setCreatorId(ana.getId());
        c.setOriginType("PIECE");
        c.setOriginId(w.getId());
        c.setSeason("SPRING");
        c.setTier("BRONZE");
        c.setOvr(60);
        c.setPosition(position);
        c.setName(w.getName());
        c.setBrandName("Norte");
        c.setTagsJson(Json.write(FlairCollectionService.tagsOf(w)));
        c.setHypeJson(hyp == null ? null : "{\"HYP\":" + hyp + "}");
        return kit.save(FlairCardInstanceRepository.class, c);
    }

    static FlairChallengeService.BuildRequest build(Object... slotCard) {
        Map<String, UUID> m = new LinkedHashMap<>();
        for (int i = 0; i < slotCard.length; i += 2) {
            m.put((String) slotCard[i], ((FlairCardInstance) slotCard[i + 1]).getId());
        }
        return new FlairChallengeService.BuildRequest(m, null);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> map(Object o, String key) {
        return (Map<String, Object>) ((Map<String, Object>) o).get(key);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> list(Object o, String key) {
        return (List<Map<String, Object>>) ((Map<String, Object>) o).get(key);
    }

    // ------------------------------------------------------------------ bloqueio
    @Test
    void abaixoDoNivelDevolve403AntesDeQualquerAvaliacaoDoCbc() {
        FlairChallenge g = game(7, "a07-loft", "LOFT", "EM_MONTAGEM");
        FlairChallengeService.BuildRequest req = build("caco", card("CAL", "black", "edgy", null, null));

        assertThatThrownBy(() -> service.check(anaU, g.getSlug(), req)).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status()).isEqualTo(403);
            assertThat(e.code()).isEqualTo("FAI_LEVEL_REQUIRED");
            assertThat(e.details()).containsEntry("requiredTier", "LOFT").containsEntry("currentTier", "STUDIO");
        });
        assertThatThrownBy(() -> service.submit(anaU, g.getSlug(), req)).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status()).isEqualTo(403);
            assertThat(e.code()).isEqualTo("FAI_LEVEL_REQUIRED");
        });
        verifyNoInteractions(cbc, rewards, auras);
        verify(points, never()).award(any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void guardaRoupaAbaixoDaFaixaDevolve403ComDetalhes() {
        FlairChallenge g = game(8, "a08-closet", "ESTREIA", "VERSATIL");
        assertThatThrownBy(() -> service.check(anaU, g.getSlug(), build())).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.code()).isEqualTo("WARDROBE_LEVEL_REQUIRED");
            assertThat(e.details()).containsEntry("requiredWardrobeLevel", "VERSATIL").containsEntry("currentWardrobeLevel", "EM_MONTAGEM");
        });
        verifyNoInteractions(cbc);
    }

    @Test
    void linhaSemSerieOuInexistenteEh404NoJogo() {
        FlairChallenge classic = game(0, "noite-de-gala", "ESTREIA", "EM_MONTAGEM");
        classic.setSeries(null);
        kit.save(FlairChallengeRepository.class, classic);
        for (String slug : List.of("noite-de-gala", "nao-existe")) {
            assertThatThrownBy(() -> service.detail(anaU, slug)).isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.status()).isEqualTo(404);
                assertThat(e.code()).isEqualTo("DESAFIO_NAO_ENCONTRADO");
            });
            assertThatThrownBy(() -> service.check(anaU, slug, build())).isInstanceOf(ApiException.class);
            assertThatThrownBy(() -> service.submit(anaU, slug, build())).isInstanceOf(ApiException.class);
        }
        verifyNoInteractions(cbc);
    }

    // ------------------------------------------------------------------ check
    @Test
    void checkAnexaOBlocoGlassETrocaAAberturaDaHistoriaPeloCenarioDaFicha() {
        FlairChallenge g = game(1, "a01-espelho-partido", "ESTREIA", "EM_MONTAGEM");
        FlairCardInstance caco = card("CAL", "black", "edgy", 95.0, null);       // VIRAL, teto HOT → joga como HOT
        FlairCardInstance moldura = card("SUP", "black", "edgy", 50.0, null);    // RELEVANT
        FlairCardInstance base = card("ACE", "white", "basic", null, null);      // sem Hype → LOW_SIGNAL; fora da posição

        Map<String, Object> out = service.check(anaU, g.getSlug(), build("caco", caco, "moldura", moldura, "base", base));

        verify(cbc).check(eq(anaU), eq("a01-espelho-partido"), any());
        Map<String, Object> glass = map(out, "glass");
        List<Map<String, Object>> slots = list(glass, "slots");
        assertThat(slots).extracting(s -> s.get("slot")).containsExactly("caco", "moldura", "base");
        assertThat(slots.get(0)).containsEntry("hypeBand", "VIRAL").containsEntry("hypeBonus", 1).containsEntry("matchBand", "TRENDING").containsEntry("matchDelta", 1);
        assertThat(slots.get(1)).containsEntry("hypeBand", "RELEVANT").containsEntry("hypeBonus", 0).containsEntry("matchBand", "HOT");
        assertThat(slots.get(2)).containsEntry("hypeBand", "LOW_SIGNAL").containsEntry("hypeBonus", 0).containsEntry("matchBand", "LOW_SIGNAL").containsEntry("matchDelta", 0);
        assertThat(map(slots.get(0), "effect")).containsEntry("kind", "COMUM").containsEntry("bonus", 0).containsEntry("text", "Reflexo simples");
        assertThat(glass).containsEntry("hypeTotal", 1).containsEntry("effectTotal", 0).containsEntry("perfect", false);
        Map<String, Object> ev = map(out, "evaluation");
        assertThat(glass.get("score")).isEqualTo((Integer) ev.get("sintonia") + 1);
        assertThat((Integer) glass.get("scoreMax")).isGreaterThan((Integer) ev.get("sintoniaMax"));
        Map<String, Object> open = list(out, "story").get(0);
        assertThat(open.get("key")).isNull();
        assertThat(open.get("text")).isEqualTo(Map.of("pt-BR", "O espelho partiu", "en", "The mirror broke", "es", "El espejo se rompió"));
        assertThat(out).containsEntry("canSubmit", true);
        verify(points, never()).award(any(), anyString(), anyString(), anyString(), any());
        assertThat(MemoryRepository.rows(kit.dep(FlairGameRewardRepository.class))).isEmpty();
    }

    @Test
    void metamorfoseEImpersonationExigemAAuraEAPecaPronta() {
        FlairChallenge g = game(1, "a01-espelho-partido", "ESTREIA", "EM_MONTAGEM");
        String ready = "{\"auraImpersonation\":true,\"impersonationData\":{\"status\":\"READY\"}}";
        FlairCardInstance caco = card("CAL", "black", "edgy", null, ready);
        FlairCardInstance moldura = card("SUP", "black", "edgy", null, "{\"auraImpersonation\":true,\"impersonationData\":{\"status\":\"PENDING\"}}");
        FlairCardInstance base = card("INF", "black", "edgy", null, null);
        FlairChallengeService.BuildRequest req = build("caco", caco, "moldura", moldura, "base", base);

        List<Map<String, Object>> without = list(map(service.check(anaU, g.getSlug(), req), "glass"), "slots");
        assertThat(without).allSatisfy(s -> assertThat(map(s, "effect")).containsEntry("kind", "COMUM"));

        when(auras.canUserEquipAura(ana.getId(), AuraType.AURA_METAMORPHOSE)).thenReturn(true);
        when(auras.canUserEquipAura(ana.getId(), AuraType.AURA_IMPERSONATION)).thenReturn(true);
        Map<String, Object> glass = map(service.check(anaU, g.getSlug(), req), "glass");
        List<Map<String, Object>> with = list(glass, "slots");
        assertThat(map(with.get(0), "effect")).containsEntry("kind", "IMPERSONATION").containsEntry("bonus", 3).containsEntry("text", "Reflexo da estrela");
        assertThat(map(with.get(1), "effect")).containsEntry("kind", "METAMORFOSE").containsEntry("bonus", 1);
        assertThat(map(with.get(2), "effect")).containsEntry("kind", "METAMORFOSE");
        assertThat(glass).containsEntry("effectTotal", 5).containsEntry("perfect", true);
        assertThat(list(map(service.check(anaU, g.getSlug(), req), "points"), "lines")).extracting(l -> l.get("action")).contains("FLAIR_GLASS_PERFECT");
    }

    // ------------------------------------------------------------------ submit
    @Test
    @SuppressWarnings("unchecked")
    void submitPerfeitoLancaOBonusEEntregaAsRecompensasNumaResposta() {
        FlairChallenge g = game(1, "a01-espelho-partido", "ESTREIA", "EM_MONTAGEM");
        RoomCatalogItem sku = new RoomCatalogItem();
        sku.setSku("GE-A01-MOLDURA");
        sku.setName("Moldura Prisma");
        sku.setMoldId("GLASS-DECOR");
        sku.setSlotType("DECOR");
        sku.setRarity("COMMON");
        sku.setRequiredLevel("ESTREIA");
        kit.save(RoomCatalogItemRepository.class, sku);
        FlairChallengeService.BuildRequest req = build("caco", card("CAL", "black", "edgy", null, null),
                "moldura", card("SUP", "black", "edgy", null, null), "base", card("INF", "black", "edgy", null, null));

        Map<String, Object> out = service.submit(anaU, g.getSlug(), req);

        verify(cbc).submit(eq(anaU), eq("a01-espelho-partido"), any());
        assertThat(map(out, "glass")).containsEntry("perfect", true);
        verify(points).award(ana.getId(), "FLAIR_GLASS", "FLAIR_CHALLENGE", g.getId().toString(), 20);
        verify(points).award(ana.getId(), "FLAIR_GLASS_PERFECT", "FLAIR_CHALLENGE", g.getId().toString(), 10);
        Map<String, Object> pts = map(out, "points");
        assertThat(list(pts, "lines")).extracting(l -> l.get("action")).containsExactly("FLAIR_GLASS", "FLAIR_GLASS_PERFECT");
        assertThat(list(pts, "lines").get(1)).containsEntry("granted", true).containsEntry("points", 10);
        assertThat(pts).containsEntry("total", 30);
        List<Map<String, Object>> rewardsOut = list(out, "rewards");
        assertThat(rewardsOut).extracting(r -> r.get("code")).containsExactly("GE-A01-MOLDURA", "GE-A01-ESPELHO");
        assertThat(rewardsOut).extracting(r -> r.get("state")).containsOnly("DELIVERED");
        UUID submissionId = (UUID) map(out, "submission").get("id");
        List<FlairGameReward> rows = MemoryRepository.rows(kit.dep(FlairGameRewardRepository.class));
        assertThat(rows).hasSize(2).allSatisfy(r -> assertThat(r.getSubmissionId()).isEqualTo(submissionId));
        verify(rewards).grant(ana.getId(), g, submissionId, true);
        assertThat(list(out, "story").get(0).get("key")).isNull();
    }

    @Test
    void submitSemPerfeicaoNaoLancaBonusNemCartaEspecial() {
        FlairChallenge g = game(1, "a01-espelho-partido", "ESTREIA", "EM_MONTAGEM");
        // cartas fora da posição pedida: a montagem fecha (ok) mas a sintonia fica abaixo de 2 por vaga obrigatória
        FlairChallengeService.BuildRequest req = build("caco", card("SUP", "black", "edgy", null, null),
                "moldura", card("CAL", "black", "edgy", null, null), "base", card("INF", "black", "edgy", null, null));

        Map<String, Object> out = service.submit(anaU, g.getSlug(), req);

        assertThat(map(out, "glass")).containsEntry("perfect", false).containsEntry("score", 4);
        verify(points, never()).award(any(), eq("FLAIR_GLASS_PERFECT"), anyString(), anyString(), any());
        assertThat(list(out, "rewards")).extracting(r -> r.get("code")).containsExactly("GE-A01-MOLDURA");
        assertThat(list(out, "rewards").get(0)).containsEntry("state", "PENDING");
        assertThat(map(out, "points")).containsEntry("total", 20);
    }

    // ------------------------------------------------------------------ catálogo
    @Test
    void summaryEListContamEInformamOAcessoSemBloquear() {
        game(1, "a01-espelho", "ESTREIA", "EM_MONTAGEM");
        game(2, "a02-vitrine", "STUDIO", "ORGANIZADO");
        game(3, "a03-loft", "LOFT", "EM_MONTAGEM");
        FlairChallenge classic = game(0, "classico", "ESTREIA", "EM_MONTAGEM");
        classic.setSeries(null);
        kit.save(FlairChallengeRepository.class, classic);
        when(inventory.compute(eq(ana.getId()), eq(true))).thenReturn(new InventoryScoreService.Result(ana.getId(), true, 10, 1.0, 320, "x",
                Map.of(), Map.of(), List.of(), NOW));

        Map<String, Object> summary = service.summary(anaU);
        assertThat(summary).containsEntry("total", 3).containsEntry("playable", 2);
        assertThat(map(summary, "byTier")).containsEntry("ESTREIA", 1).containsEntry("STUDIO", 1).containsEntry("LOFT", 1);
        assertThat(service.summary(null)).containsEntry("total", 3).containsEntry("playable", 0);

        Map<String, Object> list = service.list(anaU, null);
        List<Map<String, Object>> games = list(list, "games");
        assertThat(games).extracting(v -> v.get("slug")).containsExactly("a01-espelho", "a02-vitrine", "a03-loft");
        assertThat(games.get(0)).containsEntry("number", 1).containsEntry("series", "A").containsEntry("district", "SUITE")
                .containsEntry("rarity", "COMMON").containsEntry("requiredTier", "ESTREIA").containsEntry("thumbnail", "/flair/games/a01-espelho.webp");
        assertThat(map(games.get(2), "access")).containsEntry("allowed", false).containsEntry("tierOk", false).containsEntry("currentTier", "STUDIO");
        assertThat(map(games.get(1), "access")).containsEntry("allowed", true);
        assertThat(map(games.get(0), "hype")).containsEntry("mandatoryMax", "HOT");
        assertThat(list(games.get(0), "rewards")).hasSize(2);
        assertThat(map(list, "me")).containsEntry("tier", "STUDIO").containsEntry("wardrobeLevel", "ORGANIZADO").containsEntry("wardrobeScore", 320);
        assertThat(map(map(list, "counts"), "byTier")).containsEntry("LOFT", 1);
        verify(inventory, Mockito.times(2)).compute(ana.getId(), true);   // uma leitura por requisição (summary + list)

        Map<String, Object> filtered = service.list(null, new FlairGameService.Filters("loft", null, null, null, "a", null, "jogo 3"));
        assertThat(list(filtered, "games")).extracting(v -> v.get("slug")).containsExactly("a03-loft");
        assertThat(filtered.get("me")).isNull();
        assertThat(map(list(filtered, "games").get(0), "access")).containsEntry("allowed", false).containsEntry("tierOk", false);
        assertThat(list(service.list(anaU, new FlairGameService.Filters(null, null, "HARD", null, null, null, null)), "games")).isEmpty();
    }

    @Test
    void detailReuneDetalheDoCbcComFichaCenaVagasEAcesso() {
        FlairChallenge g = game(1, "a01-espelho-partido", "LOFT", "EM_MONTAGEM");
        g.setSceneJson("{\"sky\":[\"#000\",\"#111\"],\"horizon\":60}");
        kit.save(FlairChallengeRepository.class, g);

        Map<String, Object> out = service.detail(anaU, g.getSlug());

        verify(cbc).detail(anaU, "a01-espelho-partido");
        assertThat(map(out, "access")).containsEntry("allowed", false).containsEntry("requiredTier", "LOFT");
        assertThat(map(out, "ficha")).containsEntry("objective", "Junte os cacos").containsEntry("scenario", "O espelho partiu");
        assertThat(map(out, "scene")).containsEntry("horizon", 60);
        assertThat(map(out, "hypeRules")).containsKey("play");
        List<Map<String, Object>> slots = list(out, "slots");
        assertThat(slots).extracting(s -> s.get("key")).containsExactly("caco", "moldura", "base", "extra");
        assertThat(slots.get(0)).containsEntry("optional", false).containsEntry("label", "Caco");
        assertThat(map(slots.get(0), "effects")).containsEntry("metamorfose", "Reflexo vivo");
        assertThat(map(slots.get(0), "bonus")).containsEntry("impersonation", 3);
        assertThat(slots.get(3)).containsEntry("optional", true);
        assertThat(map(slots.get(3), "effects")).containsEntry("comum", null);
        assertThat(out).containsEntry("number", 1).containsKey("mySubmissions").containsKey("memory");
        assertThat(service.detail(null, g.getSlug())).containsEntry("mine", null);
    }
}
