package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.PhotoService;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF12 — Fotos, curadoria e momentos-chave")
public class PhotoController {
    private final PhotoService photos;

    public PhotoController(PhotoService photos) {
        this.photos = photos;
    }

    @GetMapping("/api/me/photos")
    @Operation(summary = "RF12.CA01 — Minhas fotos por origem (peças, try-on, desafios…)")
    public Map<String, Object> list(CurrentUser user, @RequestParam(required = false) PhotoOrigin origin,
                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "40") int size) {
        return photos.list(user, origin, page, size);
    }

    @DeleteMapping("/api/photos/{id}")
    @Operation(summary = "RF12.CA03 — Excluir foto (pede confirmação quando há peça vinculada)")
    public Map<String, Object> delete(CurrentUser user, @PathVariable UUID id, @RequestParam(defaultValue = "false") boolean confirmed) {
        return photos.delete(user, id, confirmed);
    }

    public record BulkDelete(List<UUID> ids, boolean confirmed) {
    }

    @PostMapping("/api/photos/bulk-deletion")
    @Operation(summary = "RF12.CA03 — Excluir várias fotos")
    public Map<String, Object> bulkDelete(CurrentUser user, @RequestBody BulkDelete body) {
        return photos.bulkDelete(user, body.ids(), body.confirmed());
    }

    @GetMapping("/api/photos/{id}/file")
    @Operation(summary = "RF12 — Baixar a foto original")
    public ResponseEntity<byte[]> download(CurrentUser user, @PathVariable UUID id) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"foto-" + id + ".jpg\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM).body(photos.download(user, id));
    }

    public record KeyMoment(boolean key) {
    }

    @PutMapping("/api/photos/{id}/key-moment")
    @Operation(summary = "RF12.CA05 — Marcar/desmarcar momento-chave")
    public Map<String, Object> keyMoment(CurrentUser user, @PathVariable UUID id, @RequestBody KeyMoment body) {
        return photos.setKeyMoment(user, id, body.key());
    }

    @PostMapping("/api/me/photos/curation")
    @Operation(summary = "RF12.CA04 — Curadoria: duplicatas, baixa qualidade e sugestões (Photo Curator)")
    public Map<String, Object> curate(CurrentUser user) {
        return photos.curate(user);
    }

    @GetMapping("/api/me/photos/timeline")
    @Operation(summary = "RF12.CA06 — Linha do tempo de momentos-chave")
    public Map<String, Object> timeline(CurrentUser user) {
        return photos.timeline(user);
    }
}
