package br.com.fashionai.web.controller;

import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.enums.HypeEntityType;
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

import java.time.Year;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FashionAI Momentos — o tempo da moda (docs/momentos/MOMENTOS.md). Leituras públicas (home, calendário, detalhe,
 * feed, ranking, trending) aceitam visitante: Momentos privados só aparecem para membros. Ações exigem sessão.
 */
@RestController
@Tag(name = "Momentos — o tempo da moda")
public class MomentController {
    private final MomentService moments;

    public MomentController(MomentService moments) {
        this.moments = moments;
    }

    @GetMapping("/api/moments")
    @Operation(summary = "Home dos Momentos: agora, próximos, destaque, resumo pessoal e grupo FLAIR")
    public Map<String, Object> home(CurrentUser user) {
        return moments.home(user);
    }

    @GetMapping("/api/moments/active")
    @Operation(summary = "Acontecendo agora (lista)")
    public Map<String, Object> active(CurrentUser user) {
        return moments.list(user, "ACTIVE", null);
    }

    @GetMapping("/api/moments/upcoming")
    @Operation(summary = "Próximos (agendados)")
    public Map<String, Object> upcoming(CurrentUser user) {
        return moments.list(user, "SCHEDULED", null);
    }

    @GetMapping("/api/moments/now")
    @Operation(summary = "Banner 'Agora no FashionAI' (nulo quando não há Momento relevante)")
    public Map<String, Object> now(CurrentUser user) {
        return moments.nowBanner(user);
    }

    @GetMapping("/api/moments/calendar")
    @Operation(summary = "Calendário anual/mensal no fuso pedido")
    public Map<String, Object> calendar(CurrentUser user, @RequestParam(required = false) Integer year, @RequestParam(required = false) Integer month,
                                        @RequestParam(required = false) String tz) {
        return moments.calendar(user, year == null ? Year.now().getValue() : year, month, tz);
    }

    @GetMapping("/api/me/moments")
    @Operation(summary = "Meus Momentos: salvos, em andamento, concluídos, badges")
    public Map<String, Object> mine(CurrentUser user) {
        return moments.mine(user);
    }

    @GetMapping("/api/me/moments/replay")
    @Operation(summary = "FashionAI Replay do ano")
    public Map<String, Object> replay(CurrentUser user, @RequestParam(required = false) Integer year) {
        return moments.replay(user, year == null ? Year.now().getValue() : year);
    }

    @GetMapping("/api/users/{userId}/moments")
    @Operation(summary = "Linha do tempo de Momentos de uma pessoa (respeita visibilidade)")
    public Map<String, Object> timeline(CurrentUser user, @PathVariable UUID userId) {
        return moments.timeline(user, userId);
    }

    @GetMapping("/api/moments/context/{type}/{id}")
    @Operation(summary = "MomentMatch e Hype contextual de uma peça/look nos Momentos ativos (verso do card)")
    public Map<String, Object> context(CurrentUser user, @PathVariable String type, @PathVariable UUID id) {
        HypeEntityType t = "PIECE".equalsIgnoreCase(type) ? HypeEntityType.PIECE : HypeEntityType.SCHEME;
        return moments.contextFor(user, t, id);
    }

    @GetMapping("/api/moments/{id}")
    @Operation(summary = "Detalhe do Momento (id ou slug)")
    public Map<String, Object> detail(CurrentUser user, @PathVariable String id) {
        return moments.detail(user, id);
    }

    @GetMapping("/api/moments/{id}/feed")
    public Map<String, Object> feed(CurrentUser user, @PathVariable String id) {
        return moments.feed(user, id);
    }

    @GetMapping("/api/moments/{id}/leaderboard")
    public Map<String, Object> leaderboard(CurrentUser user, @PathVariable String id) {
        return moments.leaderboard(user, id);
    }

    @GetMapping("/api/moments/{id}/trending")
    public Map<String, Object> trending(CurrentUser user, @PathVariable String id, @RequestParam(defaultValue = "8") int limit) {
        return moments.trending(user, id, Math.max(1, Math.min(20, limit)));
    }

    @GetMapping("/api/moments/{id}/looks")
    @Operation(summary = "Meus looks candidatos a envio")
    public List<Map<String, Object>> looks(CurrentUser user, @PathVariable String id) {
        return moments.candidateLooks(user, id);
    }

    public record SaveRequest(Boolean remind, UUID preparedSchemeId) {
    }

    @PutMapping("/api/moments/{id}/save")
    @Operation(summary = "Salvar no calendário / lembrar-me / preparar look")
    public Map<String, Object> save(CurrentUser user, @PathVariable String id, @RequestBody(required = false) SaveRequest body) {
        return moments.save(user, id, body == null ? Boolean.TRUE : body.remind(), body == null ? null : body.preparedSchemeId());
    }

    @DeleteMapping("/api/moments/{id}/save")
    public Map<String, Object> unsave(CurrentUser user, @PathVariable String id) {
        return moments.unsave(user, id);
    }

    @PostMapping("/api/moments/{id}/join")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Participar: abordagem (meu estilo/descoberta/experimental) e guarda-roupa")
    public Map<String, Object> join(CurrentUser user, @PathVariable String id, @RequestBody(required = false) MomentService.JoinRequest body) {
        return moments.join(user, id, body);
    }

    @PostMapping("/api/moments/{id}/leave")
    public Map<String, Object> leave(CurrentUser user, @PathVariable String id) {
        return moments.leave(user, id);
    }

    public record ProfileVisibilityRequest(boolean publicOnProfile) {
    }

    @PutMapping("/api/moments/{id}/profile-visibility")
    public Map<String, Object> profileVisibility(CurrentUser user, @PathVariable String id, @RequestBody ProfileVisibilityRequest body) {
        return moments.setProfileVisibility(user, id, body.publicOnProfile());
    }

    @PostMapping("/api/moments/{id}/preview")
    @Operation(summary = "MomentMatch + FAI Points previstos de um look (sem gravar)")
    public Map<String, Object> preview(CurrentUser user, @PathVariable String id, @RequestBody MomentService.SubmitRequest body) {
        return moments.preview(user, id, body);
    }

    @PostMapping("/api/moments/{id}/submit")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Enviar um look ao Momento (pontos idempotentes, conclusão e badge)")
    public Map<String, Object> submit(CurrentUser user, @PathVariable String id, @RequestBody MomentService.SubmitRequest body) {
        return moments.submit(user, id, body);
    }

    @PostMapping("/api/moments/{id}/votes")
    @Operation(summary = "Votar/desvotar numa dimensão (trend, elegante, criativo, original, tema)")
    public Map<String, Object> vote(CurrentUser user, @PathVariable String id, @RequestBody MomentService.VoteRequest body) {
        return moments.vote(user, id, body);
    }

    // ---------------------------------------------------------------- FLAIR — Momentos privados
    @GetMapping("/api/flair/groups/{groupId}/moments")
    @Operation(summary = "Calendário do grupo FLAIR: próximos, ativos e memórias")
    public Map<String, Object> groupMoments(CurrentUser user, @PathVariable UUID groupId) {
        return moments.groupMoments(user, groupId);
    }

    @PostMapping("/api/flair/groups/{groupId}/moments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Criar Momento privado do grupo")
    public Map<String, Object> createGroupMoment(CurrentUser user, @PathVariable UUID groupId, @RequestBody MomentService.GroupMomentRequest body) {
        return moments.createGroupMoment(user, groupId, body);
    }
}
