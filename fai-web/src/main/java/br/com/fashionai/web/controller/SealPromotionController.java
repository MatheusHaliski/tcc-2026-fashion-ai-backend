package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SealService;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
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

/**
 * RF22 — promoções/benefícios ligados a selo (criação pelo emissor ou pelo admin, edição, status, vitrine com
 * elegibilidade e resgate). Selos e vínculos ficam em {@link SealController}; mesma tag do OpenAPI e mesmo serviço.
 */
@RestController
@Tag(name = "RF20/RF21 — Selos, vínculos (SealBond) e promoções")
public class SealPromotionController {
    private final SealService seals;

    public SealPromotionController(SealService seals) {
        this.seals = seals;
    }

    public record AdminCouponRequest(UUID issuerId, SealService.PromotionForm promotion) { }

    @PostMapping("/api/admin/coupons")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createAdminCoupon(CurrentUser user, @RequestBody AdminCouponRequest request) {
        return seals.createAdminPromotion(user, request.issuerId(), request.promotion());
    }

    @PostMapping("/api/promotions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF22 — Criar promoção/benefício ligado a selo")
    public Map<String, Object> createPromotion(CurrentUser user, @RequestBody SealService.PromotionForm form) {
        return seals.createPromotion(user, form);
    }

    @PutMapping("/api/promotions/{id}")
    @Operation(summary = "RF22 — Editar promoção")
    public Map<String, Object> updatePromotion(CurrentUser user, @PathVariable UUID id, @RequestBody SealService.PromotionForm form) {
        return seals.updatePromotion(user, id, form);
    }

    public record StatusRequest(@NotNull PromotionStatus status) {
    }

    @PutMapping("/api/promotions/{id}/status")
    @Operation(summary = "RF22 — Ativar, pausar ou encerrar promoção")
    public Map<String, Object> setPromotionStatus(CurrentUser user, @PathVariable UUID id, @RequestBody StatusRequest body) {
        return seals.setPromotionStatus(user, id, body.status());
    }

    @GetMapping("/api/users/{ownerId}/promotions")
    @Operation(summary = "RF22 — Promoções de uma marca/celebridade (com elegibilidade do visitante)")
    public List<Map<String, Object>> promotionsOf(CurrentUser viewer, @PathVariable UUID ownerId) {
        return seals.promotionsOf(viewer, ownerId);
    }

    @PostMapping("/api/promotions/{id}/redemptions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF22 — Resgatar benefício (gera código)")
    public Map<String, Object> redeem(CurrentUser user, @PathVariable UUID id) {
        return seals.redeem(user, id);
    }
}
