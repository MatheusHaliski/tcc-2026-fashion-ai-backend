package br.com.fashionai.web.controller;

import br.com.fashionai.application.accessibility.AccessibilityRules;
import br.com.fashionai.application.accessibility.AccessibilityService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF-PESQ-08 — acessibilidade de uso e conforto declarados; filtros por requisição, sem perfil. */
@RestController
@Tag(name = "Catalog — accessibility attributes")
public class AccessibilityController {
    private final AccessibilityService service;

    public AccessibilityController(AccessibilityService service) {
        this.service = service;
    }

    @GetMapping("/api/catalog/accessibility/search")
    public Map<String, Object> search(@RequestParam(defaultValue = "false") boolean easyClosure, @RequestParam(defaultValue = "false") boolean frontOpening,
                                      @RequestParam(defaultValue = "false") boolean magneticClosure, @RequestParam(defaultValue = "false") boolean taglessLabel,
                                      @RequestParam(defaultValue = "false") boolean flatSeams, @RequestParam(defaultValue = "false") boolean softFabric,
                                      @RequestParam(defaultValue = "false") boolean oneHandDressing, @RequestParam(required = false) String category,
                                      @RequestParam(defaultValue = "24") int limit) {
        return service.search(new AccessibilityRules.Filters(easyClosure, frontOpening, magneticClosure, taglessLabel, flatSeams, softFabric, oneHandDressing), category, limit);
    }

    @GetMapping("/api/catalog/products/{id}/accessibility")
    public Map<String, Object> product(@PathVariable UUID id) {
        return service.product(id);
    }

    @PutMapping("/api/catalog/products/{id}/accessibility")
    public Map<String, Object> declare(CurrentUser user, @PathVariable UUID id, @RequestBody AccessibilityService.Declaration body) {
        return service.declare(user, id, body);
    }

    @PostMapping("/api/admin/catalog/products/{id}/accessibility/review")
    public Map<String, Object> review(CurrentUser admin, @PathVariable UUID id) {
        return service.review(admin, id);
    }

    @GetMapping("/api/me/catalog/accessibility")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return service.mine(user);
    }
}
