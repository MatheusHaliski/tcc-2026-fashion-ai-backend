package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.PhysicalStoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "Physical store — FAI Points redemptions")
public class PhysicalStoreController {
    private final PhysicalStoreService store;

    public PhysicalStoreController(PhysicalStoreService store) {
        this.store = store;
    }

    @GetMapping("/api/physical-store")
    @Operation(summary = "Browse in-stock physical products by clothing, shoes, or accessories")
    public List<Map<String, Object>> browse(CurrentUser user, @RequestParam(required = false) String segment) {
        return store.store(user, segment);
    }

    @GetMapping("/api/physical-store/mine")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return store.mine(user);
    }

    @PostMapping("/api/physical-store/listings")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(CurrentUser user, @RequestBody PhysicalStoreService.ListingForm body) {
        return store.save(user, null, body);
    }

    @PutMapping("/api/physical-store/listings/{id}")
    public Map<String, Object> update(CurrentUser user, @PathVariable UUID id, @RequestBody PhysicalStoreService.ListingForm body) {
        return store.save(user, id, body);
    }

    @DeleteMapping("/api/physical-store/listings/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(CurrentUser user, @PathVariable UUID id) {
        store.delete(user, id);
    }

    @PostMapping("/api/physical-store/listings/{id}/redeem")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Redeem one physical item for FAI Points and submit a delivery address")
    public Map<String, Object> buy(CurrentUser user, @PathVariable UUID id, @RequestBody PhysicalStoreService.OrderForm body) {
        return store.buy(user, id, body);
    }

    @GetMapping("/api/me/physical-store/orders")
    public List<Map<String, Object>> myOrders(CurrentUser user) {
        return store.myOrders(user);
    }
}
