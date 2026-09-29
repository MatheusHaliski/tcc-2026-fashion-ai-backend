package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ChallengeService;
import br.com.fashionai.web.support.Uploads;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF36 — Desafios e games")
public class ChallengeController {
    private final ChallengeService challenges;

    public ChallengeController(ChallengeService challenges) {
        this.challenges = challenges;
    }

    @GetMapping("/api/challenges/catalog")
    @Operation(summary = "RF36.CA01 — Catálogo de desafios com elegibilidade")
    public Map<String, Object> catalog(CurrentUser user) {
        return challenges.catalog(user);
    }

    @GetMapping("/api/me/challenges")
    @Operation(summary = "RF36 — Meus desafios (ativos, convites, concluídos)")
    public Map<String, Object> mine(CurrentUser user) {
        return challenges.mine(user);
    }

    @PostMapping("/api/challenges")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF36.CA02 — Iniciar desafio (solo, duelo, grupo, equipes)")
    public Map<String, Object> start(CurrentUser user, @RequestBody ChallengeService.StartRequest body) {
        return challenges.start(user, body);
    }

    public record LaunchRequest(List<UUID> invitees, Map<String, String> teams) {
    }

    @PostMapping("/api/challenges/{id}/launch")
    @Operation(summary = "RF36.CA02 — Lançar rascunho com convidados/equipes")
    public Map<String, Object> launch(CurrentUser user, @PathVariable UUID id, @RequestBody LaunchRequest body) {
        return challenges.launchDraft(user, id, body.invitees(), body.teams());
    }

    public record AcceptRequest(Boolean photoConsent) {
    }

    @PostMapping("/api/challenges/{id}/accept")
    @Operation(summary = "RF36.CA03 — Aceitar convite")
    public Map<String, Object> accept(CurrentUser user, @PathVariable UUID id, @RequestBody(required = false) AcceptRequest body) {
        return challenges.accept(user, id, body == null ? null : body.photoConsent());
    }

    @PostMapping("/api/challenges/{id}/decline")
    @Operation(summary = "RF36.CA03 — Recusar convite")
    public Map<String, Object> decline(CurrentUser user, @PathVariable UUID id) {
        return challenges.decline(user, id);
    }

    @PostMapping("/api/challenges/{id}/start")
    @Operation(summary = "RF36 — Começar agora (sem esperar todos aceitarem)")
    public Map<String, Object> startNow(CurrentUser user, @PathVariable UUID id) {
        return challenges.startNow(user, id);
    }

    @PostMapping("/api/challenges/{id}/leave")
    @Operation(summary = "RF36 — Sair do desafio")
    public Map<String, Object> leave(CurrentUser user, @PathVariable UUID id) {
        return challenges.leave(user, id);
    }

    @PostMapping("/api/challenges/{id}/cancel")
    @Operation(summary = "RF36 — Cancelar (criador)")
    public Map<String, Object> cancel(CurrentUser user, @PathVariable UUID id) {
        return challenges.cancel(user, id);
    }

    @GetMapping("/api/challenges/{id}")
    @Operation(summary = "RF36.CA04 — Detalhe: progresso, participantes, feed do desafio")
    public Map<String, Object> detail(CurrentUser user, @PathVariable UUID id) {
        return challenges.detail(user, id);
    }

    public record EntryRequest(@NotNull UUID schemeId) {
    }

    @PostMapping("/api/challenges/{id}/entries")
    @Operation(summary = "RF36.CA05 — Enviar look como entrada")
    public Map<String, Object> submitEntry(CurrentUser user, @PathVariable UUID id, @RequestBody EntryRequest body) {
        return challenges.submitEntry(user, id, body.schemeId());
    }

    @GetMapping("/api/challenges/votes")
    @Operation(summary = "RF36.CA06 — Feed de votação")
    public List<Map<String, Object>> voteFeed(CurrentUser user) {
        return challenges.voteFeed(user);
    }

    public record VoteRequest(@NotNull UUID entrySchemeId) {
    }

    @PostMapping("/api/challenges/{id}/votes")
    @Operation(summary = "RF36.CA06 — Votar em uma entrada")
    public Map<String, Object> vote(CurrentUser user, @PathVariable UUID id, @RequestBody VoteRequest body) {
        return challenges.vote(user, id, body.entrySchemeId());
    }

    public record NoteRequest(String preset, String free) {
    }

    @PostMapping("/api/challenges/{id}/notes")
    @Operation(summary = "RF36.CA07 — Recado no mural do desafio")
    public Map<String, Object> note(CurrentUser user, @PathVariable UUID id, @RequestBody NoteRequest body) {
        return challenges.note(user, id, body.preset(), body.free());
    }

    public record ReactionRequest(String emoji) {
    }

    @PostMapping("/api/challenges/{id}/reactions")
    @Operation(summary = "RF36.CA07 — Reagir com emoji")
    public Map<String, Object> react(CurrentUser user, @PathVariable UUID id, @RequestBody ReactionRequest body) {
        return challenges.react(user, id, body.emoji());
    }

    @PostMapping(value = "/api/challenges/{id}/real-mirror", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF36.CA08 — Foto no espelho real como evidência")
    public Map<String, Object> realMirror(CurrentUser user, @PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return challenges.realMirror(user, id, Uploads.image(file));
    }

    @GetMapping("/api/challenges/{id}/mirror-photos/{photoId}")
    @Operation(summary = "RF36.CA08 / ETI-05 — Foto do Espelho de Verdade: só o autor, colegas com o consentimento dele ou admin")
    public ResponseEntity<byte[]> mirrorPhoto(CurrentUser user, @PathVariable UUID id, @PathVariable UUID photoId) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.noStore().cachePrivate())            // foto privada: nada de cache compartilhado
                .body(challenges.mirrorPhoto(user, id, photoId));
    }

    public record ConfirmRequest(@NotNull UUID memberId, @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day) {
    }

    @PostMapping("/api/challenges/{id}/real-mirror/confirmations")
    @Operation(summary = "RF36.CA08 — Confirmar evidência de outro participante")
    public Map<String, Object> confirmRealMirror(CurrentUser user, @PathVariable UUID id, @RequestBody ConfirmRequest body) {
        return challenges.confirmRealMirror(user, id, body.memberId(), body.day());
    }

    @GetMapping("/api/challenges/{id}/result-card")
    @Operation(summary = "RF36.CA09 — Card de resultado")
    public Map<String, Object> resultCard(CurrentUser user, @PathVariable UUID id) {
        return challenges.resultCard(user, id);
    }

    @PostMapping("/api/challenges/proposals")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF36.CA10 — Propor um novo desafio para a comunidade")
    public Map<String, Object> propose(CurrentUser user, @RequestBody ChallengeService.ProposalRequest body) {
        return challenges.propose(user, body);
    }
}
