package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairTrophy;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairTrophyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Modos do FLAIR (RF41) sobre um guarda-roupa de verdade: cada modo monta as cartas das peças e os looks com o motor
 * {@link FlairLooks}, enfrenta a Casa (looks públicos da comunidade) ou outra pessoa, grava a partida e paga a
 * recompensa do sistema com teto diário por modo.
 */
class FlairModesServiceTest {
    private Kit kit;
    private World world;
    private FlairModesService modes;
    private CurrentUser ana;
    private List<UUID> looks;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        kit.real(FlairService.class);
        modes = kit.build(FlairModesService.class);
        ana = Kit.as(world.me);
        looks = world.lookIds(world.me);
    }

    private static void assertFinished(Map<String, Object> r, String mode) {
        assertThat(r).containsKeys("matchId", "outcome", "coins", "faiPoints");
        assertThat(r.get("mode")).isEqualTo(mode);
        assertThat(r.get("outcome")).isIn("WIN", "LOSS", "DRAW");
    }

    @Test
    void catalogoListaModosTabuleiroETerritorios() {
        Map<String, Object> c = modes.catalog();
        assertThat(c).containsKeys("modes", "board", "territories", "bosses", "chessBoard", "ethics");
        assertThat((List<?>) c.get("modes")).isNotEmpty();
    }

    @Test
    void meusLooksViramCartasComNota() {
        List<?> mine = (List<?>) modes.myLooks(ana).get("looks");
        assertThat(mine).hasSize(6);
        assertThat(map(mine.get(0))).containsKeys("rating", "stats", "cards");
        assertThat((List<?>) map(mine.get(0)).get("cards")).isNotEmpty();
    }

    @Test
    void batalhaContraACasaEContraOutraPessoa() {
        assertFinished(modes.battle(ana, looks.get(0), null, null), "BATTLE");
        assertFinished(modes.battle(ana, looks.get(1), "@bia", "RED_CARPET"), "BATTLE");
        assertThat(MemoryRepository.rows(kit.dep(FlairMatchRepository.class))).hasSize(2);
    }

    @Test
    void batalhaRecusaOponenteInvalido() {
        assertThatThrownBy(() -> modes.battle(ana, looks.get(0), "ana", null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.battle(ana, looks.get(0), "ninguem", null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.battle(ana, world.lookIds(world.rival).get(0), null, null)).isInstanceOf(ApiException.class);
    }

    @Test
    void recompensaTemTetoDiarioPorModo() {
        int paid = 0;
        for (int i = 0; i < 5; i++) {
            Map<String, Object> r = modes.combo(ana, looks.get(i % looks.size()), null);
            assertFinished(r, "COMBO");
            if (!Boolean.TRUE.equals(r.get("rewardCapReached"))) {
                paid++;
            }
        }
        assertThat(paid).isLessThanOrEqualTo(FlairModesService.REWARDED_PER_MODE_DAY);
    }

    @Test
    void squadEscolheOsCincoLooksQueCobremAsSituacoes() {
        assertFinished(modes.squad(ana, null, null), "SQUAD");
        assertFinished(modes.squad(ana, looks.subList(0, 3), "bia"), "SQUAD");
    }

    @Test
    void ligaElencoTabelaERodadas() {
        assertThatThrownBy(() -> modes.playLeague(ana)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.saveRoster(ana, List.of(), null, null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.saveRoster(ana, looks.subList(0, 2), List.of(looks.get(0)), null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.saveRoster(ana, looks.subList(0, 2), looks.subList(2, 6), null)).isInstanceOf(ApiException.class);

        WardrobeItem special = world.piece(world.me, "blazer");
        Map<String, Object> table = modes.saveRoster(ana, looks.subList(0, 5), List.of(looks.get(5)), List.of(special.getId()));
        assertThat((List<?>) table.get("table")).hasSize(1);

        // a rival também monta elenco: a rodada é contra ela
        CurrentUser bia = Kit.as(world.rival);
        modes.saveRoster(bia, world.lookIds(world.rival).subList(0, 5), null, null);
        Map<String, Object> r = modes.playLeague(ana);
        assertFinished(r, "LEAGUE");
        assertThat(r.get("matchday")).isEqualTo(1);
        Map<String, Object> after = modes.league(ana);
        assertThat((List<?>) after.get("table")).hasSize(2);
        assertThat(map(((List<?>) after.get("table")).get(0)).get("position")).isEqualTo(1);
    }

    @Test
    void ligaSemOutrosElencosJogaContraOsBotsDaCasa() {
        modes.saveRoster(ana, looks.subList(0, 3), null, null);
        assertFinished(modes.playLeague(ana), "LEAGUE");
    }

    @Test
    void tabelaDaLigaSomaPontos() {
        Map<String, Object> st = new LinkedHashMap<>(Map.of("hype", 10));
        FlairModesService.table(st, "A", "A", 30);
        FlairModesService.table(st, "DRAW", "A", 5);
        FlairModesService.table(st, "B", "A", 7);
        assertThat(st).containsEntry("points", 4).containsEntry("wins", 1).containsEntry("draws", 1).containsEntry("losses", 1)
                .containsEntry("stylePoints", 52).doesNotContainKey("hype");
    }

    @Test
    void runwayUmaVezPorSemana() {
        assertThat(modes.runway(ana).get("entry")).isNull();
        Map<String, Object> r = modes.enterRunway(ana, looks.get(0));
        assertFinished(r, "RUNWAY");
        assertThat(r).containsKeys("stages", "place", "field");
        assertThat(modes.runway(ana).get("entry")).isNotNull();
        assertThatThrownBy(() -> modes.enterRunway(ana, looks.get(1))).isInstanceOf(ApiException.class);
    }

    @Test
    void worldTourRolaODadoEResolveOsDesafios() {
        assertThat(modes.tour(ana)).containsKeys("board", "position", "rollsLeft");
        assertThatThrownBy(() -> modes.resolveTour(ana, looks.get(0))).isInstanceOf(ApiException.class);
        int rolls = 0;
        for (int i = 0; i < 6; i++) {
            Map<String, Object> r = modes.roll(ana);
            rolls++;
            assertThat(r).containsKeys("dice", "square");
            if (r.get("pending") != null) {
                assertThatThrownBy(() -> modes.roll(ana)).isInstanceOf(ApiException.class);
                Map<String, Object> resolved = modes.resolveTour(ana, looks.get(i % looks.size()));
                assertThat(resolved).containsKeys("pass", "gained", "tour");
            }
        }
        assertThat(rolls).isEqualTo(6);
        assertThatThrownBy(() -> modes.roll(ana)).isInstanceOf(ApiException.class);
    }

    @Test
    void conquestEMonopolyDisputamTerritorios() {
        assertThat((List<?>) modes.territories(ana, null).get("territories")).isNotEmpty();
        assertThatThrownBy(() -> modes.attack(ana, "CONQUEST", "STREETWEAR", looks.subList(0, 2))).isInstanceOf(ApiException.class);
        Map<String, Object> c = modes.attack(ana, "CONQUEST", "STREETWEAR", looks.subList(0, 3));
        assertFinished(c, "CONQUEST");
        Map<String, Object> m = modes.attack(ana, "monopoly", "HARAJUKU", looks.subList(0, 1));
        assertFinished(m, "MONOPOLY");
        if (Boolean.TRUE.equals(m.get("captured"))) {
            assertThatThrownBy(() -> modes.attack(ana, "MONOPOLY", "HARAJUKU", looks.subList(1, 2))).isInstanceOf(ApiException.class);
            // outra pessoa ataca o distrito que agora é da Ana
            assertFinished(modes.attack(Kit.as(world.rival), "MONOPOLY", "HARAJUKU", world.lookIds(world.rival).subList(0, 1)), "MONOPOLY");
        }
        assertThat(modes.territories(ana, "monopoly").get("map")).isEqualTo("MONOPOLY");
    }

    @Test
    void draftDeEscolhasAlternadasContraAIA() {
        Map<String, Object> d = modes.draftStart(ana);
        UUID id = (UUID) d.get("id");
        assertThat((List<?>) d.get("pool")).hasSizeGreaterThanOrEqualTo(12);
        assertThatThrownBy(() -> modes.draftFinish(ana, id, List.of())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.draftPick(Kit.as(world.rival), id, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.draftPick(ana, id, UUID.randomUUID())).isInstanceOf(ApiException.class);
        while (!"COMPOSE".equals(d.get("turn"))) {
            List<?> pool = (List<?>) d.get("pool");
            FlairLooksCard first = FlairLooksCard.of(pool.get(0));
            d = modes.draftPick(ana, id, UUID.fromString(first.id()));
        }
        List<String> mine = ((List<?>) d.get("mine")).stream().map(c -> FlairLooksCard.of(c).id()).toList();
        assertThatThrownBy(() -> modes.draftFinish(ana, id, List.of(List.of(UUID.fromString(mine.get(0)))))).isInstanceOf(ApiException.class);
        List<List<UUID>> three = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            three.add(List.of(UUID.fromString(mine.get(i * 2)), UUID.fromString(mine.get(i * 2 + 1))));
        }
        Map<String, Object> r = modes.draftFinish(ana, id, three);
        assertFinished(r, "DRAFT_RESULT");
        assertThatThrownBy(() -> modes.draftPick(ana, id, UUID.fromString(mine.get(0)))).isInstanceOf(ApiException.class);
        FlairMatch m = kit.dep(FlairMatchRepository.class).findById(id).orElseThrow();
        assertThat(m.getStatus()).isEqualTo("FINISHED");
    }

    @Test
    void deckBattleComDozeCartasDoGuardaRoupa() {
        Map<String, Object> empty = modes.deck(ana);
        assertThat(empty.get("valid")).isEqualTo(false);
        List<?> suggestion = (List<?>) empty.get("suggestion");
        assertThat(suggestion).hasSize(12);
        assertThatThrownBy(() -> modes.deckStart(ana)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.saveDeck(ana, List.of())).isInstanceOf(ApiException.class);

        List<UUID> twelve = world.piecesOf(world.me).stream().map(WardrobeItem::getId).toList();
        Map<String, Object> saved = modes.saveDeck(ana, twelve);
        assertThat(saved.get("valid")).isEqualTo(true);

        Map<String, Object> start = modes.deckStart(ana);
        UUID id = (UUID) start.get("id");
        List<?> hint = (List<?>) start.get("hint");
        assertThatThrownBy(() -> modes.deckPlay(ana, id, List.of(UUID.randomUUID(), UUID.randomUUID()))).isInstanceOf(ApiException.class);
        List<UUID> play = hint.stream().map(x -> UUID.fromString(String.valueOf(x))).limit(5).toList();
        Map<String, Object> r = modes.deckPlay(ana, id, play.size() >= 2 ? play
                : ((List<?>) start.get("hand")).stream().limit(3).map(c -> UUID.fromString(FlairLooksCard.of(c).id())).toList());
        assertFinished(r, "DECK_RESULT");
        assertThatThrownBy(() -> modes.deckPlay(ana, id, play)).isInstanceOf(ApiException.class);
    }

    @Test
    void deckComComposicaoErradaERecusado() {
        // sem um dos acessórios e com uma parte de cima a mais: a regra 4/3/2/2 + 1 curinga não fecha
        List<UUID> wrong = new ArrayList<>(world.piecesOf(world.me).stream().filter(w -> !"cap".equals(w.getSubcategory())).map(WardrobeItem::getId).toList());
        wrong.add(world.piece(world.friend, "t_shirt").getId());
        assertThat(wrong).hasSize(12);
        assertThatThrownBy(() -> modes.saveDeck(ana, wrong)).isInstanceOf(ApiException.class);
    }

    @Test
    void tagTeamComParceriaContraACasaOuContraDuasPessoas() {
        assertFinished(modes.tagTeam(ana, looks.get(0), "bia", null), "TAG_TEAM");
        assertFinished(modes.tagTeam(ana, looks.get(1), "bia", List.of("caio", "duda")), "TAG_TEAM");
        assertThatThrownBy(() -> modes.tagTeam(ana, looks.get(0), "bia", List.of("bia", "caio"))).isInstanceOf(ApiException.class);
    }

    @Test
    void fashionBossEnsinaUmEstiloEDaTrofeu() {
        assertThatThrownBy(() -> modes.fightBoss(ana, "NINGUEM", looks.subList(0, 1))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> modes.fightBoss(ana, "MINIMALIST", List.of())).isInstanceOf(ApiException.class);
        for (String boss : FlairLooks.BOSSES.keySet()) {
            Map<String, Object> r = modes.fightBoss(ana, boss.toLowerCase(), looks.subList(0, 3));
            assertFinished(r, "BOSS");
            assertThat(r).containsKeys("boss", "lesson", "bossScore");
        }
        List<FlairTrophy> trophies = MemoryRepository.rows(kit.dep(FlairTrophyRepository.class));
        assertThat(modes.trophiesOf(world.me.getId())).hasSize(trophies.size());
    }

    @Test
    void wardrobeWarsComparaOsGuardaRoupas() {
        Map<String, Object> r = modes.wardrobeWars(ana, "bia");
        assertFinished(r, "WARDROBE");
        assertThat(r).containsKeys("me", "opponent", "note");
    }

    @Test
    void xadrezMontaOTabuleiroSugeridoEJoga() {
        Map<String, Object> s = modes.chessSuggest(ana);
        @SuppressWarnings("unchecked")
        Map<String, UUID> placement = new LinkedHashMap<>();
        map(s.get("suggestion")).forEach((k, v) -> placement.put(k, UUID.fromString(String.valueOf(v))));
        assertThat(placement).isNotEmpty();
        assertFinished(modes.chess(ana, placement), "CHESS");
        assertThatThrownBy(() -> modes.chess(ana, Map.of())).isInstanceOf(ApiException.class);
        UUID one = placement.values().iterator().next();
        assertThatThrownBy(() -> modes.chess(ana, Map.of("TOP", one, "BOTTOM", one))).isInstanceOf(ApiException.class);
    }

    @Test
    void ultimateTeamSugereFuncoesSalvaEJoga() {
        Map<String, Object> u = modes.ultimate(ana);
        assertThat(u).containsKeys("roles", "roster", "team", "suggestion");
        assertFinished(modes.playUltimate(ana, null), "ULTIMATE");

        Map<String, UUID> roles = new LinkedHashMap<>();
        List<String> names = new ArrayList<>(FlairLooks.ROLES.keySet());
        for (int i = 0; i < Math.min(names.size(), looks.size()); i++) {
            roles.put(names.get(i), looks.get(i));
        }
        assertThat(modes.saveUltimate(ana, roles)).containsKey("roster");
        assertFinished(modes.playUltimate(ana, "bia"), "ULTIMATE");
        assertThatThrownBy(() -> modes.saveUltimate(ana, Map.of(names.get(0), looks.get(0), names.get(1), looks.get(0)))).isInstanceOf(ApiException.class);
    }

    /** Leitura do id de uma carta do FLAIR (record {@code FlairEngine.Card}) sem depender do tipo no teste. */
    private record FlairLooksCard(String id) {
        static FlairLooksCard of(Object card) {
            try {
                return new FlairLooksCard(String.valueOf(card.getClass().getMethod("id").invoke(card)));
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException(e);
            }
        }
    }
}
