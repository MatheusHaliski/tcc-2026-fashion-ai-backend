package br.com.fashionai.web.controller;

import br.com.fashionai.application.catalog.image.CatalogImagePipelineService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Pipeline de imagens da Busca Catalogada: fila de revisão, métricas e depuração visual (só ADMIN). */
@RestController
@RequestMapping("/api/admin/catalog-images")
@Tag(name = "Administração · Pipeline de imagens do catálogo")
public class AdminCatalogImageController {
    private final CatalogImagePipelineService pipeline;

    public AdminCatalogImageController(CatalogImagePipelineService pipeline) {
        this.pipeline = pipeline;
    }

    @GetMapping("/review")
    @Operation(summary = "CatalogImageReviewQueue — fotos que o Quality Gate mandou para revisão (NEEDS_REPROCESSING)")
    public Map<String, Object> review(CurrentUser user, @RequestParam(defaultValue = "30") int limit) {
        return pipeline.reviewQueue(user, limit);
    }

    @PostMapping("/{imageId}/review")
    @Operation(summary = "Decidir: APPROVE | REPROCESS | SELECT_ALTERNATE_IMAGE (alternateImageId) | REJECT")
    public Map<String, Object> decide(CurrentUser user, @PathVariable UUID imageId, @RequestBody CatalogImagePipelineService.ReviewCommand body) {
        return pipeline.decide(user, imageId, body);
    }

    @GetMapping("/metrics")
    @Operation(summary = "Painel de qualidade: por status, canônicas, revisão pendente, qualidade média, motivos de reprovação")
    public Map<String, Object> metrics(CurrentUser user) {
        return pipeline.metrics(user);
    }

    @GetMapping("/{imageId}")
    @Operation(summary = "Antes/depois e depuração visual: bbox, foco, regiões críticas, candidatos e recorte final")
    public Map<String, Object> debug(CurrentUser user, @PathVariable UUID imageId) {
        return pipeline.debug(user, imageId);
    }

    @PostMapping("/products/{productId}/reprocess")
    @Operation(summary = "Reprocessar todas as fotos oficiais de um produto")
    public Map<String, Object> reprocess(CurrentUser user, @PathVariable UUID productId) {
        return pipeline.enqueueProduct(user, productId);
    }
}
