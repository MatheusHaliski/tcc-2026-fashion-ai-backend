package br.com.fashionai.web.controller;

import br.com.fashionai.application.marketplace.BrandStoreImportRow;
import br.com.fashionai.application.marketplace.BrandStoreImportService;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class BrandStoreImportController {
    private final BrandStoreImportService imports;

    public BrandStoreImportController(BrandStoreImportService imports) {
        this.imports = imports;
    }

    @PostMapping("/api/me/marketplace/stores/import")
    public Map<String, Integer> load(CurrentUser user, @RequestBody List<BrandStoreImportRow> rows) {
        return Map.of("processed", imports.apply(user, rows));
    }
}
