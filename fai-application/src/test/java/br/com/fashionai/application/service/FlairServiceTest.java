package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FlairCombinationRepository;
import br.com.fashionai.domain.repository.FlairProfileRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * FLAIR (RF41): cartas das peças, decks dos looks, duelo e treino contra a Casa, arena do dia, equipes 3×3, quests,
 * skins e as combinações das lojas que viram cupom — tudo com coins do sistema, sem aposta.
 */
class FlairServiceTest {
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
        flair = kit.real(FlairService.class);
        ana = Kit.as(world.me);
        bia = Kit.as(world.rival);
        looks = world.lookIds(world.me);
    }

    private User brand(String name) {
        User b = Kit.user(name);
        b.setProfileType(ProfileType.MARCA);
        return kit.dep(UserRepository.class).save(b);
    }

    private FlairService.CombinationForm form(String type, List<String> categories, Integer minPower, String rarity, Integer stock) {
        return new FlairService.CombinationForm("Combo de inverno", "Monte o look da estação", type, categories, List.of("classic"),
                List.of(), 0, minPower, rarity, 2, "10% na loja", 10, null, new BigDecimal("100"), 30, stock, true, null, null, "#aa2233",
                "https://loja.example.com");
    }

    @Test
    void cartasAlbumEDecks() {
        Map<String, Object> cards = flair.cards(ana);
        assertThat((List<?>) cards.get("cards")).hasSize(12);
        assertThat(map(cards.get("album"))).containsKeys("slots", "collected", "rows");
        assertThat(flair.decks(ana)).hasSize(6);
        assertThat(flair.deckOf(bia, looks.get(0)).cards()).isNotEmpty();
        assertThatThrownBy(() -> flair.deckOf(bia, UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void perfilComeçaZeradoESkinCustaCoins() {
        Map<String, Object> me = flair.me(ana);
        assertThat(me).containsEntry("coins", 0).containsKeys("rank", "skinShop", "ledger", "recent");
        assertThatThrownBy(() -> flair.buySkin(ana, "NAO_EXISTE", false)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.buySkin(ana, "brand_frame", true)).isInstanceOf(ApiException.class);
        FlairProfile p = MemoryRepository.<FlairProfile>rows(kit.dep(FlairProfileRepository.class)).get(0);
        p.setCoins(1000);
        Map<String, Object> after = flair.buySkin(ana, "brand_frame", true);
        assertThat(after.get("activeSkin")).isEqualTo("BRAND_FRAME");
        assertThat(String.valueOf(after.get("skins"))).contains("BRAND_FRAME");
        // já comprada: só ativa, sem cobrar de novo
        assertThat(flair.buySkin(ana, "BRAND_FRAME", false).get("coins")).isEqualTo(700);
    }

    @Test
    void duelosContraACasaEContraOutraPessoaPagamComTeto() {
        Map<String, Object> house = flair.duel(ana, looks.get(0), null);
        assertThat(house.get("mode")).isEqualTo("TREINO");
        assertThat(house).containsKeys("rounds", "score", "outcome", "profile");
        Map<String, Object> duel = flair.duel(ana, looks.get(1), "@bia");
        assertThat(duel.get("mode")).isEqualTo("DUEL");
        for (int i = 0; i < 6; i++) {
            flair.duel(ana, looks.get(i % looks.size()), "caio");
        }
        assertThat(flair.duel(ana, looks.get(2), "duda").get("rewardCapReached")).isEqualTo(true);
        assertThatThrownBy(() -> flair.duel(ana, looks.get(0), "ana")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.duel(ana, looks.get(0), "ninguem")).isInstanceOf(ApiException.class);
        assertThat((List<?>) flair.me(ana).get("recent")).isNotEmpty();
    }

    @Test
    void duelosContraQuemNaoTemLookPublico() {
        world.person("gabi", 0);
        assertThatThrownBy(() -> flair.duel(ana, looks.get(0), "gabi")).isInstanceOf(ApiException.class);
    }

    @Test
    void arenaDoDiaUmDeckPorPessoa() {
        assertThat((List<?>) flair.arena(ana).get("leaderboard")).isEmpty();
        Map<String, Object> a = flair.joinArena(ana, looks.get(0));
        assertThat((List<?>) a.get("leaderboard")).hasSize(1);
        flair.joinArena(bia, world.lookIds(world.rival).get(0));
        List<?> board = (List<?>) flair.arena(ana).get("leaderboard");
        assertThat(board).hasSize(2);
        assertThat(map(board.get(0)).get("position")).isEqualTo(1);
        assertThatThrownBy(() -> flair.joinArena(ana, looks.get(1))).isInstanceOf(ApiException.class);
        assertThat(FlairService.arenaTheme(java.time.LocalDate.of(2026, 1, 1))).isIn(FlairService.ARENA_OCCASIONS);
    }

    @Test
    void equipesLigaEBatalhaEntreEquipes() {
        Map<String, Object> created = flair.createTeam(ana, "Time da Ana", "#123abc");
        String code = String.valueOf(map(created.get("mine")).get("code"));
        assertThat(map(created.get("mine")).get("color")).isEqualTo("#123ABC");
        assertThatThrownBy(() -> flair.createTeam(ana, "Outro time", null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.joinTeam(ana, code)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.joinTeam(bia, "NAOEXISTE")).isInstanceOf(ApiException.class);
        flair.joinTeam(Kit.as(world.friend), code.toLowerCase());

        Map<String, Object> rival = flair.createTeam(bia, "Time da Bia", "vermelho");
        String rivalCode = String.valueOf(map(rival.get("mine")).get("code"));
        assertThatThrownBy(() -> flair.teamBattle(ana, code)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.teamBattle(Kit.as(Kit.user("semtime")), rivalCode)).isInstanceOf(ApiException.class);

        Map<String, Object> battle = flair.teamBattle(ana, rivalCode);
        assertThat(battle).containsKeys("duels", "score", "winner", "teamA", "teamB");
        assertThatThrownBy(() -> flair.teamBattle(ana, rivalCode)).isInstanceOf(ApiException.class);
        Map<String, Object> league = flair.league(ana);
        assertThat((List<?>) league.get("battles")).hasSize(1);
        assertThat(flair.league(null).get("mine")).isNull();

        flair.leaveTeam(bia);
        assertThat(flair.league(bia).get("mine")).isNull();
    }

    @Test
    void equipeCheiaNaoAceitaMaisNinguem() {
        String code = String.valueOf(map(flair.createTeam(ana, "Lotado", null).get("mine")).get("code"));
        for (String n : List.of("bia", "caio", "duda", "enzo")) {
            User u = kit.dep(UserRepository.class).findByUsernameIgnoreCase(n).orElseThrow();
            flair.joinTeam(Kit.as(u), code);
        }
        User extra = kit.dep(UserRepository.class).save(Kit.user("fabi"));
        assertThatThrownBy(() -> flair.joinTeam(Kit.as(extra), code)).isInstanceOf(ApiException.class);
    }

    @Test
    void questsMostramProgressoEResgateUmaVezPorPeriodo() {
        world.piecesOf(world.me).subList(0, 3).forEach(w -> w.markCreatedAt(Instant.now()));   // 3 peças novas nesta semana
        List<Map<String, Object>> qs = flair.quests(ana);
        assertThat(qs).hasSize(FlairService.QUESTS.size());
        Map<String, Object> maven = qs.stream().filter(q -> "WARDROBE_MAVEN".equals(q.get("code"))).findFirst().orElseThrow();
        assertThat(maven.get("done")).isEqualTo(true);
        assertThat(flair.claimQuest(ana, "WARDROBE_MAVEN")).containsKey("coins");
        assertThatThrownBy(() -> flair.claimQuest(ana, "WARDROBE_MAVEN")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.claimQuest(ana, "DUEL_CHAMPION")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.claimQuest(ana, "NAO_EXISTE")).isInstanceOf(ApiException.class);
    }

    @Test
    void lojaCriaCombinacaoEPessoaResgataOCupom() {
        User loja = brand("lojax");
        CurrentUser store = Kit.as(loja);
        assertThatThrownBy(() -> flair.saveCombination(store, null, new FlairService.CombinationForm("Sem requisito", null, "COMBINACAO",
                List.of(), List.of(), List.of(), 0, 0, null, null, "Cupom", 10, null, null, null, null, null, null, null, null, null)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.saveCombination(store, null, form("TIPO_ERRADO", List.of("lower_piece"), 0, null, 5))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.saveCombination(store, null, new FlairService.CombinationForm("Sem desconto", null, null,
                List.of("lower_piece"), List.of(), List.of(), 0, 0, null, null, "Cupom", null, null, null, null, null, null, null, null, null, null)))
                .isInstanceOf(ApiException.class);

        Map<String, Object> combo = flair.saveCombination(store, null, form("COMBINACAO", List.of("full_body_piece", "nao_existe"), 1, "STANDARD", 5));
        UUID id = (UUID) combo.get("id");
        assertThat(String.valueOf(combo.get("requiredCategories"))).isEqualTo("[full_body_piece]");
        assertThat(combo.get("accentColor")).isEqualTo("#AA2233");

        List<Map<String, Object>> forAna = flair.combinationsFor(ana);
        assertThat(forAna).hasSize(1);
        assertThat(forAna.get(0)).containsKeys("bestDeck", "checks", "complete");
        assertThat(flair.combinationsFor(null)).hasSize(1);

        Map<String, Object> check = flair.checkCombination(ana, id, looks.get(5));
        assertThat(check.get("complete")).isEqualTo(true);
        assertThat(flair.checkCombination(ana, id, null).get("complete")).isEqualTo(false);

        assertThatThrownBy(() -> flair.redeem(ana, id, looks.get(0))).isInstanceOf(ApiException.class);   // Look 1 não tem peça inteira
        Map<String, Object> voucher = flair.redeem(ana, id, looks.get(5));
        String code = String.valueOf(voucher.get("code"));
        assertThat(code).startsWith("FLR-");
        assertThatThrownBy(() -> flair.redeem(ana, id, looks.get(5))).isInstanceOf(ApiException.class);
        assertThat(flair.vouchers(ana)).hasSize(1);

        // no caixa: a loja confere o código uma vez só; outra loja não enxerga o cupom
        assertThatThrownBy(() -> flair.validateCode(Kit.as(brand("outra")), code)).isInstanceOf(ApiException.class);
        assertThat(flair.validateCode(store, code.toLowerCase()).get("status")).isEqualTo("USADO");
        assertThatThrownBy(() -> flair.validateCode(store, code)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> flair.validateCode(store, "FLR-0000-0000")).isInstanceOf(ApiException.class);

        // aba da loja no perfil: dona vê resgates e estatísticas; visitante só as disponíveis
        when(kit.dep(InstitutionalService.class).institutionalUser(any())).thenReturn(loja);
        Map<String, Object> tab = flair.brandTab(store, "lojax");
        assertThat(tab.get("admin")).isEqualTo(true);
        assertThat(map(tab.get("stats"))).containsEntry("issued", 1).containsEntry("used", 1L);
        assertThat(flair.brandTab(ana, "lojax").get("admin")).isEqualTo(false);

        // edição por outra loja é negada; com cupom emitido, excluir só desativa
        when(kit.dep(br.com.fashionai.application.security.Guard.class).deny(any(), any(), any())).thenReturn(ApiException.notFound("x"));
        assertThatThrownBy(() -> flair.saveCombination(Kit.as(brand("terceira")), id, form("COMBINACAO", List.of("lower_piece"), 0, null, 5)))
                .isInstanceOf(ApiException.class);
        assertThat(flair.saveCombination(store, id, form("COLECAO", List.of("full_body_piece"), 0, null, null))).containsEntry("gameType", "COLECAO");
        flair.deleteCombination(store, id);
        FlairCombination c = kit.dep(FlairCombinationRepository.class).findById(id).orElseThrow();
        assertThat(c.isActive()).isFalse();
    }

    @Test
    void cupomExpiradoEEstoqueEsgotado() {
        User loja = brand("lojay");
        CurrentUser store = Kit.as(loja);
        UUID id = (UUID) flair.saveCombination(store, null, form("COLECAO", List.of("full_body_piece"), 0, null, 1)).get("id");
        Map<String, Object> v = flair.redeem(ana, id, null);
        assertThatThrownBy(() -> flair.redeem(bia, id, null)).isInstanceOf(ApiException.class);   // estoque de 1
        FlairRedemption r = MemoryRepository.<FlairRedemption>rows(kit.dep(FlairRedemptionRepository.class)).get(0);
        r.setExpiresAt(Instant.now().minusSeconds(60));
        assertThat(flair.vouchers(ana).get(0).get("status")).isEqualTo("EXPIRADO");
        assertThatThrownBy(() -> flair.validateCode(store, String.valueOf(v.get("code")))).isInstanceOf(ApiException.class);

        UUID sponsored = (UUID) flair.saveCombination(store, null, form("DUELO_PATROCINADO", List.of(), 0, null, 5)).get("id");
        assertThat(flair.checkCombination(ana, sponsored, looks.get(0)).get("complete")).isEqualTo(false);
        UUID fresh = (UUID) flair.saveCombination(store, null, form("COMBINACAO", List.of("lower_piece"), 0, null, null)).get("id");
        flair.deleteCombination(store, fresh);
        assertThat(kit.dep(FlairCombinationRepository.class).findById(fresh)).isEmpty();
        assertThat(FlairService.sellerActive(world.me)).isFalse();
    }
}
