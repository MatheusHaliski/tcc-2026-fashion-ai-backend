package br.com.fashionai.web.controller;

import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** FLAIR — jogo de cartas com as peças (cartas) e os esquemas (decks); combinações das lojas trocadas por cupons. */
@RestController
@Tag(name = "FLAIR — jogo de cartas, duelos, equipes e cupons das lojas")
public class FlairController {
    private final FlairService flair;

    public FlairController(FlairService flair) {
        this.flair = flair;
    }

    public record DuelRequest(UUID schemeId, String opponent) {
    }

    public record ArenaRequest(UUID schemeId) {
    }

    public record TeamRequest(String name, String color) {
    }

    public record CodeRequest(String code) {
    }

    @GetMapping("/api/flair/me")
    @Operation(summary = "FLAIR — coins, rank, skins, equipe e histórico do jogador")
    public Map<String, Object> me(CurrentUser user) {
        return flair.me(user);
    }

    @GetMapping("/api/flair/cards")
    @Operation(summary = "FLAIR — cartas (uma por peça) e álbum de raridades por categoria")
    public Map<String, Object> cards(CurrentUser user) {
        return flair.cards(user);
    }

    @GetMapping("/api/flair/decks")
    @Operation(summary = "FLAIR — decks (um por esquema), com combos, multiplicador de marca e poder")
    public List<FlairEngine.Deck> decks(CurrentUser user) {
        return flair.decks(user);
    }

    @GetMapping("/api/flair/decks/{schemeId}")
    @Operation(summary = "FLAIR — deck de um esquema visível")
    public FlairEngine.Deck deck(CurrentUser user, @PathVariable UUID schemeId) {
        return flair.deckOf(user, schemeId);
    }

    @GetMapping("/api/flair/quests")
    @Operation(summary = "FLAIR — quests diárias e semanais com progresso")
    public List<Map<String, Object>> quests(CurrentUser user) {
        return flair.quests(user);
    }

    @PostMapping("/api/flair/quests/{code}/claim")
    @Operation(summary = "FLAIR — resgata a recompensa de uma quest cumprida (uma vez por período)")
    public Map<String, Object> claim(CurrentUser user, @PathVariable String code) {
        return flair.claimQuest(user, code);
    }

    @PostMapping("/api/flair/duels")
    @Operation(summary = "FLAIR — duelo de estilo 1×1 (5 rodadas) contra @usuário ou contra a Casa (treino)")
    public Map<String, Object> duel(CurrentUser user, @RequestBody DuelRequest body) {
        return flair.duel(user, body.schemeId(), body.opponent());
    }

    @GetMapping("/api/flair/arena")
    @Operation(summary = "FLAIR — batalha de ocasião do dia (tema igual para todos) e placar")
    public Map<String, Object> arena(CurrentUser user) {
        return flair.arena(user);
    }

    @PostMapping("/api/flair/arena")
    @Operation(summary = "FLAIR — inscreve um deck na batalha do dia (um por pessoa por dia)")
    public Map<String, Object> joinArena(CurrentUser user, @RequestBody ArenaRequest body) {
        return flair.joinArena(user, body.schemeId());
    }

    @GetMapping("/api/flair/teams")
    @Operation(summary = "FLAIR — liga de equipes, ranking de jogadores e batalhas da minha equipe")
    public Map<String, Object> league(CurrentUser user) {
        return flair.league(user);
    }

    @PostMapping("/api/flair/teams")
    @Operation(summary = "FLAIR — cria uma equipe (até 5 integrantes) e gera o código de convite")
    public Map<String, Object> createTeam(CurrentUser user, @RequestBody TeamRequest body) {
        return flair.createTeam(user, body.name(), body.color());
    }

    @PostMapping("/api/flair/teams/join")
    @Operation(summary = "FLAIR — entra numa equipe pelo código")
    public Map<String, Object> joinTeam(CurrentUser user, @RequestBody CodeRequest body) {
        return flair.joinTeam(user, body.code());
    }

    @DeleteMapping("/api/flair/teams/me")
    @Operation(summary = "FLAIR — sai da equipe (a última pessoa a sair encerra a equipe)")
    public Map<String, Object> leaveTeam(CurrentUser user) {
        return flair.leaveTeam(user);
    }

    @PostMapping("/api/flair/teams/battles")
    @Operation(summary = "FLAIR — duelo de equipes 3×3 contra o código de outra equipe (uma vez por dia por par)")
    public Map<String, Object> teamBattle(CurrentUser user, @RequestBody CodeRequest body) {
        return flair.teamBattle(user, body.code());
    }

    @GetMapping("/api/flair/combinations")
    @Operation(summary = "FLAIR — combinações ativas das lojas participantes, com o melhor deck e o checklist")
    public List<Map<String, Object>> combinations(CurrentUser user) {
        return flair.combinationsFor(user);
    }

    @GetMapping("/api/flair/combinations/{id}/check")
    @Operation(summary = "FLAIR — confere um deck contra os requisitos de uma combinação")
    public Map<String, Object> check(CurrentUser user, @PathVariable UUID id, @RequestParam(required = false) UUID schemeId) {
        return flair.checkCombination(user, id, schemeId);
    }

    @PostMapping("/api/flair/combinations/{id}/redeem")
    @Operation(summary = "FLAIR — troca o deck que completa a combinação pelo cupom da loja")
    public Map<String, Object> redeem(CurrentUser user, @PathVariable UUID id, @RequestParam(required = false) UUID schemeId) {
        return flair.redeem(user, id, schemeId);
    }

    @GetMapping("/api/flair/vouchers")
    @Operation(summary = "FLAIR — carteira de cupons do jogador")
    public List<Map<String, Object>> vouchers(CurrentUser user) {
        return flair.vouchers(user);
    }

    @PostMapping("/api/flair/skins/{skin}")
    @Operation(summary = "FLAIR — compra (com coins) e ativa uma skin cosmética de carta")
    public Map<String, Object> skin(CurrentUser user, @PathVariable String skin, @RequestParam(defaultValue = "true") boolean activate) {
        return flair.buySkin(user, skin, activate);
    }

    @GetMapping("/api/institutional/{slug}/flair")
    @Operation(summary = "RF14/RF22 — aba \"Minhas combinações FLAIR\" (dono) ou \"Combinações FLAIR\" (visitante)")
    public Map<String, Object> brandTab(CurrentUser viewer, @PathVariable String slug) {
        return flair.brandTab(viewer, slug);
    }

    @PostMapping("/api/flair/brand/combinations")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "FLAIR — a loja cria uma combinação (requisitos + cupom)")
    public Map<String, Object> create(CurrentUser user, @RequestBody FlairService.CombinationForm body) {
        return flair.saveCombination(user, null, body);
    }

    @PutMapping("/api/flair/brand/combinations/{id}")
    @Operation(summary = "FLAIR — a loja edita uma combinação")
    public Map<String, Object> update(CurrentUser user, @PathVariable UUID id, @RequestBody FlairService.CombinationForm body) {
        return flair.saveCombination(user, id, body);
    }

    @DeleteMapping("/api/flair/brand/combinations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "FLAIR — a loja remove a combinação (com cupons emitidos, só desativa)")
    public void delete(CurrentUser user, @PathVariable UUID id) {
        flair.deleteCombination(user, id);
    }

    @PostMapping("/api/flair/brand/redemptions/validate")
    @Operation(summary = "FLAIR — no caixa, a loja confere o código do cupom e marca como usado")
    public Map<String, Object> validate(CurrentUser user, @RequestBody CodeRequest body) {
        return flair.validateCode(user, body.code());
    }
}
