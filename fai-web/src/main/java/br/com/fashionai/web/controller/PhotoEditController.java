package br.com.fashionai.web.controller;

import br.com.fashionai.application.photoedit.PhotoEditService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF15 · Editor de fotografia da peça: receita não destrutiva, prévia, versões e Automático (só o dono da peça). */
@RestController
@RequestMapping("/api/pieces/{pieceId}/photo-edits")
@Tag(name = "RF15 · Editor de fotografia da peça")
public class PhotoEditController {
    private final PhotoEditService edits;

    public PhotoEditController(PhotoEditService edits) {
        this.edits = edits;
    }

    @GetMapping("/session")
    @Operation(summary = "RF15 — Foto original, dimensões, receita da canônica vigente e limites da política")
    public Map<String, Object> session(CurrentUser user, @PathVariable UUID pieceId) {
        return edits.session(user, pieceId);
    }

    @PostMapping("/auto")
    @Operation(summary = "RF15 — Receita sugerida (endireitar, fundo branco, quadro 4:5, luz); não salva")
    public Map<String, Object> auto(CurrentUser user, @PathVariable UUID pieceId) {
        return edits.auto(user, pieceId);
    }

    @PostMapping("/preview")
    @Operation(summary = "RF15 — Prévia (PNG base64) renderizada pelo mesmo código do salvamento, com qualidade e avisos")
    public Map<String, Object> preview(CurrentUser user, @PathVariable UUID pieceId, @RequestBody Map<String, Object> recipe) {
        return edits.preview(user, pieceId, recipe);
    }

    @PostMapping
    @Operation(summary = "RF15.CA02 — Salva uma versão: CANONICAL troca a foto da peça (original preservada); PRESENTATION fica ao lado, rotulada")
    public Map<String, Object> save(CurrentUser user, @PathVariable UUID pieceId, @RequestBody Map<String, Object> recipe) {
        return edits.save(user, pieceId, recipe);
    }

    @GetMapping
    @Operation(summary = "RF15.CA07 — Histórico de versões da foto da peça (mais recente primeiro)")
    public List<Map<String, Object>> versions(CurrentUser user, @PathVariable UUID pieceId) {
        return edits.versions(user, pieceId);
    }

    @PostMapping("/{versionId}/restore")
    @Operation(summary = "RF15.CA07 — Restaura uma versão canônica anterior como foto da peça")
    public Map<String, Object> restore(CurrentUser user, @PathVariable UUID pieceId, @PathVariable UUID versionId) {
        return edits.restore(user, pieceId, versionId);
    }
}
