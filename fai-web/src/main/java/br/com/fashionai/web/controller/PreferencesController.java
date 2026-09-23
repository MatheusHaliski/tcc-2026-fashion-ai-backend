package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.PreferencesService;
import br.com.fashionai.web.support.Uploads;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@Tag(name = "RF3/RNF7 — Perfil, preferências e aparência")
public class PreferencesController {
    private final PreferencesService preferences;

    public PreferencesController(PreferencesService preferences) {
        this.preferences = preferences;
    }

    @GetMapping("/api/me/preferences")
    @Operation(summary = "RNF7 — Preferências de interface (tema, idioma, densidade, chrome, manequim)")
    public Map<String, Object> get(CurrentUser user) {
        return preferences.get(user);
    }

    @GetMapping("/api/preferences/options")
    @Operation(summary = "RNF7 — Opções disponíveis para cada preferência")
    public Map<String, Object> options() {
        return preferences.options();
    }

    @PutMapping("/api/me/preferences")
    @Operation(summary = "RNF7 — Salvar preferências (last-write-wins por clientUpdatedAt)")
    public Map<String, Object> update(CurrentUser user, @RequestBody PreferencesService.Update body) {
        return preferences.update(user, body);
    }

    @PatchMapping("/api/me/profile")
    @Operation(summary = "RF3.CA01 — Editar nome de exibição, bio, país, avatar e capa")
    public Object updateProfile(CurrentUser user, @RequestBody PreferencesService.ProfileUpdate body) {
        return preferences.updateProfile(user, body);
    }

    public record UsernameRequest(@NotBlank String username) {
    }

    @PutMapping("/api/me/username")
    @Operation(summary = "RF3.CA02 — Trocar username (limite de trocas por período)")
    public Map<String, Object> changeUsername(CurrentUser user, @RequestBody UsernameRequest body) {
        return preferences.changeUsername(user, body.username());
    }

    @GetMapping("/api/usernames/{username}/availability")
    @Operation(summary = "RF1.CA03 — Verificar se um username está livre")
    public Map<String, Object> availability(@PathVariable String username) {
        return preferences.checkUsername(username);
    }

    @PostMapping(value = "/api/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF3.CA01 — Enviar foto de perfil")
    public Object avatar(CurrentUser user, @RequestPart("file") MultipartFile file) {
        return preferences.uploadProfileImage(user, Uploads.image(file), false);
    }

    @PostMapping(value = "/api/me/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF3.CA01 — Enviar imagem de capa")
    public Object cover(CurrentUser user, @RequestPart("file") MultipartFile file) {
        return preferences.uploadProfileImage(user, Uploads.image(file), true);
    }
}
