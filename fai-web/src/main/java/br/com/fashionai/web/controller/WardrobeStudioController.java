package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF4 · Estúdio — foto de produto das peças: fundos disponíveis, refazer no rascunho, gerar/refazer numa peça cadastrada,
 * aprovar ou descartar a versão pendente e levar ao estúdio as peças que ainda não têm foto. Mesmo serviço e mesma tag
 * do OpenAPI de {@link WardrobeController}.
 */
@RestController
@Tag(name = "RF4/RF7/RF15/RF16 — Peças do guarda-roupa")
public class WardrobeStudioController {
    private final WardrobeService wardrobe;

    public WardrobeStudioController(WardrobeService wardrobe) {
        this.wardrobe = wardrobe;
    }

    @GetMapping("/api/studio/backdrops")
    @Operation(summary = "RF4 · Estúdio — fundos disponíveis para a foto de produto")
    public List<Map<String, Object>> studioBackdrops() {
        return wardrobe.studioBackdrops();
    }

    @PostMapping("/api/pieces/analysis/{draftId}/studio")
    @Operation(summary = "RF4 · Estúdio — refaz a foto de estúdio do rascunho com outro fundo (force=true usa o recorte incerto)")
    public Map<String, Object> studioDraft(CurrentUser user, @PathVariable UUID draftId, @RequestParam(defaultValue = "auto") String backdrop,
                                           @RequestParam(defaultValue = "false") boolean force) {
        return wardrobe.studioDraft(user, draftId, backdrop, force);
    }

    @PostMapping("/api/pieces/{id}/studio")
    @Operation(summary = "RF4 · Estúdio — gera/refaz a foto de estúdio de uma peça cadastrada")
    public Views.PieceView studioPiece(CurrentUser user, @PathVariable UUID id, @RequestParam(defaultValue = "auto") String backdrop) {
        return wardrobe.studioPiece(user, id, backdrop);
    }

    @PostMapping("/api/pieces/{id}/studio/approve")
    @Operation(summary = "RF4 · Estúdio — aprova a foto de estúdio (a versão pendente vai ao ar; a anterior fica no histórico)")
    public Views.PieceView approveStudio(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.approveStudio(user, id);
    }

    @DeleteMapping("/api/pieces/{id}/studio/pending")
    @Operation(summary = "RF4 · Estúdio — descarta a versão pendente (a aprovada continua no ar)")
    public Views.PieceView discardStudio(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.discardStudio(user, id);
    }

    @PostMapping("/api/me/pieces/studio")
    @Operation(summary = "RF4 · Estúdio — leva ao estúdio as peças que ainda não têm foto de estúdio (até 40)")
    public Map<String, Object> studioAll(CurrentUser user, @RequestParam(defaultValue = "auto") String backdrop) {
        return wardrobe.studioAll(user, backdrop);
    }
}
