package br.com.fashionai.web.controller;

import br.com.fashionai.application.marketplace.MarketplaceBrandCatalog;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class MarketplaceBrandCatalogController {
    private final MarketplaceBrandCatalog catalog;

    public MarketplaceBrandCatalogController(MarketplaceBrandCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/api/marketplace/brands/{slug}/catalog")
    public Map<String, Object> browse(@PathVariable String slug, @RequestParam(required = false) String q,
                                      @RequestParam(defaultValue = "0") int page) {
        return catalog.browse(slug, q, page);
    }
}
