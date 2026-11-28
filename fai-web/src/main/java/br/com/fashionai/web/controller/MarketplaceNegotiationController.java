package br.com.fashionai.web.controller;

import br.com.fashionai.application.marketplace.MarketplaceNegotiationService;
import br.com.fashionai.application.marketplace.NegotiationDecision;
import br.com.fashionai.application.marketplace.NegotiationForm;
import br.com.fashionai.application.marketplace.NegotiationView;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/me/marketplace")
public class MarketplaceNegotiationController {
    private final MarketplaceNegotiationService service;

    public MarketplaceNegotiationController(MarketplaceNegotiationService service) {
        this.service = service;
    }

    @GetMapping("/negotiations")
    public List<NegotiationView> mine(CurrentUser viewer, @RequestParam(defaultValue = "0") int page) {
        return service.mine(viewer, page);
    }

    @PostMapping("/negotiations")
    @ResponseStatus(HttpStatus.CREATED)
    public NegotiationView create(CurrentUser viewer, @RequestBody NegotiationForm form) {
        return service.propose(viewer, null, form);
    }

    @PutMapping("/negotiations/{id}")
    public NegotiationView edit(CurrentUser viewer, @PathVariable UUID id, @RequestBody NegotiationForm form) {
        return service.propose(viewer, id, form);
    }

    @PostMapping("/negotiations/{id}/decision")
    public NegotiationView decide(CurrentUser viewer, @PathVariable UUID id, @RequestBody NegotiationDecision decision) {
        return service.decide(viewer, id, decision);
    }

    @PutMapping("/pieces/{id}/expiry")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void expiry(CurrentUser viewer, @PathVariable UUID id, @RequestBody ExpiryPreference preference) {
        service.expiryPreference(viewer, id, preference.archive());
    }

    public record ExpiryPreference(boolean archive) {}
}
