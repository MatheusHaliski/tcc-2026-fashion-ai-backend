package br.com.fashionai.web.controller;

import br.com.fashionai.application.demand.RetailDemandService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Map;

/** RF-PESQ-10 — painel de demanda agregado e consentido. */
@RestController
@Tag(name = "Retail demand — consented aggregates")
public class RetailDemandController {
    private final RetailDemandService service;

    public RetailDemandController(RetailDemandService service) {
        this.service = service;
    }

    @PostMapping("/api/me/retail-demand/events")
    public Map<String, Object> record(CurrentUser user, @RequestBody RetailDemandService.EventCmd body) {
        return service.record(user, body);
    }

    @GetMapping("/api/me/retail-demand")
    public Map<String, Object> status(CurrentUser user) {
        return service.myStatus(user);
    }

    @DeleteMapping("/api/me/retail-demand/contributions")
    public Map<String, Object> purge(CurrentUser user) {
        return service.purgeContributions(user.id());
    }

    @GetMapping("/api/physical-store/demand")
    public Map<String, Object> panel(CurrentUser seller, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.panel(seller, from, to);
    }
}
