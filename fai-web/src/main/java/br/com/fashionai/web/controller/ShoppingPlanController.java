package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.shopping.ShoppingPlanService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF-PESQ-09 — plano de compras por lacunas e orçamento; nunca executa compra. */
@RestController
@Tag(name = "Wardrobe — shopping plan")
public class ShoppingPlanController {
    private final ShoppingPlanService service;

    public ShoppingPlanController(ShoppingPlanService service) {
        this.service = service;
    }

    @PostMapping("/api/me/shopping-plan")
    public Map<String, Object> plan(CurrentUser user, @RequestBody ShoppingPlanService.Request body) {
        return service.plan(user, body);
    }

    @GetMapping("/api/me/shopping-plan/dismissals")
    public List<Map<String, Object>> dismissed(CurrentUser user) {
        return service.dismissed(user);
    }

    @PutMapping("/api/me/shopping-plan/dismissals/{productId}")
    public Map<String, Object> dismiss(CurrentUser user, @PathVariable UUID productId, @RequestBody Map<String, String> body) {
        return service.dismiss(user, productId, body == null ? null : body.get("kind"));
    }

    @DeleteMapping("/api/me/shopping-plan/dismissals/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void undismiss(CurrentUser user, @PathVariable UUID productId) {
        service.undismiss(user, productId);
    }
}
