package br.com.fashionai.web.controller;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
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

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/api/catalog/search")
    @Operation(summary = "RF47 — Busca no catálogo interno (categoria, subcategoria, marca, nome/modelo/descrição, cor) com matchScore e leitura das características únicas da peça")
    public Map<String, Object> search(CurrentUser user, @RequestParam(required = false) String category, @RequestParam(required = false) String subcategory,
                                      @RequestParam(required = false) String brand, @RequestParam(required = false) String q,
                                      @RequestParam(required = false) String color, @RequestParam(required = false) Integer limit) {
        // o texto do nome é lido também como DESCRIÇÃO da peça (estampa, logo, lados, cores) — com IA quando disponível (RF24)
        return catalog.search(user == null ? null : user.id(), new CatalogService.SearchRequest(category, subcategory, brand, q, color, limit));
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
                                      @RequestParam(required = false) String brandId) {
        return catalog.browse(new CatalogService.BrowseRequest(brand, category, subcategory, q, page, size, brandId));
    }

    @GetMapping("/api/catalog/summary")
    @Operation(summary = "RF47 — Tamanho do acervo visível: peças e marcas com peças")
    public Map<String, Object> summary() {
        return catalog.summary();
    }

    @GetMapping("/api/catalog/products/{id}")
    @Operation(summary = "RF47 — Produto do catálogo com variantes, fotos oficiais e proveniência")
    public Map<String, Object> product(@PathVariable UUID id) {
        return catalog.product(id);
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
