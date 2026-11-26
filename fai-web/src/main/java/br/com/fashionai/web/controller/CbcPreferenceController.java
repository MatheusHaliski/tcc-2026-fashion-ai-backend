package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CbcPreferenceService;
import br.com.fashionai.application.view.Views;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Exercício 16 — cenário preferido da pessoa em cada Desafio de Montagem. A pessoa é sempre a da sessão
 * ({@link CurrentUser}); o corpo não aceita userId.
 */
@RestController
@Tag(name = "FLAIR-UT — Desafios de Montagem (cartas FLAIR nos Momentos)")
public class CbcPreferenceController {
    private final CbcPreferenceService service;

    public CbcPreferenceController(CbcPreferenceService service) {
        this.service = service;
    }

    public record PreferenceRequest(UUID scenarioId) {
    }

    @GetMapping("/api/flair/challenges/{idOrSlug}/scenarios")
    @Operation(summary = "Cenários que o desafio permite preferir (id, código e nome)")
    public List<Views.ReferenceOptionView> scenarios(CurrentUser viewer, @PathVariable String idOrSlug) {
        return service.scenarios(viewer, idOrSlug);
    }

    @GetMapping("/api/flair/challenges/{idOrSlug}/preference")
    @Operation(summary = "Cenário que a pessoa prefere neste desafio (nulo = o oficial)")
    public Map<String, Object> preference(CurrentUser user, @PathVariable String idOrSlug) {
        return service.preference(user, idOrSlug);
    }

    @PutMapping("/api/flair/challenges/{idOrSlug}/preference")
    @Operation(summary = "Escolhe o cenário preferido entre os permitidos no desafio")
    public Map<String, Object> save(CurrentUser user, @PathVariable String idOrSlug, @RequestBody PreferenceRequest body) {
        return service.save(user, idOrSlug, body.scenarioId());
    }

    @DeleteMapping("/api/flair/challenges/{idOrSlug}/preference")
    @Operation(summary = "Volta ao cenário oficial do desafio")
    public Map<String, Object> clear(CurrentUser user, @PathVariable String idOrSlug) {
        return service.clear(user, idOrSlug);
    }

    @GetMapping("/api/flair/challenge-preferences")
    @Operation(summary = "Cenários preferidos da pessoa em todos os desafios")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return service.mine(user);
    }
}
