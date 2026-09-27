package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.web.support.Uploads;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF4/RF7/RF15/RF16 — Peças do guarda-roupa")
public class WardrobeController {
    private final WardrobeService wardrobe;

    public WardrobeController(WardrobeService wardrobe) {
        this.wardrobe = wardrobe;
    }

    @PostMapping(value = "/api/pieces/analysis", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF4.CA02–CA04 — Analisar foto: remoção de fundo, flat lay e pré-preenchimento por IA")
    public WardrobeService.Draft analyze(CurrentUser user, @RequestPart("file") MultipartFile file) {
        return wardrobe.analyze(user, Uploads.image(file));
    }

    @PostMapping(value = "/api/pieces/analysis/batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF4.CA11 — Analisar várias fotos de uma vez (até 10)")
    public List<WardrobeService.Draft> analyzeBatch(CurrentUser user, @RequestPart("files") List<MultipartFile> files) {
        return wardrobe.analyzeBatch(user, Uploads.images(files));
    }

    @PostMapping("/api/pieces")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF4.CA05 — Cadastrar a peça a partir do rascunho analisado")
    public Views.PieceView create(CurrentUser user, @RequestBody WardrobeService.PieceForm form) {
        return wardrobe.create(user, form);
    }

    @PostMapping("/api/pieces/batch")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF4.CA11 — Cadastrar várias peças de uma vez")
    public List<Views.PieceView> createBatch(CurrentUser user, @RequestBody List<WardrobeService.PieceForm> forms) {
        return wardrobe.createBatch(user, forms);
    }

    @GetMapping("/api/me/closet")
    @Operation(summary = "RF7 — Meu closet com filtros, busca e ordenação")
    public Views.Page<Views.PieceView> myCloset(CurrentUser user,
                                               @RequestParam(required = false) String category,
                                               @RequestParam(required = false) String color,
                                               @RequestParam(required = false) String season,
                                               @RequestParam(required = false) String occasion,
                                               @RequestParam(required = false) String style,
                                               @RequestParam(required = false) String state,
                                               @RequestParam(required = false) String q,
                                               @RequestParam(required = false) String sort,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "24") int size) {
        return wardrobe.closet(user, user.id(), new WardrobeService.ClosetFilter(category, color, season, occasion, style, state, q, sort, page, size));
    }

    @GetMapping("/api/users/{ownerId}/closet")
    @Operation(summary = "RF7/RF17 — Closet de outro usuário (respeita visibilidade)")
    public Views.Page<Views.PieceView> closet(CurrentUser viewer, @PathVariable UUID ownerId,
                                             @RequestParam(required = false) String category,
                                             @RequestParam(required = false) String color,
                                             @RequestParam(required = false) String season,
                                             @RequestParam(required = false) String occasion,
                                             @RequestParam(required = false) String style,
                                             @RequestParam(required = false) String state,
                                             @RequestParam(required = false) String q,
                                             @RequestParam(required = false) String sort,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "24") int size) {
        // estado (disponível / indisponível / à venda) também vale no perfil: são dados públicos da peça
        return wardrobe.closet(viewer, ownerId, new WardrobeService.ClosetFilter(category, color, season, occasion, style, state, q, sort, page, size));
    }

    @GetMapping("/api/pieces/{id}")
    @Operation(summary = "RF7 — Detalhe da peça (com contexto do esquema de origem, se houver)")
    public Map<String, Object> detail(CurrentUser viewer, @PathVariable UUID id, @RequestParam(required = false) UUID fromScheme) {
        return wardrobe.detail(viewer, id, fromScheme);
    }

    @PutMapping("/api/pieces/{id}")
    @Operation(summary = "RF7.CA05 — Editar a peça")
    public Views.PieceView update(CurrentUser user, @PathVariable UUID id, @RequestBody WardrobeService.PieceForm form) {
        return wardrobe.update(user, id, form);
    }

    public record Flags(Boolean favorite, Boolean disponivel, Boolean forSale) {
    }

    @PatchMapping("/api/pieces/{id}/flags")
    @Operation(summary = "RF7 — Favoritar, marcar disponível/indisponível ou à venda")
    public Views.PieceView flags(CurrentUser user, @PathVariable UUID id, @RequestBody Flags body) {
        return wardrobe.toggles(user, id, body.favorite(), body.disponivel(), body.forSale());
    }

    @PostMapping("/api/pieces/{id}/worn")
    @Operation(summary = "RF7/RF34 — Registrar uso da peça hoje")
    public Views.PieceView worn(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.markWorn(user, id);
    }

    @GetMapping("/api/pieces/{id}/deletion-impact")
    @Operation(summary = "RF7.CA07 — Esquemas afetados antes de excluir")
    public Map<String, Object> deletionImpact(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.deletionImpact(user, id);
    }

    @DeleteMapping("/api/pieces/{id}")
    @Operation(summary = "RF7.CA07 — Excluir a peça")
    public Map<String, Object> delete(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.delete(user, id);
    }

    @PutMapping(value = "/api/pieces/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF4/RF12 — Substituir a foto da peça (reprocessa o flat lay)")
    public Views.PieceView replaceImage(CurrentUser user, @PathVariable UUID id, @RequestPart("file") MultipartFile file,
                                        @RequestParam(required = false) UUID editedFromPhotoId) {
        return wardrobe.replaceImage(user, id, Uploads.image(file), editedFromPhotoId);
    }

    @PostMapping("/api/pieces/{id}/background-removal")
    @Operation(summary = "RF4.CA02 — Reprocessar remoção de fundo")
    public Map<String, Object> removeBackground(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.removeBackground(user, id);
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

    @PostMapping("/api/me/pieces/studio")
    @Operation(summary = "RF4 · Estúdio — leva ao estúdio as peças que ainda não têm foto de estúdio (até 40)")
    public Map<String, Object> studioAll(CurrentUser user, @RequestParam(defaultValue = "auto") String backdrop) {
        return wardrobe.studioAll(user, backdrop);
    }

    @PostMapping("/api/pieces/{id}/model3d")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "RF16 — Solicitar modelo 3D da peça")
    public Map<String, Object> request3d(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.request3d(user, id);
    }

    @GetMapping("/api/pieces/{id}/model3d")
    @Operation(summary = "RF16 — Status/URL do modelo 3D")
    public Map<String, Object> status3d(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.status3d(user, id);
    }

    @PostMapping("/api/pieces/{id}/copy")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF15 — Adicionar uma peça pública ao meu guarda-roupa")
    public Views.PieceView copy(CurrentUser user, @PathVariable UUID id) {
        return wardrobe.addToWardrobe(user, id);
    }

    @GetMapping("/api/taxonomy")
    @Operation(summary = "RF4 — Categorias, subcategorias, cores, materiais, ocasiões e estilos")
    public Map<String, Object> taxonomy() {
        return wardrobe.taxonomy();
    }
}
