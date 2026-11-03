package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairModeState;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairModeStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * Caracterização do contrato do {@link FlairModesService} antes de virar Facade: catálogo estático (modos, tabuleiro do
 * World Tour, territórios) congelado por digest, códigos de erro das validações de cada modo e o formato do que fica
 * gravado (estado do elenco, partida aberta do Draft/Deck, histórico com recompensa).
 */
class FlairModesFacadeCharacterizationTest {
    private Kit kit;
    private World world;
    private FlairModesService modes;
    private CurrentUser ana;
    private List<UUID> looks;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        kit.atelier();
        kit.real(FlairService.class);
        modes = kit.build(FlairModesService.class);
        ana = Kit.as(world.me);
        looks = world.lookIds(world.me);
    }

    private static String sha(Object o) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(Json.write(o).getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(d);
    }

    private static String code(Executable call) {
        Throwable t = catchThrowable(call::execute);
        assertThat(t).isInstanceOf(ApiException.class);
        return ((ApiException) t).status() + ":" + ((ApiException) t).code();
    }

    @Test
    void catalogoETabelasEstaticasNaoMudam() throws Exception {
        assertThat(FlairModesService.MODES).hasSize(15);
        assertThat(FlairModesService.BOARD).hasSize(28);
        assertThat(FlairModesService.TERRITORIES).hasSize(15);
        assertThat(FlairModesService.CITIES).hasSize(7);
        assertThat(FlairModesService.COMPETITIVE).hasSize(10);
        assertThat(FlairModesService.DECK_RULE).containsEntry("upper_piece", 4).containsEntry("wildcard", 1);
        assertThat(FlairModesService.RUNWAY_THEMES).hasSize(6);
        assertThat(sha(FlairModesService.MODES)).isEqualTo("4a5b18ea8fa99586e987dd84996e426bd9414bf0360dc9124821f96dc9d0251e");
        assertThat(sha(FlairModesService.BOARD)).isEqualTo("945164fc4071bbd7f0edf82c3509b465f1ea993fa6ef69cfc61ee76deadba15f");
        assertThat(sha(FlairModesService.TERRITORIES)).isEqualTo("304b0b8cd15c44f9a7491bc2ccd15a0212c86f9b90b1211521802b667afc3e37");
        Map<String, Object> c = modes.catalog();
        // Map.of/Set.of do motor iteram em ordem aleatória por JVM: o digest cobre só as partes de ordem estável
        assertThat(sha(List.of(c.get("architecture"), c.get("modes"), c.get("board"), c.get("territories"),
                c.get("chessBoard"), c.get("ethics")))).isEqualTo("d28721a31f8524e82cb5e41ac7c580fdce32350e0ad293ff2610a9c05fb0b858");
        assertThat(c.keySet()).containsExactly("architecture", "modes", "stats", "themes", "squadSituations", "divisions", "bosses", "board",
                "territories", "chessBoard", "roles", "ethics");
        assertThat(FlairModesService.territory("CONQUEST", "LUXURY").theme()).isEqualTo("RED_CARPET");
        assertThat(code(() -> FlairModesService.territory("CONQUEST", "HARAJUKU"))).isEqualTo("404:NAO_ENCONTRADO");
        assertThat(FlairModesService.BOARD.get(3).type()).isEqualTo("AIRPORT");
        assertThat(FlairModesService.BOARD.get(27).theme()).isEqualTo("WEDDING_GUEST");
    }

    @Test
    void utilitariosPurosDoServico() {
        assertThat(FlairModesService.house(null)).isTrue();
        assertThat(FlairModesService.house(" casa ")).isTrue();
        assertThat(FlairModesService.house("bia")).isFalse();
        assertThat(FlairModesService.num(3.7)).isEqualTo(3);
        assertThat(FlairModesService.num("x")).isZero();
        assertThat(FlairModesService.stylePoints(Map.of("hype", 9))).isEqualTo(9);
        assertThat(FlairModesService.stylePoints(Map.of("hype", 9, "stylePoints", 4))).isEqualTo(4);
        UUID u = UUID.randomUUID();
        assertThat(FlairModesService.ids(List.of(u.toString(), "", "  "))).containsExactly(u);
        assertThat(FlairModesService.ids("nada")).isEmpty();
        assertThat(FlairModesService.seasonKey()).matches("\\d{4}-T\\d{2}");
        assertThat(FlairModesService.weekKey()).matches("\\d{4}-W\\d{2}");
        assertThat(FlairModesService.runwaySeason()).matches("\\d{2}");
        assertThat(FlairModesService.RUNWAY_THEMES).contains(FlairModesService.runwayTheme().code());
    }

    @Test
    void codigosDeErroDasValidacoes() {
        assertThat(code(() -> modes.battle(ana, looks.get(0), "ana", null))).isEqualTo("400:OPONENTE_INVALIDO");
        assertThat(code(() -> modes.saveRoster(ana, List.of(), null, null))).isEqualTo("400:ELENCO_INVALIDO");
        assertThat(code(() -> modes.playLeague(ana))).isEqualTo("409:SEM_ELENCO");
        assertThat(code(() -> modes.resolveTour(ana, looks.get(0)))).isEqualTo("409:SEM_DESAFIO");
        assertThat(code(() -> modes.attack(ana, "CONQUEST", "LUXURY", looks.subList(0, 1)))).isEqualTo("400:LOOKS_INVALIDOS");
        assertThat(code(() -> modes.attack(ana, "MONOPOLY", "NADA", looks.subList(0, 1)))).isEqualTo("404:NAO_ENCONTRADO");
        assertThat(code(() -> modes.saveDeck(ana, List.of()))).isEqualTo("400:DECK_INVALIDO");
        assertThat(code(() -> modes.deckStart(ana))).isEqualTo("409:SEM_DECK");
        assertThat(code(() -> modes.fightBoss(ana, null, looks))).isEqualTo("404:NAO_ENCONTRADO");
        assertThat(code(() -> modes.chess(ana, null))).isEqualTo("400:TABULEIRO_VAZIO");
        assertThat(code(() -> modes.saveUltimate(ana, Map.of("ICON", looks.get(0), "TREND", looks.get(0))))).isEqualTo("400:LOOK_REPETIDO");
        assertThat(code(() -> modes.draftPick(ana, UUID.randomUUID(), UUID.randomUUID()))).isEqualTo("404:NAO_ENCONTRADO");
        assertThat(code(() -> modes.wardrobeWars(ana, "ninguem"))).isEqualTo("404:NAO_ENCONTRADO");
        assertThat(code(() -> modes.tagTeam(ana, looks.get(0), "ana", null))).isEqualTo("400:OPONENTE_INVALIDO");
    }

    @Test
    void elencoDaLigaGravaOEstadoNoFormatoEsperado() {
        modes.saveRoster(ana, looks.subList(0, 2), List.of(looks.get(2)), null);
        List<FlairModeState> rows = MemoryRepository.rows(kit.dep(FlairModeStateRepository.class));
        FlairModeState s = rows.stream().filter(x -> "LEAGUE".equals(x.getMode())).findFirst().orElseThrow();
        assertThat(s.getSeasonKey()).isEqualTo(FlairModesService.seasonKey());
        Map<String, Object> st = Json.map(s.getStateJson());
        assertThat(st.keySet()).containsExactlyInAnyOrder("starters", "reserves", "specials", "played", "wins", "draws", "losses", "points", "stylePoints");
        Map<String, Object> league = modes.league(ana);
        assertThat(league.keySet()).containsExactly("season", "table", "roster", "division", "rule");
        Map<String, Object> row = World.map(((List<?>) league.get("table")).get(0));
        assertThat(row.keySet()).containsExactly("user", "played", "wins", "draws", "losses", "points", "stylePoints", "hype", "division", "you", "position");
    }

    @Test
    void partidasAbertasEResultadoGravado() {
        Map<String, Object> d = modes.draftStart(ana);
        assertThat(d.keySet()).containsExactly("id", "status", "pool", "mine", "theirs", "pick", "turn", "order", "themes");
        FlairMatch m = kit.dep(FlairMatchRepository.class).findById((UUID) d.get("id")).orElseThrow();
        assertThat(m.getMode()).isEqualTo("DRAFT");
        assertThat(m.getStatus()).isEqualTo("OPEN");
        assertThat(Json.map(m.getResultJson()).keySet()).containsExactlyInAnyOrder("pool", "A", "B", "pick", "themes");

        Map<String, Object> r = modes.battle(ana, looks.get(0), null, "RED_CARPET");
        assertThat(r.keySet()).containsExactly("theme", "me", "opponent", "rounds", "scoreA", "scoreB", "matchId", "mode", "outcome", "coins",
                "rewardCapReached", "faiPoints");
        int expectedCoins = switch (String.valueOf(r.get("outcome"))) {
            case "WIN" -> 20;
            case "DRAW" -> 8;
            default -> 3;
        };
        assertThat(r.get("coins")).isEqualTo(expectedCoins);
        FlairMatch done = kit.dep(FlairMatchRepository.class).findById((UUID) r.get("matchId")).orElseThrow();
        assertThat(done.getStatus()).isEqualTo("FINISHED");
        assertThat(done.getTheme()).isNotBlank();

        Map<String, Object> tour = modes.tour(ana);
        assertThat(tour.keySet()).containsExactly("season", "board", "cities", "position", "lap", "points", "pending", "lastRoll", "log", "rollsLeft", "rule");
        assertThat(modes.runway(ana).keySet()).containsExactly("theme", "week", "season", "rule", "entry");
        assertThat(modes.territories(ana, "conquest").keySet()).containsExactly("map", "territories", "mine", "rule");
        assertThat(modes.deck(ana).keySet()).containsExactly("cards", "rule", "valid", "suggestion");
        assertThat(modes.ultimate(ana).keySet()).containsExactly("roles", "roster", "team", "suggestion", "roleHelp");
        assertThat(modes.chessSuggest(ana).keySet()).containsExactly("slots", "cards", "suggestion", "preview", "rules");
    }
}
