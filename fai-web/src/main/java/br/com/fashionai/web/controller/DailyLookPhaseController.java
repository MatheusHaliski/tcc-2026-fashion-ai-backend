package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.DailyLookPhaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Look do Dia Vivido F3 — fases pessoais (Momento PERSONAL da própria pessoa), Memória e publicação no perfil. */
@RestController
@Tag(name = "Look do Dia Vivido — fases pessoais")
public class DailyLookPhaseController {
    private final DailyLookPhaseService phases;

    public DailyLookPhaseController(DailyLookPhaseService phases) {
        this.phases = phases;
    }

    public record PhaseRequest(@NotBlank String name, @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
                               @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
    }

    public record VisibilityRequest(boolean publicOnProfile) {
    }

    @PostMapping("/api/me/daily-looks/phases")
    @Operation(summary = "Criar uma fase pessoal (privada) e ligar a ela os Looks do Dia do período")
    public Map<String, Object> create(CurrentUser user, @RequestBody PhaseRequest body) {
        return phases.create(user, body.name(), body.startDate(), body.endDate());
    }

    @GetMapping("/api/me/daily-looks/phases")
    @Operation(summary = "Minhas fases pessoais, com o resumo de cada uma")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return phases.mine(user);
    }

    @GetMapping("/api/me/daily-looks/phases/{id}/memory")
    @Operation(summary = "Memória de uma fase: dias, looks, propósitos e as peças que mais acompanharam")
    public Map<String, Object> memory(CurrentUser user, @PathVariable UUID id) {
        return phases.memory(user, id);
    }

    @PutMapping("/api/me/daily-looks/phases/{id}/visibility")
    @Operation(summary = "Publicar (ou recolher) a Memória da fase no perfil")
    public Map<String, Object> visibility(CurrentUser user, @PathVariable UUID id, @RequestBody VisibilityRequest body) {
        return phases.setPublicOnProfile(user, id, body.publicOnProfile());
    }

    @GetMapping("/api/users/{id}/daily-looks/phases")
    @Operation(summary = "Memórias de fase publicadas no perfil de alguém (resumo; só peças públicas)")
    public List<Map<String, Object>> published(CurrentUser viewer, @PathVariable UUID id) {
        return phases.published(viewer, id);
    }
}
