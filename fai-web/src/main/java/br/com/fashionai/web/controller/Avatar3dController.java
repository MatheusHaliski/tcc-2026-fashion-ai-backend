package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.Avatar3dService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
@Tag(name = "RF40 — Meu Avatar 3D")
public class Avatar3dController {
    private final Avatar3dService avatars;

    public Avatar3dController(Avatar3dService avatars) {
        this.avatars = avatars;
    }

    @GetMapping("/api/me/avatar3d")
    @Operation(summary = "RF40 — O avatar 3D da pessoa (ou exists=false)")
    public Map<String, Object> get(CurrentUser user) {
        return avatars.get(user);
    }

    @PostMapping(value = "/api/me/avatar3d", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF40 — Salvar/refazer o avatar: parte 'meta' (JSON com model, adjust, photos, warnings, consent) + parte 'texture' (atlas do rosto)")
    public Map<String, Object> save(CurrentUser user, @RequestPart("meta") String meta, @RequestPart("texture") MultipartFile texture) {
        Avatar3dService.SaveCommand cmd;
        try {
            cmd = Json.read(meta, Avatar3dService.SaveCommand.class);
        } catch (RuntimeException e) {
            throw ApiException.badRequest("MODELO_INVALIDO", Msg.t("avatar3d.modelo_invalido"));
        }
        byte[] bytes;
        try {
            bytes = texture == null ? null : texture.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("TEXTURA_INVALIDA", Msg.t("avatar3d.textura_invalida"));
        }
        return avatars.save(user, cmd, bytes);
    }

    @PatchMapping("/api/me/avatar3d")
    @Operation(summary = "RF40 — Ajustes finos e visibilidade na Passarela")
    public Map<String, Object> update(CurrentUser user, @RequestBody Avatar3dService.SettingsCommand body) {
        return avatars.update(user, body);
    }

    @DeleteMapping("/api/me/avatar3d")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF40 — Excluir o avatar 3D e a textura do rosto")
    public void delete(CurrentUser user) {
        avatars.delete(user);
    }

    @GetMapping("/api/avatar3d/{userId}/texture")
    @Operation(summary = "RF40 — Textura do rosto (dono, ou qualquer pessoa logada se o avatar for público)")
    public ResponseEntity<byte[]> texture(CurrentUser user, @PathVariable UUID userId) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePrivate())   // a URL muda (?v=) quando o avatar muda
                .body(avatars.texture(user, userId));
    }
}
