package br.com.fashionai.web.controller;

import br.com.fashionai.application.faistore.FaiStoreService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Loja FAI Points (/points/loja): itens digitais comprados só com FAI Points e usados só no app. */
@RestController
@Tag(name = "Loja FAI Points")
public class FaiStoreController {
    private final FaiStoreService store;

    public FaiStoreController(FaiStoreService store) {
        this.store = store;
    }

    @GetMapping("/api/fai-store")
    @Operation(summary = "Vitrine da loja com saldo, posse e o que o saldo cobre")
    public Map<String, Object> store(CurrentUser user) {
        return store.store(user);
    }

    @GetMapping("/api/fai-store/mine")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return store.mine(user);
    }

    @PostMapping("/api/fai-store/items/{id}/purchase")
    @Operation(summary = "Compra um item com FAI Points (débito atômico; o mesmo item não é cobrado duas vezes)")
    public Map<String, Object> purchase(CurrentUser user, @PathVariable String id) {
        return store.purchase(user, id);
    }
}
