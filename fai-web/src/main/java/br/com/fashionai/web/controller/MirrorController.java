package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MirrorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me/mirror")
@Tag(name = "RF33 — Smart Mirror e Vista-me")
public class MirrorController {
    private final MirrorService mirror;

    public MirrorController(MirrorService mirror) {
        this.mirror = mirror;
    }

    @GetMapping
    @Operation(summary = "RF33.CA01 — Estado do espelho (slots, peças vestidas, restrições de desafio e os seis números do look, P3-07)")
    public Map<String, Object> state(CurrentUser user) {
        return mirror.state(user);
    }

    public record TipoLookRequest(@NotNull UUID tipoLookId) { }

    @PutMapping("/tipo-look")
    @Operation(summary = "Defesa — Persistir o tipo de look escolhido no Espelho")
    public Map<String, Object> tipoLook(CurrentUser user, @jakarta.validation.Valid @RequestBody TipoLookRequest body) {
        return mirror.updateTipoLook(user, body.tipoLookId());
    }

    public record PieceRequest(@NotNull UUID pieceId) {
    }

    @PostMapping("/pieces")
    @Operation(summary = "RF33.CA02 — Vestir uma peça no espelho")
    public Map<String, Object> place(CurrentUser user, @RequestBody PieceRequest body) {
        return mirror.place(user, body.pieceId());
    }

    @PostMapping("/rack")
    @Operation(summary = "QUARTO-ESPELHO — Levar a peça ao espelho (entra na lista para provar, sem vestir; sem duplicar)")
    public Map<String, Object> bring(CurrentUser user, @RequestBody PieceRequest body) {
        return mirror.bring(user, body.pieceId());
    }

    @DeleteMapping("/rack/{pieceId}")
    @Operation(summary = "QUARTO-ESPELHO — Tirar a peça da lista do espelho (e do corpo); continua no guarda-roupa")
    public Map<String, Object> unbring(CurrentUser user, @PathVariable UUID pieceId) {
        return mirror.unbring(user, pieceId);
    }

    @DeleteMapping("/pieces/{pieceId}")
    @Operation(summary = "RF33.CA02 — Tirar uma peça")
    public Map<String, Object> remove(CurrentUser user, @PathVariable UUID pieceId) {
        return mirror.remove(user, pieceId);
    }

    @DeleteMapping
    @Operation(summary = "RF33 — Limpar o espelho")
    public Map<String, Object> clear(CurrentUser user) {
        return mirror.clear(user);
    }

    @GetMapping("/suggestions")
    @Operation(summary = "RF33.CA03 — Sugestões para um slot")
    public Map<String, Object> suggest(CurrentUser user, @RequestParam String slot) {
        return mirror.suggest(user, slot);
    }

    @GetMapping("/wardrobe")
    @Operation(summary = "RF33 — Peças do guarda-roupa que podem ir para um slot (escolha manual, sem IA)")
    public Map<String, Object> wardrobe(CurrentUser user, @RequestParam String slot) {
        return mirror.wardrobe(user, slot);
    }

    public record VistaMeRequest(String prompt, List<UUID> anchorIds, UUID focusPieceId, Boolean keepMirror) {
    }

    @PostMapping("/vista-me")
    @Operation(summary = "RF33.CA04–CA07 — Vista-me: look completo a partir de um pedido em linguagem natural")
    public Map<String, Object> vistaMe(CurrentUser user, @RequestBody VistaMeRequest body) {
        return mirror.vistaMe(user, body.prompt(), body.anchorIds(), body.focusPieceId(), Boolean.TRUE.equals(body.keepMirror()));
    }

    @PostMapping("/another")
    @Operation(summary = "RF33.CA08 — Outro look com o mesmo pedido")
    public Map<String, Object> another(CurrentUser user) {
        return mirror.another(user);
    }

    @PostMapping("/slots/{slot}/swap")
    @Operation(summary = "RF33.CA08 — Trocar só uma peça do look")
    public Map<String, Object> swap(CurrentUser user, @PathVariable String slot) {
        return mirror.swap(user, slot);
    }

    @PostMapping("/take-one-off")
    @Operation(summary = "RF33.CA09 — 'Tira uma coisa': simplificar o look")
    public Map<String, Object> takeOneOff(CurrentUser user) {
        return mirror.takeOneOff(user);
    }

    @PostMapping("/use")
    @Operation(summary = "RF33.CA10 — Usar o look de hoje (Look do Dia + diário)")
    public Map<String, Object> useLook(CurrentUser user) {
        return mirror.useLook(user);
    }

    public record SaveRequest(String title, Boolean publish) {
    }

    @PostMapping("/save")
    @Operation(summary = "RF33.CA11 — Salvar o look do espelho como esquema")
    public Map<String, Object> save(CurrentUser user, @RequestBody(required = false) SaveRequest body) {
        return mirror.save(user, body == null ? null : body.title(), body != null && Boolean.TRUE.equals(body.publish()));
    }

    public record DraftRequest(String origin) {
    }

    @PostMapping("/draft")
    @Operation(summary = "RF33 — Levar o look do espelho para o editor de esquemas")
    public Map<String, Object> draft(CurrentUser user, @RequestBody(required = false) DraftRequest body) {
        return mirror.draft(user, body == null ? null : body.origin());
    }

    @GetMapping("/grwm")
    @Operation(summary = "RF33.CA12 — Storyboard GRWM do look atual")
    public Map<String, Object> grwm(CurrentUser user) {
        return mirror.grwmStoryboard(user);
    }
}
