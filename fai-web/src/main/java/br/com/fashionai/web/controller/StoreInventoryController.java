package br.com.fashionai.web.controller;

import br.com.fashionai.application.marketplace.StoreInventoryService;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class StoreInventoryController {
    private final StoreInventoryService inventory;

    public StoreInventoryController(StoreInventoryService inventory) {
        this.inventory = inventory;
    }

    @PutMapping("/api/me/marketplace/stores/{storeId}/pieces/{pieceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void assign(CurrentUser user, @PathVariable UUID storeId, @PathVariable UUID pieceId,
                       @RequestBody StorePlacement placement) {
        inventory.assign(user, storeId, pieceId, placement.listed());
    }

    public record StorePlacement(boolean listed) {}
}
