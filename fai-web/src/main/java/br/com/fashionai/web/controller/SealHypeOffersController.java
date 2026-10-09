package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SealHypeOffersService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
public class SealHypeOffersController {
    private final SealHypeOffersService offers;
    public SealHypeOffersController(SealHypeOffersService offers) { this.offers=offers; }

    @GetMapping("/api/hype/{type}/{id}/seal-offers")
    @Operation(summary="Campanhas de selo Hype para uma peça ou look visível; leitura não atribui selos nem recalcula métricas")
    public Map<String,Object> offers(CurrentUser viewer,@PathVariable String type,@PathVariable UUID id,
                                      @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size) {
        return offers.offers(viewer,HypeController.type(type),id,page,size);
    }

    public record Request(Boolean imageRightsConsent) {}
    @PostMapping("/api/hype/{type}/{id}/seal-offers/{sealId}/request")
    @Operation(summary="Proprietário solicita selo Hype; servidor reavalia política e métricas antes da emissão ou revisão")
    public Map<String,Object> request(CurrentUser user,@PathVariable String type,@PathVariable UUID id,@PathVariable UUID sealId,
                                      @RequestBody(required=false) Request body) {
        return offers.request(user,HypeController.type(type),id,sealId,body == null ? null : body.imageRightsConsent());
    }
}
