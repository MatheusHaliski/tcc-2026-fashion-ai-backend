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
import org.springframework.web.bind.annotation.PutMapping;
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
    @Operation(summary = "RF47 — Busca no catálogo interno (categoria, subcategoria, marca, nome/modelo, cor) com matchScore")
    public Map<String, Object> search(@RequestParam(required = false) String category, @RequestParam(required = false) String subcategory,
                                      @RequestParam(required = false) String brand, @RequestParam(required = false) String q,
                                      @RequestParam(required = false) String color, @RequestParam(required = false) Integer limit) {
        return catalog.search(new CatalogService.SearchRequest(category, subcategory, brand, q, color, limit));
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

    @GetMapping("/api/me/capture-tutorial")
    @Operation(summary = "RF47 — Preferências \"Não mostrar novamente\" do guia de fotografia, por guia")
    public Map<String, Object> tutorial(CurrentUser user) {
        return catalog.tutorialPreferences(user);
    }

    public record TutorialRequest(boolean hidden) {
    }

    @PutMapping("/api/me/capture-tutorial/{guide}")
    @Operation(summary = "RF47 — Esconde ou volta a mostrar o guia de fotografia de uma categoria")
    public Map<String, Object> setTutorial(CurrentUser user, @PathVariable String guide, @RequestBody TutorialRequest request) {
        return catalog.setTutorialHidden(user, guide, request.hidden());
    }
}
