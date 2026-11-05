package br.com.fashionai.web.controller;

import br.com.fashionai.application.fitting.FittingAppointmentService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import static br.com.fashionai.application.fitting.FittingAppointmentViews.*;

/** RF-PESQ-07 — prova física agendada com reserva temporária por SKU/tamanho. */
@RestController
@Tag(name = "Fitting appointments")
public class FittingAppointmentController {
    private final FittingAppointmentService service;

    public FittingAppointmentController(FittingAppointmentService service) {
        this.service = service;
    }

    @GetMapping("/api/me/fitting-appointments")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return service.mine(user);
    }

    @PostMapping("/api/me/fitting-appointments")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> request(CurrentUser user, @RequestBody RequestCmd body) {
        return service.request(user, body);
    }

    @PostMapping("/api/fitting-appointments/{id}/cancel")
    public Map<String, Object> cancel(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.cancel(user, id, body);
    }

    @PostMapping("/api/fitting-appointments/{id}/complete")
    public Map<String, Object> complete(CurrentUser user, @PathVariable UUID id, @RequestBody CompleteCmd body) {
        return service.complete(user, id, body);
    }

    @GetMapping("/api/physical-store/fitting-appointments")
    public List<Map<String, Object>> inbox(CurrentUser user) {
        return service.storeInbox(user);
    }

    @PostMapping("/api/fitting-appointments/{id}/confirm")
    public Map<String, Object> confirm(CurrentUser user, @PathVariable UUID id, @RequestBody ConfirmCmd body) {
        return service.confirm(user, id, body);
    }

    @PostMapping("/api/fitting-appointments/{id}/decline")
    public Map<String, Object> decline(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.decline(user, id, body);
    }
}
