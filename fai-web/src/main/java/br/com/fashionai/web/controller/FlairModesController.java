package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairModesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** FLAIR — modos de jogo sobre peças (cartas), looks e times: PEÇA → CARD → LOOK → TEAM/DECK → COMPETIÇÃO. */
@RestController
@Tag(name = "FLAIR — modos (Battle, Squad, League, World Tour, Conquest, Deck Battle e eventos especiais)")
public class FlairModesController {
    private final FlairModesService modes;

    public FlairModesController(FlairModesService modes) {
        this.modes = modes;
    }

    public record LookRequest(UUID schemeId, String opponent, String theme) {
    }

    public record LooksRequest(List<UUID> schemeIds, String opponent) {
    }

    public record RosterRequest(List<UUID> starters, List<UUID> reserves, List<UUID> specials) {
    }

    public record PickRequest(UUID pieceId) {
    }

    public record DraftLooksRequest(List<List<UUID>> looks) {
    }

    public record CardsRequest(List<UUID> pieceIds) {
    }

    public record TagRequest(UUID schemeId, String partner, List<String> opponents) {
    }

    public record OpponentRequest(String opponent) {
    }

    public record BoardRequest(Map<String, UUID> board) {
    }

    public record RolesRequest(Map<String, UUID> roles) {
    }

    @GetMapping("/api/flair/modes")
    @Operation(summary = "FLAIR — catálogo dos modos, temas, atributos, tabuleiro, territórios, bosses e funções")
    public Map<String, Object> catalog() {
        return modes.catalog();
    }

    @GetMapping("/api/flair/modes/looks")
    @Operation(summary = "FLAIR — meus looks com os 10 atributos (HypeScore, Style, Color Harmony, Occasion Fit…) e sinergias")
    public Map<String, Object> looks(CurrentUser user) {
        return modes.myLooks(user);
    }

    @GetMapping("/api/flair/modes/trophies")
    @Operation(summary = "FLAIR — troféus de um usuário (Runway Winner, divisão da liga, territórios, bosses…)")
    public List<Map<String, Object>> trophies(CurrentUser user, @RequestParam(required = false) UUID userId) {
        return modes.trophiesOf(userId == null ? user.id() : userId);
    }

    @PostMapping("/api/flair/modes/battle")
    @Operation(summary = "Battle of Looks — Look × Look com tema sorteado (o contexto muda os pesos)")
    public Map<String, Object> battle(CurrentUser user, @RequestBody LookRequest body) {
        return modes.battle(user, body.schemeId(), body.opponent(), body.theme());
    }

    @PostMapping("/api/flair/modes/squad")
    @Operation(summary = "FLAIR Squad — 5 looks × 5 looks em Date Night, Business Meeting, Music Festival, Beach Club e Red Carpet")
    public Map<String, Object> squad(CurrentUser user, @RequestBody LooksRequest body) {
        return modes.squad(user, body.schemeIds(), body.opponent());
    }

    @GetMapping("/api/flair/modes/league")
    @Operation(summary = "Fashion League — tabela da temporada, divisão e meu elenco")
    public Map<String, Object> league(CurrentUser user) {
        return modes.league(user);
    }

    @PutMapping("/api/flair/modes/league/roster")
    @Operation(summary = "Fashion League — elenco: 5 titulares, 3 reservas e 5 cartas especiais")
    public Map<String, Object> roster(CurrentUser user, @RequestBody RosterRequest body) {
        return modes.saveRoster(user, body.starters(), body.reserves(), body.specials());
    }

    @PostMapping("/api/flair/modes/league/play")
    @Operation(summary = "Fashion League — joga a próxima rodada (até 3 por dia)")
    public Map<String, Object> playLeague(CurrentUser user) {
        return modes.playLeague(user);
    }

    @GetMapping("/api/flair/modes/runway")
    @Operation(summary = "FLAIR Runway — tema da semana e minha participação")
    public Map<String, Object> runway(CurrentUser user) {
        return modes.runway(user);
    }

    @PostMapping("/api/flair/modes/runway")
    @Operation(summary = "FLAIR Runway — desfila um look: qualificação → semifinal → final")
    public Map<String, Object> enterRunway(CurrentUser user, @RequestBody LookRequest body) {
        return modes.enterRunway(user, body.schemeId());
    }

    @GetMapping("/api/flair/modes/tour")
    @Operation(summary = "Fashion World Tour — tabuleiro Paris → São Paulo e minha posição")
    public Map<String, Object> tour(CurrentUser user) {
        return modes.tour(user);
    }

    @PostMapping("/api/flair/modes/tour/roll")
    @Operation(summary = "Fashion World Tour — rola o dado")
    public Map<String, Object> roll(CurrentUser user) {
        return modes.roll(user);
    }

    @PostMapping("/api/flair/modes/tour/resolve")
    @Operation(summary = "Fashion World Tour — cumpre o desafio da casa com um look")
    public Map<String, Object> resolve(CurrentUser user, @RequestBody LookRequest body) {
        return modes.resolveTour(user, body.schemeId());
    }

    @GetMapping("/api/flair/modes/territories")
    @Operation(summary = "Fashion Monopoly (map=MONOPOLY) e FLAIR Conquest (map=CONQUEST) — territórios e donos")
    public Map<String, Object> territories(CurrentUser user, @RequestParam(defaultValue = "CONQUEST") String map) {
        return modes.territories(user, map);
    }

