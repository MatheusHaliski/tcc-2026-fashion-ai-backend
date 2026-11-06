package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.PhysicalStoreVariantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF-PESQ-01 — variantes (cor × tamanho) das ofertas da loja física. */
@RestController
@Tag(name = "Physical store — variants (SKU, color, size)")
public class PhysicalStoreVariantController {
    private final PhysicalStoreVariantService service;

    public PhysicalStoreVariantController(PhysicalStoreVariantService service) {
        this.service = service;
    }

    @GetMapping("/api/physical-store/listings/{id}/checkout")
    @Operation(summary = "Variants of one listing with availability, for the redemption step")
    public Map<String, Object> checkout(CurrentUser user, @PathVariable UUID id) {
        return service.checkout(user, id);
    }

    @GetMapping("/api/physical-store/listings/{id}/variants")
    public List<Map<String, Object>> list(CurrentUser user, @PathVariable UUID id) {
        return service.list(user, id);
    }

    @PostMapping("/api/physical-store/listings/{id}/variants")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(CurrentUser user, @PathVariable UUID id, @RequestBody PhysicalStoreVariantService.VariantForm body) {
        return service.save(user, id, null, body);
    }

    @PutMapping("/api/physical-store/listings/{id}/variants/{variantId}")
    public Map<String, Object> update(CurrentUser user, @PathVariable UUID id, @PathVariable UUID variantId,
                                      @RequestBody PhysicalStoreVariantService.VariantForm body) {
        return service.save(user, id, variantId, body);
    }
}
