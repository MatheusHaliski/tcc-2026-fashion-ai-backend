package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.service.PhotoService;
import br.com.fashionai.web.support.Uploads;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
    @Operation(summary = "RF12.CA05 — Baixar a foto original (sem marca d'água, só o dono)")
    public ResponseEntity<byte[]> download(CurrentUser user, @PathVariable UUID id) {
        byte[] bytes = photos.download(user, id);
        String mime = ImageOps.detectMime(bytes);
        String type = mime == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : mime;
        String ext = mime == null ? "bin" : mime.substring(mime.indexOf('/') + 1).replace("jpeg", "jpg");
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"foto-" + id + "." + ext + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .contentType(MediaType.parseMediaType(type)).body(bytes);
    }

    @PostMapping(value = "/api/photos/{id}/edits", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF12.CA02 / RF15.CA02 — Salvar a edição do Editor Canvas 2D (a original é preservada)")
    public Map<String, Object> saveEdit(CurrentUser user, @PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return photos.saveEdit(user, id, Uploads.image(file));
    }

    @PostMapping(value = "/api/photos/background-removal", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF15.CA01/CA04 — Remoção de fundo sob demanda para o editor")
    public Map<String, Object> removeBackground(CurrentUser user, @RequestPart("file") MultipartFile file) {
        return photos.removeBackground(user, Uploads.image(file));
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
