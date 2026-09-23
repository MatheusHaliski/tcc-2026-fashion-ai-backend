package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.TryOnService;
import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.MannequinSex;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/try-on")
@Tag(name = "RF18 — Provador virtual 2D")
public class TryOnController {
    private final TryOnService tryOn;

    public TryOnController(TryOnService tryOn) {
        this.tryOn = tryOn;
    }

    @GetMapping
    @Operation(summary = "RF18.CA01 — Estado do provador: manequim, preferências e peças elegíveis por camada")
    public Map<String, Object> state(CurrentUser user, @RequestParam(required = false) MannequinSex sex) {
        return tryOn.state(user, sex);
    }

    public record PreferencesRequest(MannequinSex sex, String skinTone, BodyBuild build) {
    }

    @PutMapping("/preferences")
    @Operation(summary = "RF18 — Salvar manequim (sexo, tom de pele, biotipo)")
    public Map<String, Object> preferences(CurrentUser user, @RequestBody PreferencesRequest body) {
        return tryOn.savePreferences(user, body.sex(), body.skinTone(), body.build());
    }

    public record RenderRequest(MannequinSex sex, @NotEmpty List<UUID> pieceIds) {
    }

    @PostMapping("/renders")
    @Operation(summary = "RF18.CA03 — Renderizar look no manequim (FASHN → compositor local em fallback)")
    public Map<String, Object> render(CurrentUser user, @RequestBody RenderRequest body) {
        return tryOn.render(user, body.sex(), body.pieceIds());
    }

    public record SaveRequest(@NotEmpty List<UUID> pieceIds, String title, String tryOnUrl) {
    }

    @PostMapping("/schemes")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF18.CA05 — Salvar o look provado como esquema")
    public Map<String, Object> saveAsScheme(CurrentUser user, @RequestBody SaveRequest body) {
        return tryOn.saveAsScheme(user, body.pieceIds(), body.title(), body.tryOnUrl());
    }
}
