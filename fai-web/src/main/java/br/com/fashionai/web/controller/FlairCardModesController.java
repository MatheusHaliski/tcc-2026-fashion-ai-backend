package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairModesService;
import br.com.fashionai.web.controller.FlairModesController.OpponentRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FLAIR — modos montados carta a carta (Draft, Deck Battle, Chess e Ultimate Team): a pessoa escolhe peças/cartas uma a
 * uma (monte, mão, tabuleiro ou funções) em vez de inscrever looks prontos, que ficam em {@link FlairModesController}.
 * Mesma tag do OpenAPI e mesmo serviço dos demais modos.
 */
@RestController
@Tag(name = "FLAIR — modos (Battle, Squad, League, World Tour, Conquest, Deck Battle e eventos especiais)")
public class FlairCardModesController {
    private final FlairModesService modes;

    public FlairCardModesController(FlairModesService modes) {
        this.modes = modes;
    }

    public record PickRequest(UUID pieceId) {
    }

    public record DraftLooksRequest(List<List<UUID>> looks) {
    }

    public record CardsRequest(List<UUID> pieceIds) {
    }

    public record BoardRequest(Map<String, UUID> board) {
    }

    public record RolesRequest(Map<String, UUID> roles) {
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
