package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ExplorerService;
import br.com.fashionai.application.service.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@Tag(name = "RF8/RF26 — Feed, busca e Explorador Global")
public class DiscoveryController {
    private final SearchService search;
    private final ExplorerService explorer;

    public DiscoveryController(SearchService search, ExplorerService explorer) {
        this.search = search;
        this.explorer = explorer;
    }

    private static SearchService.Filters filters(String style, String occasion, String color, String brand, String category) {
        return new SearchService.Filters(style, occasion, color, brand, category);
    }

    @GetMapping("/api/feed")
    @Operation(summary = "RF8.CA01 — Feed da comunidade (cursor opaco, relevância = recência + hype + afinidade)")
    public Map<String, Object> feed(CurrentUser viewer, @RequestParam(required = false) String cursor,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(required = false) String style, @RequestParam(required = false) String occasion,
                                    @RequestParam(required = false) String color, @RequestParam(required = false) String brand,
                                    @RequestParam(required = false) String category) {
        return search.communityFeed(viewer, cursor, size, filters(style, occasion, color, brand, category));
    }

    @GetMapping("/api/runway")
    @Operation(summary = "RF8 — Passarela: looks em alta das pessoas que sigo e trendsetters")
    public Map<String, Object> runway(CurrentUser viewer, @RequestParam(required = false) String cursor,
                                      @RequestParam(defaultValue = "20") int size) {
        return search.runway(viewer, cursor, size);
    }

    @GetMapping("/api/search")
    @Operation(summary = "RF8.CA03 — Buscar por abas (LOOKS, PECAS, PESSOAS, MARCAS, CELEBRIDADES)")
    public Map<String, Object> search(CurrentUser viewer, @RequestParam(required = false, name = "q") String term,
                                      @RequestParam(defaultValue = "LOOKS") String tab,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) String style, @RequestParam(required = false) String occasion,
                                      @RequestParam(required = false) String color, @RequestParam(required = false) String brand,
                                      @RequestParam(required = false) String category) {
        return search.search(viewer, term, tab, filters(style, occasion, color, brand, category), size);
    }

    @GetMapping("/api/public-pieces")
    @Operation(summary = "RF15 — Peças públicas para adicionar ao meu guarda-roupa")
    public Map<String, Object> publicPieces(CurrentUser viewer, @RequestParam(required = false) String cursor,
                                            @RequestParam(defaultValue = "24") int size,
                                            @RequestParam(required = false) String style, @RequestParam(required = false) String occasion,
                                            @RequestParam(required = false) String color, @RequestParam(required = false) String brand,
                                            @RequestParam(required = false) String category) {
        return search.publicPieces(viewer, filters(style, occasion, color, brand, category), cursor, size);
    }

    @GetMapping("/api/explorer/global")
    @Operation(summary = "RF26 — Painel global por país (cores, hype, marcas)")
    public Map<String, Object> global(CurrentUser viewer, @RequestParam(required = false) String country) {
        return explorer.globalPanel(viewer, country);
    }

    @GetMapping("/api/explorer/brands")
    @Operation(summary = "RF26 — Marcas e lojas por país/categoria")
    public Map<String, Object> brands(CurrentUser viewer, @RequestParam(required = false) String term,
                                      @RequestParam(required = false) String country,
                                      @RequestParam(required = false) String category,
                                      @RequestParam(required = false) String sort) {
        return explorer.brandsAndStores(viewer, term, country, category, sort);
    }

    @GetMapping("/api/explorer/insights")
    @Operation(summary = "RF26 — Insights gerados (Insight Generator)")
    public Map<String, Object> insights(CurrentUser viewer) {
        return explorer.insights(viewer);
    }
}
