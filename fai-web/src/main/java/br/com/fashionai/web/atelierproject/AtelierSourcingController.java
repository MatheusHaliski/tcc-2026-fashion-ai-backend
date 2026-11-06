package br.com.fashionai.web.atelierproject;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.sourcing.AtelierSourcingService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import static br.com.fashionai.application.sourcing.AtelierSourcingViews.*;

/** RF-PESQ-04 — BOM e cotação de produção vinculadas à revisão. */
@RestController
public class AtelierSourcingController {
    private final AtelierSourcingService service;

    public AtelierSourcingController(AtelierSourcingService service) {
        this.service = service;
    }

    @GetMapping("/api/atelier/projects/{id}/revisions/{revisionId}/bom")
    public List<Map<String, Object>> bom(CurrentUser user, @PathVariable UUID id, @PathVariable UUID revisionId) {
        return service.bom(user, id, revisionId);
    }

    @PostMapping("/api/atelier/projects/{id}/bom")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> addBomItem(CurrentUser user, @PathVariable UUID id, @RequestBody BomItemCmd body) {
        return service.addBomItem(user, id, body);
    }

    @DeleteMapping("/api/atelier/projects/{id}/bom/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeBomItem(CurrentUser user, @PathVariable UUID id, @PathVariable UUID itemId) {
        service.removeBomItem(user, id, itemId);
    }

    @GetMapping("/api/atelier/projects/{id}/quote-requests")
    public List<Map<String, Object>> requests(CurrentUser user, @PathVariable UUID id) {
        return service.requests(user, id);
    }

    @PostMapping("/api/atelier/projects/{id}/quote-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> requestQuote(CurrentUser user, @PathVariable UUID id, @RequestBody QuoteRequestCmd body) {
        return service.requestQuote(user, id, body);
    }

    @PostMapping("/api/atelier/projects/{id}/quotes/{quoteId}/accept")
    public Map<String, Object> accept(CurrentUser user, @PathVariable UUID id, @PathVariable UUID quoteId, @RequestBody AcceptCmd body) {
        return service.acceptQuote(user, id, quoteId, body);
    }

    @GetMapping("/api/me/atelier/quote-requests")
    public List<Map<String, Object>> inbox(CurrentUser user) {
        return service.supplierInbox(user);
    }

    @PostMapping("/api/atelier/quote-requests/{id}/quotes")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> quote(CurrentUser user, @PathVariable UUID id, @RequestBody QuoteCmd body) {
        return service.submitQuote(user, id, body);
    }
}
