package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.DashboardService;
import br.com.fashionai.domain.model.enums.ProfileType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@Tag(name = "Dashboard gerencial (admin e emissor)")
public class DashboardController {
    private final DashboardService dashboard;

    public DashboardController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping("/api/admin/dashboard")
    @Operation(summary = "Dashboard administrativo: KPIs, séries, rankings e alertas com filtros de período/país/perfil")
    public Map<String, Object> admin(CurrentUser user,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                     @RequestParam(required = false) String country,
                                     @RequestParam(required = false) ProfileType profileType) {
        return dashboard.admin(user, new DashboardService.Query(from, to, country, profileType));
    }

    @GetMapping("/api/me/issuer-dashboard")
    @Operation(summary = "Dashboard da marca/celebridade: selos, vínculos, promoções, alcance")
    public Map<String, Object> issuer(CurrentUser user,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                      @RequestParam(required = false) String country) {
        return dashboard.issuer(user, new DashboardService.Query(from, to, country, null));
    }

    public record LayoutRequest(List<String> widgets, List<String> hidden, Map<String, Object> defaultFilter) {
    }

    @PutMapping("/api/me/dashboard-layout")
    @Operation(summary = "Salvar layout de widgets e filtro padrão do dashboard (customização por usuário)")
    public Map<String, Object> saveLayout(CurrentUser user, @RequestBody LayoutRequest body) {
        return dashboard.saveLayout(user, body.widgets(), body.hidden(), body.defaultFilter());
    }
}
