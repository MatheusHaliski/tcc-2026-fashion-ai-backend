package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SealService;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF20/RF21 — Selos, vínculos (SealBond) e promoções")
public class SealController {
    private final SealService seals;

    public SealController(SealService seals) {
        this.seals = seals;
    }

    @PostMapping("/api/seals")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF20 — Marca/celebridade cria um selo")
    public Map<String, Object> createSeal(CurrentUser user, @RequestBody SealService.SealForm form) {
        return seals.createSeal(user, form);
    }

    @PutMapping("/api/seals/{sealId}")
    @Operation(summary = "RF20 — Editar selo (política, ícone, fundo, status)")
    public Map<String, Object> updateSeal(CurrentUser user, @PathVariable UUID sealId, @RequestBody SealService.SealForm form) {
        return seals.updateSeal(user, sealId, form);
    }

    @GetMapping("/api/users/{ownerId}/seals")
    @Operation(summary = "RF20 — Selos de uma marca/celebridade")
    public List<Map<String, Object>> sealsOf(@PathVariable UUID ownerId) {
        return seals.sealsOf(ownerId);
    }

    @GetMapping("/api/me/seals")
    @Operation(summary = "RF21 — Meus selos conquistados e vínculos pendentes")
    public Map<String, Object> mySeals(CurrentUser user) {
        return seals.mySeals(user);
    }

    @GetMapping("/api/schemes/{schemeId}/seal-suggestions")
    @Operation(summary = "RF21.CA01 — Sugestões de vínculo de selo para o esquema (SealBond Matcher)")
    public Map<String, Object> suggest(CurrentUser user, @PathVariable UUID schemeId) {
        return seals.suggest(user, schemeId);
    }

    public record LinkRequest(@NotNull UUID targetOwnerId, Boolean imageRightsConsent) {
    }

    @PostMapping("/api/schemes/{schemeId}/seal-bonds")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF21.CA03 — Vincular manualmente o esquema a uma marca/celebridade")
    public Map<String, Object> link(CurrentUser user, @PathVariable UUID schemeId, @RequestBody LinkRequest body) {
        return seals.linkManually(user, schemeId, body.targetOwnerId(), body.imageRightsConsent());
    }

    @PostMapping("/api/schemes/{schemeId}/seal-bonds/refuse-all")
    @Operation(summary = "RF21 — Recusar todas as sugestões do esquema")
    public Map<String, Object> refuseAll(CurrentUser user, @PathVariable UUID schemeId) {
        return Map.of("refused", seals.refuseAll(user, schemeId));
    }

    public record AcceptRequest(Boolean imageRightsConsent) {
    }

    @PostMapping("/api/seal-bonds/{bondId}/accept")
    @Operation(summary = "RF21.CA02 — Aceitar sugestão de vínculo (com consentimento de imagem)")
    public Map<String, Object> accept(CurrentUser user, @PathVariable UUID bondId, @RequestBody(required = false) AcceptRequest body) {
        return seals.accept(user, bondId, body == null ? null : body.imageRightsConsent());
    }

    @PostMapping("/api/seal-bonds/{bondId}/refuse")
    @Operation(summary = "RF21 — Recusar sugestão de vínculo")
    public Map<String, Object> refuse(CurrentUser user, @PathVariable UUID bondId) {
        return seals.refuse(user, bondId);
    }

    @GetMapping("/api/seal-bonds/review-queue")
    @Operation(summary = "RF20.CA04 — Fila de revisão da marca/celebridade emissora")
    public List<Map<String, Object>> reviewQueue(CurrentUser user) {
        return seals.reviewQueue(user);
    }

    public record ReviewRequest(boolean approve, String reason) {
    }

    @PostMapping("/api/seal-bonds/{bondId}/review")
    @Operation(summary = "RF20.CA04 — Emissor aprova ou rejeita o vínculo")
    public Map<String, Object> review(CurrentUser user, @PathVariable UUID bondId, @RequestBody ReviewRequest body) {
        return seals.review(user, bondId, body.approve(), body.reason());
    }

    public record RevokeRequest(String reason) {
    }

    @PostMapping("/api/seal-bonds/{bondId}/revoke")
    @Operation(summary = "RF20.CA05 — Revogar selo concedido")
    public Map<String, Object> revoke(CurrentUser user, @PathVariable UUID bondId, @RequestBody(required = false) RevokeRequest body) {
        return seals.revoke(user, bondId, body == null ? null : body.reason());
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

    @GetMapping("/api/me/issuer-metrics")
    @Operation(summary = "RF20/RF22 — Métricas do emissor: selos, vínculos, resgates")
    public Map<String, Object> issuerMetrics(CurrentUser user) {
        return seals.issuerMetrics(user);
    }
}
