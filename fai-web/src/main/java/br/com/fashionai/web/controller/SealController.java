package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SealDesignService;
import br.com.fashionai.application.service.SealService;
import br.com.fashionai.application.service.SealPolicyCopilot;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import br.com.fashionai.web.support.Uploads;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF20/RF21 — Selos, vínculos (SealBond) e promoções")
public class SealController {
    private final SealService seals;
    private final SealDesignService designs;

    public SealController(SealService seals, SealDesignService designs) {
        this.seals = seals;
        this.designs = designs;
    }

    @GetMapping("/api/seals/design-catalog")
    @Operation(summary = "RF25 — Catálogo do criador de selo: elementos centrais, padrões entre borda e centro, materiais, paletas e proporções do logo")
    public Map<String, Object> designCatalog() {
        return designs.catalog();
    }

    @PostMapping(value = "/api/seals/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF25 — Enviar selo pronto (1:1, circular, 256–4096 px) ou, com purpose=core, a imagem do núcleo/emblema do selo")
    public Map<String, Object> uploadSeal(CurrentUser user, @RequestPart("file") MultipartFile file,
                                          @RequestParam(value = "purpose", required = false) String purpose) {
        return "core".equalsIgnoreCase(purpose) ? designs.uploadCore(user, Uploads.image(file)) : designs.upload(user, Uploads.image(file));
    }

    @PostMapping("/api/seals")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF20 — Marca/celebridade cria um selo")
    public Map<String, Object> createSeal(CurrentUser user, @RequestBody SealService.SealForm form) {
        return seals.createSeal(user, form);
    }

    public record DraftRequest(SealTier tier, String message, Map<String, Object> previousPolicy, List<SealPolicyCopilot.Message> conversation) {
        public DraftRequest(SealTier tier, String message, Map<String, Object> previousPolicy) {
            this(tier, message, previousPolicy, null);
        }
    }

    @PostMapping({"/api/seals/draft", "/api/copilot/seal-policy"})
    @Operation(summary = "RF25 — Copilot #createsealpolicy: cria o modelo de referência a partir do pedido do emissor, sem publicar o selo")
    public Map<String, Object> draft(CurrentUser user, @RequestBody(required = false) DraftRequest req) {
        return seals.draft(user, req == null ? null : req.tier(), req == null ? null : req.message(),
                req == null ? null : req.previousPolicy(), req == null ? null : req.conversation());
    }

    @PutMapping("/api/seals/{sealId}")
    @Operation(summary = "RF20 — Editar selo (política, ícone, fundo, status)")
    public Map<String, Object> updateSeal(CurrentUser user, @PathVariable UUID sealId, @RequestBody SealService.SealForm form) {
        return seals.updateSeal(user, sealId, form);
    }

    @GetMapping("/api/users/{ownerId}/seals")
    @Operation(summary = "RF20 — Selos de uma marca/celebridade (visitantes veem só os ativos de emissor aprovado)")
    public List<Map<String, Object>> sealsOf(CurrentUser viewer, @PathVariable UUID ownerId) {
        return seals.sealsOf(viewer, ownerId);
    }

    @GetMapping("/api/pieces/seals")
    @Operation(summary = "RF53 — Selos de marca/celebridade das peças (vínculos APROVADOS de tier PEÇA), em lote: ids=a,b,c (até 60; respeita visibilidade)")
    public Map<String, Object> pieceSeals(CurrentUser viewer, @RequestParam(value = "ids", required = false) String ids) {
        List<UUID> out = new java.util.ArrayList<>();
        if (ids != null) {
            for (String part : ids.split(",")) {
                try {
                    out.add(UUID.fromString(part.trim()));
                } catch (IllegalArgumentException ignored) {
                    // id malformado: ignorado (o lote continua)
                }
                if (out.size() >= SealService.MAX_PIECE_SEALS) {
                    break;
                }
            }
        }
        return seals.pieceSeals(viewer, out);
    }

    @GetMapping("/api/me/seals")
    @Operation(summary = "RF21 — Meus selos conquistados e vínculos pendentes")
    public Map<String, Object> mySeals(CurrentUser user) {
        return seals.mySeals(user);
    }

    public record PreviewRequest(java.util.List<UUID> pieceIds, java.util.List<String> occasion, java.util.List<String> style, Map<String, Object> background) {
    }

    @PostMapping("/api/seal-suggestions/preview")
    @Operation(summary = "RF5/RF21.CA01 — Selos possíveis para um look ainda não salvo (nada é gravado)")
    public Map<String, Object> preview(CurrentUser user, @RequestBody PreviewRequest body) {
        return seals.preview(user, body.pieceIds(), body.occasion(), body.style(), body.background());
    }

    public record PiecePreviewRequest(String name, String category, String subcategory, String color, String brandName,
                                      java.util.List<String> occasion, java.util.List<String> style, String material, String variation,
                                      Map<String, java.util.List<String>> attributes, String sex, String size, String market, Map<String, Object> background) {
    }

    @PostMapping("/api/seal-suggestions/preview-piece")
    @Operation(summary = "RF4 — Selos possíveis para uma peça ainda não salva: marca/celebridade com peça semelhante (nada é gravado)")
    public Map<String, Object> previewPiece(CurrentUser user, @RequestBody PiecePreviewRequest body) {
        return seals.previewPiece(user, new SealService.PieceFields(body.name(), body.category(), body.subcategory(), body.color(),
                body.brandName(), body.occasion(), body.style(), body.material(), body.variation(), body.attributes(), body.sex(), body.size(), body.market(), body.background()));
    }

    @GetMapping("/api/schemes/{schemeId}/seal-preview")
    @Operation(summary = "RF13 — Verificar selos do look usado no DNA, sem alterar vínculos")
    public Map<String, Object> previewScheme(CurrentUser user, @PathVariable UUID schemeId) {
        return seals.previewScheme(user, schemeId);
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
