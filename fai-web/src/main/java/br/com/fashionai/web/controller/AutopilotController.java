package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AutopilotService;
import br.com.fashionai.application.service.CopilotService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF10 — Autopiloto, Semana e Copilot")
public class AutopilotController {
    private final AutopilotService autopilot;
    private final CopilotService copilot;

    public AutopilotController(AutopilotService autopilot, CopilotService copilot) {
        this.autopilot = autopilot;
        this.copilot = copilot;
    }

    @PostMapping("/api/autopilot/daily")
    @Operation(summary = "RF10.CA01 — Sugerir o look de hoje (ocasião, humor, clima)")
    public Map<String, Object> daily(CurrentUser user, @RequestBody AutopilotService.DailyRequest body) {
        return autopilot.daily(user, body);
    }

    public record ConfirmRequest(@NotEmpty List<UUID> pieceIds, String title, List<String> occasion, String mood) {
    }

    @PostMapping("/api/autopilot/daily/confirmation")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF10.CA02 — Confirmar a sugestão como esquema e Look do Dia")
    public Map<String, Object> confirmDaily(CurrentUser user, @RequestBody ConfirmRequest body) {
        return autopilot.confirmDaily(user, body.pieceIds(), body.title(), body.occasion(), body.mood());
    }

    @PostMapping("/api/autopilot/weeks")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF10.CA05 — Planejar a semana (um look por dia sem repetir peças)")
    public Map<String, Object> planWeek(CurrentUser user, @RequestBody AutopilotService.WeekRequest body) {
        return autopilot.planWeek(user, body);
    }

    @GetMapping("/api/autopilot/weeks/current")
    @Operation(summary = "RF10.CA05 — Semana planejada atual")
    public Map<String, Object> currentWeek(CurrentUser user) {
        return autopilot.currentWeek(user);
    }

    public record DayEdit(@NotEmpty List<UUID> pieceIds) {
    }

    @PutMapping("/api/autopilot/days/{dayId}")
    @Operation(summary = "RF10.CA06 — Trocar as peças de um dia")
    public Map<String, Object> editDay(CurrentUser user, @PathVariable UUID dayId, @RequestBody DayEdit body) {
        return autopilot.editDay(user, dayId, body.pieceIds());
    }

    @PostMapping("/api/autopilot/days/{dayId}/use")
    @Operation(summary = "RF10.CA06 — Usar o look do dia planejado (vira Look do Dia)")
    public Map<String, Object> useDay(CurrentUser user, @PathVariable UUID dayId) {
        return autopilot.useDay(user, dayId);
    }

    @DeleteMapping("/api/autopilot/weeks/current")
    @Operation(summary = "RF10.CA05 — Descartar a semana planejada")
    public Map<String, Object> discardWeek(CurrentUser user) {
        return autopilot.discardWeek(user);
    }

    @GetMapping("/api/copilot/suggestions")
    @Operation(summary = "RF10 — Sugestões visuais do Copilot: looks prontos, combinações novas, peças esquecidas, peças para o clima e looks em alta")
    public Map<String, Object> suggestions(CurrentUser user, @RequestParam(required = false) String city,
                                           @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lon) {
        return copilot.suggestions(user, city, lat, lon);
    }

    @GetMapping("/api/copilot/context")
    @Operation(summary = "RF10.CA08 — Contexto do Copilot para a tela atual (prompts sugeridos, clima, seleção)")
    public Map<String, Object> context(CurrentUser user, @RequestParam(required = false) String view,
                                       @RequestParam(required = false) List<UUID> selection,
                                       @RequestParam(required = false) String city,
                                       @RequestParam(required = false) Double latitude,
                                       @RequestParam(required = false) Double longitude) {
        return copilot.context(user, view, selection, city, latitude, longitude);
    }

    @PostMapping("/api/copilot/messages")
    @Operation(summary = "RF10.CA09–CA16 — Perguntar ao Copilot (roteamento de intenção, chips de peças, sugestões de compra)")
    public Map<String, Object> ask(CurrentUser user, @RequestBody CopilotService.AskRequest body) {
        return copilot.ask(user, body);
    }

    public record AcceptRequest(@NotEmpty List<UUID> pieceIds, String title, List<String> occasion, List<String> style, String mood,
                                String season, String description, Map<String, Object> background) {
    }

    @PostMapping("/api/copilot/looks")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF10 — Aceitar um look sugerido pelo Copilot como esquema")
    public Map<String, Object> accept(CurrentUser user, @RequestBody AcceptRequest body) {
        return copilot.accept(user, body.pieceIds(), body.title(), body.occasion(), body.style(), body.mood(), body.season(),
                body.description(), body.background());
    }
}
