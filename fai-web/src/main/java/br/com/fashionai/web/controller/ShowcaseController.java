package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ShowcaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import br.com.fashionai.web.support.Uploads;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/** Vitrines 3D: "Gerar 3D" das anatomias, Passarela 3D do Explorar e as abas Eras/Coleções do RF22. */
@RestController
@Tag(name = "Vitrines 3D — Passarela, Eras, Coleções e Gerar 3D")
public class ShowcaseController {
    private final ShowcaseService showcase;

    public ShowcaseController(ShowcaseService showcase) {
        this.showcase = showcase;
    }

    @GetMapping("/api/schemes/{id}/look3d")
    @Operation(summary = "Gerar 3D — look do esquema montado no manequim (sexo do RF1, cabeça com a foto de perfil)")
    public Map<String, Object> look3d(CurrentUser viewer, @PathVariable UUID id) {
        return showcase.look3d(viewer, id);
    }

    @PostMapping("/api/schemes/{id}/model3d")
    @Operation(summary = "Gerar 3D — dono pede o modelo 3D (RF16) de todas as peças do esquema que ainda não têm")
    public Map<String, Object> requestModels(CurrentUser user, @PathVariable UUID id) {
        return showcase.requestModels(user, id);
    }

    @GetMapping("/api/pieces/{id}/look3d")
    @Operation(summary = "Gerar 3D — peça sozinha no manequim (modelo do RF16 quando existe)")
    public Map<String, Object> piece3d(CurrentUser viewer, @PathVariable UUID id) {
        return showcase.piece3d(viewer, id);
    }

    @GetMapping("/api/explorer/runway")
    @Operation(summary = "Passarela 3D — desfile do dia com o Look do Dia de cada perfil visível (atualiza todo dia)")
    public Map<String, Object> runway(CurrentUser viewer, @RequestParam(required = false) Integer limit) {
        return showcase.runway(viewer, limit);
    }

    @GetMapping("/api/institutional/{slug}/showcase/{kind}")
    @Operation(summary = "RF22 — eras da celebridade (kind=eras) ou coleções da marca (kind=collections)")
    public Map<String, Object> list(CurrentUser viewer, @PathVariable String slug, @PathVariable String kind) {
        return showcase.list(viewer, slug, ShowcaseService.kind(kind));
    }

    @GetMapping("/api/institutional/{slug}/showcase/{kind}/items")
    @Operation(summary = "RF22 — busca de esquemas/peças por era ou coleção, texto e ano")
    public Map<String, Object> items(CurrentUser viewer, @PathVariable String slug, @PathVariable String kind,
                                     @RequestParam(required = false) UUID groupingId, @RequestParam(required = false) String q,
                                     @RequestParam(required = false) String type, @RequestParam(required = false) String sort,
                                     @RequestParam(required = false) Integer year) {
        return showcase.items(viewer, slug, ShowcaseService.kind(kind), groupingId, q, type, sort, year);
    }

    @GetMapping("/api/institutional/{slug}/showcase/{kind}/insights")
    @Operation(summary = "RF22 — insights: ranking de eras (palcos 2D) ou coleções (mini lojas 3D)")
    public Map<String, Object> insights(CurrentUser viewer, @PathVariable String slug, @PathVariable String kind) {
        return showcase.insights(viewer, slug, ShowcaseService.kind(kind));
    }

    @PostMapping(value = "/api/pieces/{id}/mannequin-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF4 · Foto com meu manequim — peça superior/corpo inteiro vestindo o manequim (rosto da foto de perfil ou padrão)")
    public Map<String, Object> pieceMannequinPhoto(CurrentUser user, @PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return showcase.pieceMannequinPhoto(user, id, Uploads.image(file));
    }

    @PostMapping(value = "/api/schemes/{id}/mannequin-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF5 · Foto com meu manequim — o look inteiro no manequim; asCover=true vira a foto do post")
    public Map<String, Object> schemeMannequinPhoto(CurrentUser user, @PathVariable UUID id, @RequestPart("file") MultipartFile file,
                                                    @RequestParam(defaultValue = "false") boolean asCover) {
        return showcase.schemeMannequinPhoto(user, id, Uploads.image(file), asCover);
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/api/{kind:pieces|schemes}/{id}/mannequin-photo")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    @Operation(summary = "RF4/RF5 · Remover a foto com manequim")
    public void deleteMannequinPhoto(CurrentUser user, @PathVariable String kind, @PathVariable UUID id) {
        showcase.deleteMannequinPhoto(user, "schemes".equals(kind) ? "scheme" : "piece", id);
    }

    @PostMapping(value = "/api/groupings/{id}/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF22 — Foto da era ou arte da coleção (header da busca e vitrine da mini loja 3D)")
    public Map<String, Object> groupingCover(CurrentUser user, @PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return showcase.groupingCover(user, id, Uploads.image(file));
    }

    @GetMapping("/api/institutional/{slug}/stage")
    @Operation(summary = "RF22 — My Stage 3D: foto da celebridade no manequim, no palco 3D")
    public Map<String, Object> stage(CurrentUser viewer, @PathVariable String slug, @RequestParam(required = false) UUID schemeId) {
        return showcase.stage(viewer, slug, schemeId);
    }
}
