package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairChallengeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
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

/** FLAIR-UT F5 · §14 — Desafios de Montagem (Card Building Challenges) dentro dos Momentos. */
@RestController
@Tag(name = "FLAIR-UT — Desafios de Montagem (cartas FLAIR nos Momentos)")
public class FlairChallengeController {
    private final FlairChallengeService service;

    public FlairChallengeController(FlairChallengeService service) {
        this.service = service;
    }

    @GetMapping("/api/flair/challenges")
    @Operation(summary = "Agora, Em breve, Sempre, Grupos e Memórias (com moment=slug, só os desafios daquele Momento)")
    public Map<String, Object> list(CurrentUser viewer, @RequestParam(required = false) String moment) {
        return service.list(viewer, moment);
    }

    @GetMapping("/api/flair/challenges/{idOrSlug}")
    @Operation(summary = "Detalhe: cenário, vagas, requisitos, leituras do Momento, janela, minhas entregas, comunidade e Memória")
    public Map<String, Object> detail(CurrentUser viewer, @PathVariable String idOrSlug) {
        return service.detail(viewer, idOrSlug);
    }

    @PostMapping("/api/flair/challenges/{idOrSlug}/check")
    @Operation(summary = "Confere a montagem (requisitos, sintonia, história e pontos previstos) sem gravar")
    public Map<String, Object> check(CurrentUser user, @PathVariable String idOrSlug, @RequestBody FlairChallengeService.BuildRequest body) {
        return service.check(user, idOrSlug, body);
    }

    @PostMapping("/api/flair/challenges/{idOrSlug}/submit")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Entrega atômica: valida, bloqueia as cartas como memória, grava a história e lança os pontos")
    public Map<String, Object> submit(CurrentUser user, @PathVariable String idOrSlug, @RequestBody FlairChallengeService.BuildRequest body) {
        return service.submit(user, idOrSlug, body);
    }

    @PostMapping("/api/flair/moments/{momentId}/challenges")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Momento privado de grupo: quem criou adiciona um desafio a partir de um modelo oficial")
    public Map<String, Object> addToMoment(CurrentUser user, @PathVariable UUID momentId, @RequestBody FlairChallengeService.PrivateChallengeRequest body) {
        return service.addToPrivateMoment(user, momentId, body);
    }

    @GetMapping("/api/admin/flair/challenges")
    @Operation(summary = "Administração: todos os desafios (rascunhos, ativos e arquivados)")
    public List<Map<String, Object>> adminList(CurrentUser admin) {
        return service.adminList(admin);
    }

    @PostMapping("/api/admin/flair/challenges")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Administração: cria um desafio (valida R1, P2 e A1 de O Império do Efêmero)")
    public Map<String, Object> adminCreate(CurrentUser admin, @RequestBody FlairChallengeService.AdminChallengeRequest body) {
        return service.adminSave(admin, null, body);
    }

    @PutMapping("/api/admin/flair/challenges/{id}")
    @Operation(summary = "Administração: edita um desafio sem deploy")
    public Map<String, Object> adminUpdate(CurrentUser admin, @PathVariable UUID id, @RequestBody FlairChallengeService.AdminChallengeRequest body) {
        return service.adminSave(admin, id, body);
    }
}
