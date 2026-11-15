package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AdminCatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/catalog")
@Tag(name = "Administração de catálogos (FLAIR, selos, cupons, peças)")
public class AdminCatalogController {
    private final AdminCatalogService catalog;
    public AdminCatalogController(AdminCatalogService catalog) { this.catalog = catalog; }

    @GetMapping("/flair-games")
    @Operation(summary = "Partidas FLAIR (todos os status). Filtros: mode, status, theme, userId (criador), q…")
    public Map<String, Object> flairGames(CurrentUser user, @RequestParam Map<String, String> params) { return catalog.flairGames(user, params); }

    @GetMapping("/seals")
    @Operation(summary = "Selos (todos os status). Filtros: userId/ownerId (dono), status, tier, premium, q…")
    public Map<String, Object> seals(CurrentUser user, @RequestParam Map<String, String> params) { return catalog.sealCatalog(user, params); }

    @GetMapping("/coupons")
    @Operation(summary = "Cupons (todos os status). Filtros: userId (titular), ownerId (emissor), status, sourceType, q…")
    public Map<String, Object> coupons(CurrentUser user, @RequestParam Map<String, String> params) { return catalog.couponCatalog(user, params); }

    @GetMapping("/garments")
    @Operation(summary = "Peças de roupa de todos os usuários. Filtros: userId, category, moderationStatus, forSale, q…")
    public Map<String, Object> garments(CurrentUser user, @RequestParam Map<String, String> params) { return catalog.garmentCatalog(user, params); }
}