    @PostMapping("/api/flair/modes/territories/{map}/{code}/attack")
    @Operation(summary = "Ataca um distrito (1 look) ou região (3 looks)")
    public Map<String, Object> attack(CurrentUser user, @PathVariable String map, @PathVariable String code, @RequestBody LooksRequest body) {
        return modes.attack(user, map, code, body.schemeIds());
    }

    @PostMapping("/api/flair/modes/draft")
    @Operation(summary = "FLAIR Draft — abre um monte de 20 peças (escolha em serpente contra a IA)")
    public Map<String, Object> draftStart(CurrentUser user) {
        return modes.draftStart(user);
    }

    @PostMapping("/api/flair/modes/draft/{id}/pick")
    @Operation(summary = "FLAIR Draft — escolhe uma peça (a IA responde na vez dela)")
    public Map<String, Object> draftPick(CurrentUser user, @PathVariable UUID id, @RequestBody PickRequest body) {
        return modes.draftPick(user, id, body.pieceId());
    }

    @PostMapping("/api/flair/modes/draft/{id}/looks")
    @Operation(summary = "FLAIR Draft — envia os 3 looks montados com as escolhas: 3 confrontos")
    public Map<String, Object> draftFinish(CurrentUser user, @PathVariable UUID id, @RequestBody DraftLooksRequest body) {
        return modes.draftFinish(user, id, body.looks());
    }

    @GetMapping("/api/flair/modes/deck")
    @Operation(summary = "Deck Battle — meu deck de 12 cartas (e uma sugestão)")
    public Map<String, Object> deck(CurrentUser user) {
        return modes.deck(user);
    }

    @PutMapping("/api/flair/modes/deck")
    @Operation(summary = "Deck Battle — salva o deck: 4 superiores, 3 inferiores, 2 calçados, 2 acessórios e 1 curinga")
    public Map<String, Object> saveDeck(CurrentUser user, @RequestBody CardsRequest body) {
        return modes.saveDeck(user, body.pieceIds());
    }

    @PostMapping("/api/flair/modes/deck/battle")
    @Operation(summary = "Deck Battle — sorteia o desafio e distribui 7 cartas")
    public Map<String, Object> deckStart(CurrentUser user) {
        return modes.deckStart(user);
    }

    @PostMapping("/api/flair/modes/deck/battle/{id}/play")
    @Operation(summary = "Deck Battle — joga o look montado com a mão")
    public Map<String, Object> deckPlay(CurrentUser user, @PathVariable UUID id, @RequestBody CardsRequest body) {
        return modes.deckPlay(user, id, body.pieceIds());
    }

    @PostMapping("/api/flair/modes/combo")
    @Operation(summary = "Combo Battle — as sinergias entre peças decidem")
    public Map<String, Object> combo(CurrentUser user, @RequestBody LookRequest body) {
        return modes.combo(user, body.schemeId(), body.opponent());
    }

    @PostMapping("/api/flair/modes/tag-team")
    @Operation(summary = "FLAIR Tag Team — dupla × dupla, com Team Harmony")
    public Map<String, Object> tagTeam(CurrentUser user, @RequestBody TagRequest body) {
        return modes.tagTeam(user, body.schemeId(), body.partner(), body.opponents());
    }

    @PostMapping("/api/flair/modes/bosses/{code}")
    @Operation(summary = "Fashion Boss — enfrenta um chefe da IA com 1 a 3 looks")
    public Map<String, Object> boss(CurrentUser user, @PathVariable String code, @RequestBody LooksRequest body) {
        return modes.fightBoss(user, code, body.schemeIds());
    }

    @PostMapping("/api/flair/modes/wardrobe-wars")
    @Operation(summary = "Wardrobe Wars — guarda-roupa × guarda-roupa em 7 categorias")
    public Map<String, Object> wardrobeWars(CurrentUser user, @RequestBody OpponentRequest body) {
        return modes.wardrobeWars(user, body.opponent());
    }

    @GetMapping("/api/flair/modes/chess")
    @Operation(summary = "FLAIR Chess — posições do tabuleiro, minhas cartas e uma sugestão")
    public Map<String, Object> chessSuggest(CurrentUser user) {
        return modes.chessSuggest(user);
    }

    @PostMapping("/api/flair/modes/chess")
    @Operation(summary = "FLAIR Chess — joga o tabuleiro 3×3 contra a IA")
    public Map<String, Object> chess(CurrentUser user, @RequestBody BoardRequest body) {
        return modes.chess(user, body.board());
    }

    @GetMapping("/api/flair/modes/ultimate")
    @Operation(summary = "FLAIR Ultimate Team — elenco por função e Team Rating")
    public Map<String, Object> ultimate(CurrentUser user) {
        return modes.ultimate(user);
    }

    @PutMapping("/api/flair/modes/ultimate")
    @Operation(summary = "FLAIR Ultimate Team — salva as 7 funções")
    public Map<String, Object> saveUltimate(CurrentUser user, @RequestBody RolesRequest body) {
        return modes.saveUltimate(user, body.roles());
    }

    @PostMapping("/api/flair/modes/ultimate/play")
    @Operation(summary = "FLAIR Ultimate Team — partida função × função (Chemistry desempata)")
    public Map<String, Object> playUltimate(CurrentUser user, @RequestBody OpponentRequest body) {
        return modes.playUltimate(user, body.opponent());
    }
}
