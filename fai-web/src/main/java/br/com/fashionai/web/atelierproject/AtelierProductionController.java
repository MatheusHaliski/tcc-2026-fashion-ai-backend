package br.com.fashionai.web.atelierproject;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.sourcing.AtelierProductionService;
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
import static br.com.fashionai.application.sourcing.AtelierProductionViews.*;

/** RF-PESQ-06 — aprovação de amostra e lote de produção. */
@RestController
public class AtelierProductionController {
    private final AtelierProductionService service;

    public AtelierProductionController(AtelierProductionService service) {
        this.service = service;
    }

    @GetMapping("/api/atelier/projects/{id}/production")
    public List<Map<String, Object>> list(CurrentUser user, @PathVariable UUID id) {
        return service.list(user, id);
    }

    @PostMapping("/api/atelier/projects/{id}/production")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> request(CurrentUser user, @PathVariable UUID id, @RequestBody RequestCmd body) {
        return service.request(user, id, body);
    }

    @GetMapping("/api/me/atelier/production")
    public List<Map<String, Object>> inbox(CurrentUser user) {
        return service.producerInbox(user);
    }

    @PostMapping("/api/atelier/production/{id}/sample-received")
    public Map<String, Object> received(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.receiveSample(user, id, body);
    }

    @PostMapping("/api/atelier/production/{id}/deviations")
    public Map<String, Object> deviation(CurrentUser user, @PathVariable UUID id, @RequestBody DeviationCmd body) {
        return service.recordDeviation(user, id, body);
    }

    @PostMapping("/api/atelier/production/{id}/deviations/{deviationId}/decision")
    public Map<String, Object> decide(CurrentUser user, @PathVariable UUID id, @PathVariable UUID deviationId, @RequestBody DecisionCmd body) {
        return service.decideDeviation(user, id, deviationId, body);
    }

    @PostMapping("/api/atelier/production/{id}/approve")
    public Map<String, Object> approve(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.approve(user, id, body);
    }

    @PostMapping("/api/atelier/production/{id}/cancel")
    public Map<String, Object> cancel(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.cancel(user, id, body);
    }
}
