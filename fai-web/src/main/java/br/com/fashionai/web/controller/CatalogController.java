package br.com.fashionai.web.controller;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** RF47 · Acervo & Busca Catalogada: busca estruturada, lojas oficiais, adicionar ao guarda-roupa pelo catálogo. */
@RestController
@Tag(name = "RF47 — Acervo & Busca Catalogada")
public class CatalogController {
    private final CatalogService catalog;
    private final br.com.fashionai.application.catalog.image.CatalogImagePipelineService imagePipeline;

    public CatalogController(CatalogService catalog, br.com.fashionai.application.catalog.image.CatalogImagePipelineService imagePipeline) {
        this.catalog = catalog;
        this.imagePipeline = imagePipeline;
    }

    @GetMapping("/api/catalog/search")
    @Operation(summary = "RF47 — Busca no catálogo interno (categoria, subcategoria, marca, nome/modelo/descrição, cor) com matchScore e leitura das características únicas da peça")
    public Map<String, Object> search(CurrentUser user, @RequestParam(required = false) String category, @RequestParam(required = false) String subcategory,
                                      @RequestParam(required = false) String brand, @RequestParam(required = false) String q,
                                      @RequestParam(required = false) String color, @RequestParam(required = false) Integer limit, @RequestParam(required = false) String code) {
        // o texto do nome é lido também como DESCRIÇÃO da peça (estampa, logo, lados, cores) — com IA quando disponível (RF24)
        return catalog.search(user == null ? null : user.id(), new CatalogService.SearchRequest(category, subcategory, brand, q, color, limit, code));
    }

    @GetMapping("/api/catalog/suggestions")
    @Operation(summary = "RF47 — Sugestões de modelo enquanto digita")
    public Map<String, Object> suggestions(@RequestParam(required = false) String category, @RequestParam(required = false) String subcategory,
                                           @RequestParam(required = false) String brand, @RequestParam(required = false) String q) {
        return catalog.suggestions(new CatalogService.SearchRequest(category, subcategory, brand, q, null, 12));
    }

    @GetMapping("/api/catalog/brands")
    @Operation(summary = "RF47 — Autocomplete de marca (nome e apelidos, sem duplicatas)")
    public Map<String, Object> brands(@RequestParam(required = false) String q) {
        return catalog.brandSuggestions(q);
    }

    @GetMapping("/api/catalog/stores")
    @Operation(summary = "RF18/RF47 — Lojas do catálogo (marcas com produtos visíveis) para o provador virtual")
    public Map<String, Object> stores() {
        return Map.of("stores", catalog.catalogBrands());
    }

    @GetMapping("/api/catalog/products")
    @Operation(summary = "RF47 — O acervo inteiro, paginado (marca, categoria, subtipo e texto opcionais; total real e hasMore): todas as peças, não só as mais parecidas")
    public Map<String, Object> browse(@RequestParam(required = false) String brand, @RequestParam(required = false) String category,
                                      @RequestParam(required = false) String subcategory, @RequestParam(required = false) String q,
                                      @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size,
                                      @RequestParam(required = false) String brandId, @RequestParam(required = false) String color,
                                      @RequestParam(required = false) String gender, @RequestParam(required = false) String code) {
        return catalog.browse(new CatalogService.BrowseRequest(brand, category, subcategory, q, page, size, brandId, color, gender, code));
    }

    @GetMapping("/api/catalog/summary")
    @Operation(summary = "RF47 — Tamanho do acervo visível: peças e marcas com peças")
    public Map<String, Object> summary() {
        return catalog.summary();
    }

    @GetMapping("/api/catalog/products/{id}")
    @Operation(summary = "RF47 — Produto do catálogo com variantes, fotos oficiais e proveniência")
    public Map<String, Object> product(@PathVariable UUID id,@RequestParam(required=false) UUID variantId,
            @RequestParam(required=false) UUID imageId) {
        return catalog.product(id,variantId,imageId);
    }

    @PostMapping("/api/catalog/products/{id}/preview-image")
    @Operation(summary = "Enquadramento automático em cache para exibir o card do catálogo")
    public Map<String, Object> previewImage(CurrentUser user, @PathVariable UUID id,
                                           @RequestParam(defaultValue = "false") boolean force,
                                           @RequestParam(required=false) UUID variantId, @RequestParam(required=false) UUID imageId) {
        imagePipeline.ensurePreview(user, id, force, variantId, imageId);
        return catalog.product(id,variantId,imageId);
    }

    @PostMapping("/api/catalog/products/{id}/verify-image")
    @Operation(summary = "Verifica novamente a foto original e aplica a regra de enquadramento 3:4 antes da seleção")
    public Map<String, Object> verifyImage(CurrentUser user, @PathVariable UUID id,
            @RequestParam(required=false) UUID variantId, @RequestParam(required=false) UUID imageId) {
        imagePipeline.verifySelection(user, id, variantId, imageId);
        return catalog.product(id,variantId,imageId);
    }

    @GetMapping("/api/catalog/products/{id}/texture-image")
    public ResponseEntity<byte[]> textureImage(CurrentUser user, @PathVariable UUID id, @RequestParam(defaultValue = "false") boolean isolated,
            @RequestParam(required=false) UUID variantId, @RequestParam(required=false) UUID imageId,
            @RequestParam(required=false) String view) {
        var photo = imagePipeline.texturePhoto(user, id, isolated, variantId, imageId,
                br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TextureView.of(view));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(photo.mime()))
                .header("Cache-Control", "private, max-age=0, must-revalidate").header("X-Content-Type-Options", "nosniff").body(photo.bytes());
    }

    @PostMapping("/api/catalog/discover")
    @Operation(summary = "RF47 — Busca nas fontes oficiais da marca (candidatos DISCOVERED até alguém escolher)")
    public Map<String, Object> discover(CurrentUser user, @RequestBody CatalogService.SearchRequest request) {
        return catalog.discover(user, request);
    }

    @PostMapping("/api/pieces/from-catalog")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF47 — Adiciona ao guarda-roupa a peça escolhida no catálogo (dados pessoais à parte)")
    public Views.PieceView fromCatalog(CurrentUser user, @RequestBody CatalogService.AddRequest request) {
        return catalog.addToWardrobe(user, request);
    }
}
