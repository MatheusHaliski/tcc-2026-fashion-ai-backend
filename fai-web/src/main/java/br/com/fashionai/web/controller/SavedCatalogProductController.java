package br.com.fashionai.web.controller;

import br.com.fashionai.application.catalog.SavedCatalogProductService;
import br.com.fashionai.application.catalog.SavedCatalogProductService.SavedPage;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/me/saved-catalog-products")
public class SavedCatalogProductController {
    private final SavedCatalogProductService saved;

    public SavedCatalogProductController(SavedCatalogProductService saved) {
        this.saved = saved;
    }

    @GetMapping
    public SavedPage list(CurrentUser user, @RequestParam(defaultValue = "0") int page) {
        return saved.saved(user, page);
    }

    @GetMapping("/ids")
    public List<String> ids(CurrentUser user) {
        return saved.ids(user);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(CurrentUser user, @PathVariable UUID id) {
        saved.save(user, id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(CurrentUser user, @PathVariable UUID id) {
        saved.remove(user, id);
    }
}
