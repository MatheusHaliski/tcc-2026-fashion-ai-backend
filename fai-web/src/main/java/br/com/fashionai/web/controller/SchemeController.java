package br.com.fashionai.web.controller;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.enums.Visibility;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF5/RF9/RF19 — Esquemas de vestimenta")
public class SchemeController {
    private final SchemeService schemes;

    public SchemeController(SchemeService schemes) {
        this.schemes = schemes;
    }

    @GetMapping("/api/schemes/builder")
    @Operation(summary = "RF5.CA01 — Dados para montar um esquema: peças elegíveis, slots, opções")
    public Map<String, Object> builder(CurrentUser user) {
        if (user == null) {
            // a rota cai no curinga público de GET /api/schemes/*: sem login é 401, não 500
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        return schemes.builder(user);
    }

    @PostMapping("/api/schemes/compositions")
    @Operation(summary = "RF5.CA04 — Gerar combinações com IA (ou motor local em fallback)")
    public SchemeService.ComposeResult compose(CurrentUser user, @RequestBody SchemeService.ComposeRequest body) {
        return schemes.compose(user, body, AiCapability.SCHEME_COMPOSER);
    }

    @PostMapping("/api/schemes")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF5 — Salvar esquema (manual, IA, autopiloto, remix)")
    public Map<String, Object> create(CurrentUser user, @RequestBody SchemeService.SchemeForm form) {
        Map<String, Object> out = schemes.create(user, form);
        // RF20.CA01 — sugestão de vínculo depois do commit, em transação própria (não bloqueia nem desfaz o salvamento)
        if (form.items() != null && form.items().size() >= 2 && out.get("scheme") instanceof Views.SchemeView v) {
            out.put("sealSuggestions", schemes.suggestSealsAfterSave(user, v.id()));
        }
        return out;
    }

    @PostMapping(value = "/api/schemes/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF5 — Foto do look (como um post): pipeline de validação, redimensionamento e remoção de metadados")
    public Map<String, Object> photo(CurrentUser user, @RequestPart("file") org.springframework.web.multipart.MultipartFile file) throws java.io.IOException {
        return schemes.uploadLookPhoto(user, file.getBytes());
    }

    @PostMapping(value = "/api/schemes/preview", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "RF5/RF11 — Pré-visualizar o card antes de salvar")
    public byte[] preview(CurrentUser user, @RequestBody SchemeService.SchemeForm form) {
        return schemes.preview(user, form);
    }

    @GetMapping("/api/schemes/{id}")
    @Operation(summary = "RF5/RF7 — Abrir esquema com itens, fundo, selos e contadores")
    public Map<String, Object> get(CurrentUser viewer, @PathVariable UUID id) {
        return schemes.get(viewer, id);
    }

    @GetMapping("/api/me/schemes")
    @Operation(summary = "RF6 — Meus esquemas (filtros por ocasião e estado)")
    public Views.Page<Views.SchemeView> mine(CurrentUser user,
                                            @RequestParam(required = false) String occasion,
                                            @RequestParam(required = false) String state,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return schemes.mine(user, occasion, state, page, size);
    }

    @PutMapping("/api/schemes/{id}")
    @Operation(summary = "RF9 — Editar esquema")
    public Map<String, Object> update(CurrentUser user, @PathVariable UUID id, @RequestBody SchemeService.SchemeForm form) {
        return schemes.update(user, id, form);
    }

    public record PublishRequest(@NotNull Visibility visibility) {
    }

    @PostMapping("/api/schemes/{id}/publication")
    @Operation(summary = "RF5.CA08 — Publicar com a visibilidade escolhida")
    public Map<String, Object> publish(CurrentUser user, @PathVariable UUID id, @RequestBody PublishRequest body) {
        return schemes.publish(user, id, body.visibility());
    }

    public record ImproveRequest(@NotBlank String instruction) {
    }

    @PostMapping("/api/schemes/{id}/improvements")
    @Operation(summary = "RF9.CA05 — Pedir melhoria por instrução (Edit Assistant) e receber diff")
    public Map<String, Object> improve(CurrentUser user, @PathVariable UUID id, @RequestBody ImproveRequest body) {
        return schemes.improve(user, id, body.instruction());
    }

    @PostMapping("/api/schemes/{id}/improvements/apply")
    @Operation(summary = "RF9.CA05 — Aplicar o diff aceito")
    public Map<String, Object> applyDiff(CurrentUser user, @PathVariable UUID id, @RequestBody Map<String, Object> accepted) {
        return schemes.applyDiff(user, id, accepted);
    }

    public record Flags(Boolean favorite, Boolean disponivel) {
    }

    @PatchMapping("/api/schemes/{id}/flags")
    @Operation(summary = "RF6 — Favoritar / marcar disponibilidade")
    public Map<String, Object> flags(CurrentUser user, @PathVariable UUID id, @RequestBody Flags body) {
        return schemes.toggles(user, id, body.favorite(), body.disponivel());
    }

    @PostMapping("/api/schemes/{id}/archive")
    @Operation(summary = "RF9 — Arquivar esquema")
    public Map<String, Object> archive(CurrentUser user, @PathVariable UUID id) {
        return schemes.archive(user, id);
    }

    @DeleteMapping("/api/schemes/{id}")
    @Operation(summary = "RF7.CA11 — Excluir o look (menu ⋯ do dono); a foto do look sai de Minhas Fotos junto (RF12.CA13)")
    public Map<String, Object> delete(CurrentUser user, @PathVariable UUID id) {
        return schemes.archive(user, id);
    }

    @PostMapping("/api/schemes/{id}/remix")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF19 — Remixar um esquema público para o meu guarda-roupa")
    public Map<String, Object> remix(CurrentUser user, @PathVariable UUID id) {
        return schemes.remix(user, id);
    }

    @GetMapping(value = "/api/schemes/{id}/card.png", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "RF11 — Card renderizado (compacto ou ampliado)")
    public ResponseEntity<byte[]> card(CurrentUser viewer, @PathVariable UUID id, @RequestParam(defaultValue = "false") boolean expanded) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePrivate())
                .contentType(MediaType.IMAGE_PNG).body(schemes.renderCard(viewer, id, expanded));
    }
}
