package br.com.fashionai.web.controller;

import br.com.fashionai.application.marketplace.FaiDigitalOfferForm;
import br.com.fashionai.application.marketplace.FaiDigitalStoreService;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class FaiDigitalStoreController {
    private final FaiDigitalStoreService store;

    public FaiDigitalStoreController(FaiDigitalStoreService store) {
        this.store = store;
    }

    @GetMapping("/api/fai-store/offers")
    public List<Map<String, Object>> offers(@RequestParam String kind) {
        return store.offers(kind);
    }

    @GetMapping("/api/fai-store/purchases")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return store.mine(user);
    }

    @PostMapping("/api/fai-store/offers/{code}/buy")
    public Map<String, Object> buy(CurrentUser user, @PathVariable String code) {
        return store.buy(user, code);
    }

    @PutMapping("/api/admin/fai-store/offers")
    public Map<String, Object> save(CurrentUser user, @RequestBody FaiDigitalOfferForm form) {
        return store.save(user, form);
    }
}
