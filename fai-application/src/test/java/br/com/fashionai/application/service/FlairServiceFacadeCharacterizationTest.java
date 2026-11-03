package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.Retrato;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairProfileRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.application.hype.HypeScoreConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Caracterização do contrato do {@link FlairService} antes de virar Facade: tabelas estáticas e o mapeamento peça →
 * entrada do motor (por digest, sem ids), a ordem das chaves de cada payload, os códigos {@code status:code} das
 * validações e as regras de recompensa (duelo, arena, quest e resgate).
 */
class FlairServiceFacadeCharacterizationTest {
    private Kit kit;
    private World world;
    private FlairService flair;
    private CurrentUser ana;
    private CurrentUser bia;
    private List<UUID> looks;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        kit.atelier();
        flair = kit.real(FlairService.class);
        ana = Kit.as(world.me);
        bia = Kit.as(world.rival);
        looks = world.lookIds(world.me);
    }

    private static String code(Executable call) {
        Throwable t = catchThrowable(call::execute);
        assertThat(t).isInstanceOf(ApiException.class);
        return ((ApiException) t).status() + ":" + ((ApiException) t).code();
    }

    private static String semIds(String retrato) {
        return retrato.replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "<id>");
    }

    private User brand(String name) {
        User b = Kit.user(name);
        b.setProfileType(ProfileType.MARCA);
        return kit.dep(UserRepository.class).save(b);
    }

    private FlairService.CombinationForm form(String type, List<String> categories, Integer minPower, String rarity, Integer stock) {
        return new FlairService.CombinationForm("Combo", "Desc", type, categories, List.of("classic"), List.of(), 0, minPower, rarity, 2,
                "10% na loja", 10, null, new BigDecimal("100"), 30, stock, true, null, null, "#aa2233", "https://loja.example.com");
    }

    @Test
    void tabelasEstaticasEMapeamentoDaPecaNaoMudam() {
        List<Object> r = new ArrayList<>();
        r.add(List.of(FlairDuelGame.CASA, FlairDuelGame.DUEL_REWARDS_PER_DAY, FlairArena.ARENA_OCCASIONS, FlairWallet.SKINS,
                FlairCombinationAdmin.GAME_TYPES, FlairCombinationRules.CATEGORY_LABELS));
        r.add(FlairQuests.QUESTS);
        for (int d = 0; d < 12; d++) {
            r.add(FlairArena.arenaTheme(LocalDate.of(2026, 1, 1).plusDays(d)));
        }
        List<WardrobeItem> ws = world.piecesOf(world.me);
        FlairDecks deckReader = new FlairDecks(kit.dep(WardrobeItemRepository.class), kit.dep(SchemeRepository.class),
                kit.dep(SchemeItemRepository.class), kit.dep(SchemeService.class), kit.dep(HypeScoreCurrentRepository.class),
                kit.dep(HypeScoreConfig.class));
        for (WardrobeItem w : ws) {
            r.add(deckReader.input(w, FlairEngine.Hype.NONE));
        }
        List<FlairEngine.Card> cs = flair.cardsOf(ws);
        r.add(FlairDecks.album(cs).keySet());
        r.add(FlairDecks.gameHype(null));
        assertThat(Retrato.sha("flair-service-tabelas", semIds(Retrato.of(r))))
                .isEqualTo("0bd50e26ceef4a8911361c6661832d430ad4cac23a18ae6d32bcb3424a492549");
        assertThat(FlairService.today()).isEqualTo(LocalDate.now(FaiPointsService.ZONE));
        assertThat(FlairService.season()).isEqualTo(FlairEngine.season(FlairService.today()));
        assertThat(flair.publicLookHype(List.of(looks.get(0)))).isEmpty();
        assertThat(flair.publicLookHype((UUID) null)).isNull();
        assertThat(flair.card(ws.get(0))).isEqualTo(cs.get(0));
    }

    @Test
    void chavesDosPayloadsECodigosDosErros() {
        assertThat(flair.cards(ana).keySet()).containsExactly("season", "cards", "album");
        assertThat(flair.me(ana).keySet()).containsExactly("coins", "rank", "wins", "losses", "draws", "skins", "activeSkin", "skinShop", "season",
                "team", "ledger", "recent", "ethics");
        assertThat(code(() -> flair.buySkin(ana, "NAO", false))).isEqualTo("404:NAO_ENCONTRADO");
        assertThat(code(() -> flair.buySkin(ana, "CHAMPION", false))).isEqualTo("409:COINS_INSUFICIENTES");
        assertThat(code(() -> flair.deckOf(ana, UUID.randomUUID()))).isEqualTo("404:NAO_ENCONTRADO");
        Map<String, Object> duel = flair.duel(ana, looks.get(0), "casa");
        assertThat(duel.keySet()).containsExactly("matchId", "mode", "me", "opponent", "rounds", "score", "outcome", "coins", "rewardCapReached",
                "faiPoints", "profile");
        Object outcome = duel.get("outcome");
        assertThat(duel.get("coins")).isEqualTo("WIN".equals(outcome) ? 20 : "DRAW".equals(outcome) ? 15 : 5);
        assertThat(flair.me(ana).get("coins")).isEqualTo(duel.get("coins"));
        assertThat(map(flair.me(ana).get("rank")).get("points")).isEqualTo("WIN".equals(outcome) ? 25 : "DRAW".equals(outcome) ? 8 : 2);
        assertThat(map(((List<?>) flair.me(ana).get("recent")).get(0)).keySet())
                .containsExactly("matchId", "mode", "theme", "date", "deck", "power", "score", "outcome");
        assertThat(code(() -> flair.duel(ana, looks.get(0), "@ana"))).isEqualTo("400:DUELO_CONSIGO");
        assertThat(code(() -> flair.duel(ana, looks.get(0), "ninguem"))).isEqualTo("404:NAO_ENCONTRADO");
        world.person("gabi", 0);
        assertThat(code(() -> flair.duel(ana, looks.get(0), "gabi"))).isEqualTo("409:SEM_DECK_PUBLICO");
        assertThat(code(() -> flair.duel(ana, world.lookIds(world.rival).get(0), null))).isEqualTo("404:NAO_ENCONTRADO");

        Map<String, Object> arena = flair.joinArena(ana, looks.get(0));
        assertThat(arena.keySet()).containsExactly("date", "theme", "rule", "leaderboard");
        assertThat(map(((List<?>) arena.get("leaderboard")).get(0)).keySet()).containsExactly("position", "user", "deck", "score", "power", "you");
        assertThat(code(() -> flair.joinArena(ana, looks.get(1)))).isEqualTo("409:JA_NA_ARENA");

        Map<String, Object> league = flair.createTeam(ana, "Time A", "#00ff00");
        assertThat(league.keySet()).containsExactly("teams", "mine", "players", "rule", "battles");
        assertThat(map(league.get("mine")).keySet()).containsExactly("id", "name", "code", "color", "points", "owner", "members", "mine");
        assertThat(flair.league(null).keySet()).containsExactly("teams", "mine", "players", "rule");
        assertThat(code(() -> flair.createTeam(ana, "Time B", null))).isEqualTo("409:JA_EM_EQUIPE");
        assertThat(code(() -> flair.joinTeam(bia, "XXXX"))).isEqualTo("404:NAO_ENCONTRADO");
        assertThat(code(() -> flair.teamBattle(bia, "XXXX"))).isEqualTo("409:SEM_EQUIPE");
        String mine = String.valueOf(map(league.get("mine")).get("code"));
        assertThat(code(() -> flair.teamBattle(ana, mine))).isEqualTo("400:MESMA_EQUIPE");
        String rival = String.valueOf(map(flair.createTeam(bia, "Time B", null).get("mine")).get("code"));
        Map<String, Object> battle = flair.teamBattle(ana, rival);
        assertThat(battle.keySet()).containsExactly("matchId", "teamA", "teamB", "duels", "score", "winner", "faiPoints");
        assertThat(map(((List<?>) battle.get("duels")).get(0)).keySet()).containsExactly("slot", "a", "b", "winner", "rounds");
        assertThat(code(() -> flair.teamBattle(ana, rival))).isEqualTo("409:JA_DUELARAM_HOJE");
        assertThat(flair.leaveTeam(bia).get("mine")).isNull();
    }

    @Test
    void questsCombinacoesECupons() {
        List<Map<String, Object>> qs = flair.quests(ana);
        assertThat(qs).extracting(q -> q.get("code")).containsExactly("SEASONAL_LOOK", "BRAND_COLLECTOR", "VERSATILE_MASTER", "GLOW_UP",
                "STYLE_CURATOR", "WARDROBE_MAVEN", "DUEL_CHAMPION", "POWER_DECK");
        assertThat(qs.get(0).keySet()).containsExactly("code", "label", "period", "rule", "coins", "progress", "target", "done", "claimed");
        assertThat(code(() -> flair.claimQuest(ana, "STYLE_CURATOR"))).isEqualTo("409:QUEST_INCOMPLETA");
        assertThat(code(() -> flair.claimQuest(ana, "X"))).isEqualTo("404:NAO_ENCONTRADO");
        world.piecesOf(world.me).subList(0, 3).forEach(w -> w.markCreatedAt(Instant.now()));
        flair.claimQuest(ana, "WARDROBE_MAVEN");
        assertThat(code(() -> flair.claimQuest(ana, "WARDROBE_MAVEN"))).isEqualTo("409:QUEST_JA_RESGATADA");
        assertThat(MemoryRepository.rows(kit.dep(FlairCoinEntryRepository.class))).hasSize(1);
        FlairProfile p = MemoryRepository.<FlairProfile>rows(kit.dep(FlairProfileRepository.class)).get(0);
        assertThat(List.of(p.getCoins(), p.getRankPoints())).containsExactly(150, 10);

        User loja = brand("lojaz");
        CurrentUser store = Kit.as(loja);
        assertThat(code(() -> flair.saveCombination(store, null, form("X", List.of("lower_piece"), 0, null, 5)))).isEqualTo("400:TIPO_INVALIDO");
        Map<String, Object> combo = flair.saveCombination(store, null, form("COMBINACAO", List.of("full_body_piece"), 1, "standard", 5));
        assertThat(combo.keySet()).containsExactly("id", "brand", "brandName", "brandSlug", "name", "description", "gameType", "requiredCategories",
                "requiredStyles", "requiredOccasions", "minBrandPieces", "minDeckPower", "minRarity", "minWins", "coupon", "stock", "redeemed",
                "active", "available", "startsAt", "endsAt", "accentColor", "storeUrl");
        assertThat(List.of(combo.get("minRarity"), combo.get("minWins"), combo.get("minDeckPower"), combo.get("requiredOccasions")))
                .containsExactly("STANDARD", 0, 1, List.of());
        UUID id = (UUID) combo.get("id");
        List<Map<String, Object>> forAna = flair.combinationsFor(ana);
        assertThat(forAna.get(0).keySet()).endsWith("redemption", "bestDeck", "checks", "complete");
        assertThat(((List<?>) forAna.get(0).get("checks"))).extracting(c -> map(c).get("kind")).containsExactly("CATEGORY", "STYLE", "POWER",
                "RARITY");
        assertThat(flair.checkCombination(ana, id, null).keySet()).containsExactlyInAnyOrder("combination", "deck", "checks", "complete");
        assertThat(code(() -> flair.redeem(ana, id, looks.get(0)))).isEqualTo("422:COMBINACAO_INCOMPLETA");
        Map<String, Object> voucher = flair.redeem(ana, id, looks.get(5));
        assertThat(voucher.keySet()).containsExactly("id", "code", "status", "expiresAt", "usedAt", "createdAt", "deck", "deckPower", "user",
                "combination");
        assertThat(String.valueOf(voucher.get("code"))).matches("FLR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}");
        assertThat(code(() -> flair.redeem(ana, id, looks.get(5)))).isEqualTo("409:CUPOM_JA_EMITIDO");
        assertThat(flair.vouchers(ana)).hasSize(1);
        when(kit.dep(InstitutionalService.class).institutionalUser(any())).thenReturn(loja);
        assertThat(flair.brandTab(store, "lojaz").keySet()).containsExactly("admin", "brandName", "participating", "combinations", "redemptions",
                "stats", "gameTypes");
        assertThat(flair.brandTab(null, "lojaz").keySet()).containsExactly("admin", "brandName", "participating", "combinations");
        assertThat(code(() -> flair.validateCode(store, "nada"))).isEqualTo("404:NAO_ENCONTRADO");
        flair.validateCode(store, String.valueOf(voucher.get("code")));
        assertThat(code(() -> flair.validateCode(store, String.valueOf(voucher.get("code"))))).isEqualTo("409:CUPOM_USADO");
        FlairRedemption r = MemoryRepository.<FlairRedemption>rows(kit.dep(FlairRedemptionRepository.class)).get(0);
        r.setStatus("EMITIDO");
        r.setExpiresAt(Instant.now().minusSeconds(5));
        assertThat(code(() -> flair.validateCode(store, String.valueOf(voucher.get("code"))))).isEqualTo("409:CUPOM_EXPIRADO");
        assertThat(flair.vouchers(ana).get(0).get("status")).isEqualTo("EXPIRADO");
        flair.saveCombination(store, id, form("COMBINACAO", List.of("full_body_piece"), 1, null, 1));
        assertThat(code(() -> flair.redeem(bia, id, null))).isEqualTo("409:COMBINACAO_INDISPONIVEL");
        assertThat(flair.available(kit.dep(br.com.fashionai.domain.repository.FlairCombinationRepository.class).findById(id).orElseThrow()))
                .isFalse();
        assertThat(FlairService.sellerActive(loja)).isTrue();
        assertThat(FlairService.sellerActive(null)).isFalse();
    }
}
