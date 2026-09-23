package br.com.fashionai.web.controller;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.BackgroundStudioService;
import br.com.fashionai.web.support.Uploads;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF11/RF23 — Background Studio, skins e assets visuais")
public class BackgroundController {
    private final BackgroundStudioService studio;
    private final AssetCatalogService assets;

    public BackgroundController(BackgroundStudioService studio, AssetCatalogService assets) {
        this.studio = studio;
        this.assets = assets;
    }

    @GetMapping("/api/backgrounds/catalog")
    @Operation(summary = "RF11 — Catálogo de auras, materiais, gradientes, mosaicos e skins")
    public Map<String, Object> catalog() {
        return studio.catalog();
    }

    @GetMapping("/api/backgrounds/combination")
    @Operation(summary = "RF11 — Resolver combinação aura × material (animada/mosaico)")
    public Map<String, Object> combination(@RequestParam String aura, @RequestParam String material,
                                           @RequestParam(defaultValue = "false") boolean animated,
                                           @RequestParam(defaultValue = "false") boolean mosaic) {
        return studio.combination(aura, material, animated, mosaic);
    }

    @GetMapping("/api/backgrounds/recommendations")
    @Operation(summary = "RF11 — Skins recomendadas por estilo e ocasião")
    public Map<String, Object> recommend(@RequestParam(required = false) List<String> styles,
                                         @RequestParam(required = false) List<String> occasions) {
        return studio.recommend(styles == null ? List.of() : styles, occasions == null ? List.of() : occasions);
    }

    @PostMapping("/api/backgrounds/art")
    @Operation(summary = "RF11.CA06 — Gerar arte de fundo por prompt (Background Generator)")
    public Map<String, Object> art(CurrentUser user, @RequestBody BackgroundStudioService.ArtRequest body) {
        return studio.generateArt(user, body);
    }

    @PostMapping(value = "/api/backgrounds/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF11 — Enviar imagem própria de fundo (card, chrome ou peça)")
    public Map<String, Object> upload(CurrentUser user, @RequestPart("file") MultipartFile file,
                                      @RequestParam(defaultValue = "card") String target) {
        return studio.upload(user, Uploads.image(file), target);
    }

    public record SchemeBackground(Map<String, Object> config, Boolean applyRecommendedDirection) {
    }

    @PutMapping("/api/schemes/{id}/background")
    @Operation(summary = "RF11 — Aplicar configuração de fundo ao esquema")
    public Map<String, Object> saveScheme(CurrentUser user, @PathVariable UUID id, @RequestBody SchemeBackground body) {
        return studio.saveScheme(user, id, body.config(), Boolean.TRUE.equals(body.applyRecommendedDirection()));
    }

    @DeleteMapping("/api/schemes/{id}/background")
    @Operation(summary = "RF11 — Voltar ao fundo padrão do esquema")
    public Map<String, Object> resetScheme(CurrentUser user, @PathVariable UUID id) {
        return studio.resetScheme(user, id);
    }

    @PutMapping("/api/pieces/{id}/background")
    @Operation(summary = "RF11 — Fundo do card da peça")
    public Map<String, Object> savePiece(CurrentUser user, @PathVariable UUID id, @RequestBody Map<String, Object> config) {
        return studio.savePiece(user, id, config);
    }

    @PostMapping("/api/admin/skins/{skinId}/thumbnail")
    @Operation(summary = "RF11 — (admin) Gerar thumbnail de uma skin")
    public Map<String, Object> skinThumbnail(CurrentUser admin, @PathVariable String skinId,
                                             @RequestParam(defaultValue = "false") boolean pieceContext) {
        return studio.generateSkinThumbnail(admin, skinId, pieceContext);
    }

    @GetMapping("/api/assets/manifest")
    @Operation(summary = "RF23/RNF7 — Manifesto dos assets públicos (chrome, aura, material, mosaico, skins)")
    public Map<String, Object> manifest() {
        return assets.manifest();
    }

    @GetMapping("/api/assets/chrome")
    @Operation(summary = "RF23 — Fundos do chrome do app")
    public List<Map<String, Object>> chrome() {
        return assets.chromeBackgrounds();
    }

    @GetMapping("/api/assets/skins")
    @Operation(summary = "RF11 — Skins de card disponíveis")
    public List<Map<String, Object>> skins() {
        return assets.skins();
    }

    @GetMapping("/api/assets/mosaics")
    @Operation(summary = "RF11 — Mosaicos disponíveis")
    public List<Map<String, Object>> mosaics() {
        return assets.mosaics();
    }
}
