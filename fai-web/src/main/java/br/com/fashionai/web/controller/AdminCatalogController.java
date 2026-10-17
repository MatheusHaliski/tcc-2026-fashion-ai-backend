package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AdminCatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/catalog")
@Tag(name = "Administração de catálogos (loja, FLAIR, selos, cupons, peças, quarto 3D)")
public class AdminCatalogController {
    private final AdminCatalogService catalog;
    public AdminCatalogController(AdminCatalogService catalog) { this.catalog = catalog; }

    @GetMapping("/store")
    @Operation(summary = "Itens da loja Fashion AI (ativos e inativos). Filtros: qualquer atributo (ex.: active, slotType, rarity), q, page, size, sort, dir")
    public Map<String, Object> store(CurrentUser user, @RequestParam Map<String, String> params) { return catalog.storeItems(user, params); }

    @GetMapping("/store/{sku}")
    public Map<String, Object> storeItem(CurrentUser user, @PathVariable String sku) { return catalog.storeItem(user, sku); }

    @PatchMapping("/store/{sku}")
    @Operation(summary = "Edita qualquer item da loja (nome, preço, estoque, raridade, janela de venda, etc.)")
    public Map<String, Object> update(CurrentUser user, @PathVariable String sku, @RequestBody Map<String, Object> changes) {
        return catalog.updateStoreItem(user, sku, changes);
    }

    @PostMapping("/store/{sku}/activate")
    public Map<String, Object> activate(CurrentUser user, @PathVariable String sku) { return catalog.setStoreItemActive(user, sku, true); }

    @PostMapping("/store/{sku}/deactivate")
    public Map<String, Object> deactivate(CurrentUser user, @PathVariable String sku) { return catalog.setStoreItemActive(user, sku, false); }

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

    @GetMapping("/room-items")
    @Operation(summary = "Itens do quarto 3D dos usuários. Filtros: userId, sku, source…")
    public Map<String, Object> roomItems(CurrentUser user, @RequestParam Map<String, String> params) { return catalog.roomItemCatalog(user, params); }
}
