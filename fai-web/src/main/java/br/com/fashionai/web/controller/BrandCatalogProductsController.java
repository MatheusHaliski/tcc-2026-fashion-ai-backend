package br.com.fashionai.web.controller;

import br.com.fashionai.application.catalog.BrandCatalogProductsService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Produtos do catálogo da marca (usado pela declaração de acessibilidade). A URL é a mesma da antiga loja física. */
@RestController
@Tag(name = "Catálogo da marca")
public class BrandCatalogProductsController {
    private final BrandCatalogProductsService products;

    public BrandCatalogProductsController(BrandCatalogProductsService products) {
        this.products = products;
    }

    @GetMapping("/api/physical-store/products")
    public List<Map<String, Object>> sellerProducts(CurrentUser user, @RequestParam String category) {
        return products.sellerProducts(user, category);
    }
}
