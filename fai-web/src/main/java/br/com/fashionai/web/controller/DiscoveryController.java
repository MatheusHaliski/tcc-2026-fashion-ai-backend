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

    /**
     * {@code hypeLevel} (RF53 · P2-01) é FILTRO de faixa mínima do HypeScore v2 público — LOW_SIGNAL, NICHE, RELEVANT, HOT
     * ("Em alta"), TRENDING ou VIRAL —, nunca ordenação; item sem Hype público fica de fora do filtro.
     */
    private static SearchService.Filters filters(String style, String occasion, String color, String brand, String category, String hypeLevel) {
        return new SearchService.Filters(style, occasion, color, brand, category, hypeLevel);
    }

    @GetMapping("/api/feed")
    @Operation(summary = "RF8.CA01 — Feed da comunidade (cursor opaco, relevância = recência + HypeScore v2 público + afinidade; hypeLevel = faixa mínima)")
    public Map<String, Object> feed(CurrentUser viewer, @RequestParam(required = false) String cursor,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(required = false) String style, @RequestParam(required = false) String occasion,
                                    @RequestParam(required = false) String color, @RequestParam(required = false) String brand,
                                    @RequestParam(required = false) String category, @RequestParam(required = false) String hypeLevel) {
        return search.communityFeed(viewer, cursor, size, filters(style, occasion, color, brand, category, hypeLevel));
    }

    @GetMapping("/api/runway")
    @Operation(summary = "RF8 — Passarela: looks em alta das pessoas que sigo e trendsetters")
    public Map<String, Object> runway(CurrentUser viewer, @RequestParam(required = false) String cursor,
                                      @RequestParam(defaultValue = "20") int size) {
        return search.runway(viewer, cursor, size);
    }

    @GetMapping("/api/search")
    @Operation(summary = "RF8.CA03 — Buscar por abas (LOOKS, PECAS, PESSOAS, MARCAS, CELEBRIDADES); hypeLevel filtra Looks e Peças")
    public Map<String, Object> search(CurrentUser viewer, @RequestParam(required = false, name = "q") String term,
                                      @RequestParam(defaultValue = "LOOKS") String tab,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) String style, @RequestParam(required = false) String occasion,
                                      @RequestParam(required = false) String color, @RequestParam(required = false) String brand,
                                      @RequestParam(required = false) String category, @RequestParam(required = false) String cursor,
                                      @RequestParam(required = false) String hypeLevel) {
        return search.search(viewer, term, tab, filters(style, occasion, color, brand, category, hypeLevel), size, cursor);
    }

    @GetMapping("/api/public-pieces")
    @Operation(summary = "RF15 — Peças públicas para adicionar ao meu guarda-roupa (hypeLevel = faixa mínima do Hype público)")
    public Map<String, Object> publicPieces(CurrentUser viewer, @RequestParam(required = false) String cursor,
                                            @RequestParam(defaultValue = "24") int size,
                                            @RequestParam(required = false) String style, @RequestParam(required = false) String occasion,
                                            @RequestParam(required = false) String color, @RequestParam(required = false) String brand,
                                            @RequestParam(required = false) String category, @RequestParam(required = false) String hypeLevel) {
        return search.publicPieces(viewer, filters(style, occasion, color, brand, category, hypeLevel), cursor, size);
    }

    @GetMapping("/api/explorer/global")
    @Operation(summary = "RF26 — Painel global por país (cores, hype, marcas)")
    public Map<String, Object> global(CurrentUser viewer, @RequestParam(required = false) String country,
                                      @RequestParam(required = false) String season, @RequestParam(required = false) String color,
                                      @RequestParam(required = false) String hypeBand) {
        return explorer.globalPanel(viewer, country, season, color, hypeBand);
    }

    /**
     * {@code minLevel} (RF53 · P1-04) = faixa mínima do Hype v2 da marca ({@code hype.level}). {@code hypeMin} continua
     * aceito só por compatibilidade (DEPRECADO: número mínimo comparado ao {@code hype.value} v2; use {@code minLevel}).
     */
    @GetMapping("/api/explorer/brands")
    @Operation(summary = "RF26 — Marcas e lojas por país/categoria (hype v2 agregado; minLevel = faixa mínima; hypeMin deprecado)")
    public Map<String, Object> brands(CurrentUser viewer, @RequestParam(required = false) String term,
                                      @RequestParam(required = false) String country,
                                      @RequestParam(required = false) String category,
                                      @RequestParam(required = false) String sort, @RequestParam(required = false) String color,
                                      @RequestParam(required = false) String season, @RequestParam(required = false) Integer hypeMin,
                                      @RequestParam(required = false) String minLevel) {
        return explorer.brandsAndStores(viewer, term, country, category, sort, color, season, hypeMin, minLevel);
    }

    @GetMapping("/api/explorer/insights")
    @Operation(summary = "RF26 — Insights gerados (Insight Generator; rankings de Hype em v2 público, crescimento separado de volume)")
    public Map<String, Object> insights(CurrentUser viewer) {
        return explorer.insights(viewer);
    }
}
