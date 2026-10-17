package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.PhysicalStoreService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class AdminPhysicalStoreController {
    private final PhysicalStoreService store;

    public AdminPhysicalStoreController(PhysicalStoreService store) {
        this.store = store;
    }

    @GetMapping("/api/admin/physical-store/listings")
    public List<Map<String, Object>> listings(CurrentUser admin) {
        return store.adminListings(admin);
    }

    @PutMapping("/api/admin/physical-store/listings/{id}/stock")
    public Map<String, Object> stock(CurrentUser admin, @PathVariable UUID id, @RequestBody PhysicalStoreService.StockForm body) {
        return store.updateStock(admin, id, body);
    }

    @GetMapping("/api/admin/physical-store/orders")
    public List<Map<String, Object>> orders(CurrentUser admin) {
        return store.adminOrders(admin);
    }

    @PutMapping("/api/admin/physical-store/orders/{id}/shipment")
    public Map<String, Object> shipment(CurrentUser admin, @PathVariable UUID id, @RequestBody PhysicalStoreService.ShipmentForm body) {
        return store.updateShipment(admin, id, body);
    }
}
