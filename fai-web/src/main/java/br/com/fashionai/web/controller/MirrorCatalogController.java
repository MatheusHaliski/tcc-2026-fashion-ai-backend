package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MirrorCatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Espelho (RF33) com o catálogo de marcas (RF47): a folha da parte veste um produto do catálogo paginado ao lado das peças
 * do guarda-roupa, só para provar. A resposta é o estado do espelho, como em {@code /api/me/mirror/pieces}.
 */
@RestController
@RequestMapping("/api/me/mirror/catalog")
@Tag(name = "RF33 — Smart Mirror e Vista-me")
public class MirrorCatalogController {
    private final MirrorCatalogService mirrorCatalog;

    public MirrorCatalogController(MirrorCatalogService mirrorCatalog) {
        this.mirrorCatalog = mirrorCatalog;
    }

    /** Só o id do produto: nome, foto, categoria e lugar no corpo saem do catálogo no servidor. */
    public record ProductRequest(UUID productId) {
    }

    @PostMapping
    @Operation(summary = "RF33/RF47 — Vestir no espelho um produto do catálogo de marcas (só para provar; salvar e usar hoje seguem com as peças da pessoa)")
    public Map<String, Object> wear(CurrentUser user, @RequestBody ProductRequest body) {
        return mirrorCatalog.wear(user, body == null ? null : body.productId());
    }

    @DeleteMapping("/{productId}")
    @Operation(summary = "RF33/RF47 — Tirar do espelho o produto do catálogo")
    public Map<String, Object> takeOff(CurrentUser user, @PathVariable UUID productId) {
        return mirrorCatalog.takeOff(user, productId);
    }
}
