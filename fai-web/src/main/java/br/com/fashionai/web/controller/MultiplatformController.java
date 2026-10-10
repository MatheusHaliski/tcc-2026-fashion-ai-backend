package br.com.fashionai.web.controller;

import br.com.fashionai.application.multiplatform.AvatarCanonicalService;
import br.com.fashionai.application.multiplatform.ClientConfigService;
import br.com.fashionai.application.multiplatform.ClientPlatform;
import br.com.fashionai.application.multiplatform.GarmentAssetService;
import br.com.fashionai.application.multiplatform.QualityProfile;
import br.com.fashionai.application.multiplatform.TryOnSessionService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.enums.TryOnSlot;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * MP — Contratos comuns dos aplicativos instalados (iOS, iPadOS, Android, Windows, macOS, PlayStation, Xbox) e do web.
 * Cabeçalhos: {@code X-FAI-Platform} (plataforma), {@code X-FAI-Quality} (perfil de qualidade), {@code X-FAI-App-Version}.
 * Sem cabeçalho, a plataforma é WEB — o app web atual não muda. Ver docs/multiplataforma/02-arquitetura-e-contratos.md.
 */
@RestController
@Tag(name = "MP — Multiplataforma")
public class MultiplatformController {
    private final ClientConfigService config;
    private final TryOnSessionService tryOn;
    private final AvatarCanonicalService avatar;
    private final GarmentAssetService garments;

    public MultiplatformController(ClientConfigService config, TryOnSessionService tryOn, AvatarCanonicalService avatar,
                                   GarmentAssetService garments) {
        this.config = config;
        this.tryOn = tryOn;
        this.avatar = avatar;
        this.garments = garments;
    }

    @GetMapping("/api/client/config")
    @Operation(summary = "MP-1 — Configuração do aplicativo: versão mínima, perfil de qualidade, capacidades do aparelho")
    public Map<String, Object> config(@RequestHeader(name = "X-FAI-Platform", required = false) String platform,
                                      @RequestHeader(name = "X-FAI-App-Version", required = false) String appVersion,
                                      @RequestHeader(name = "X-FAI-Quality", required = false) String quality) {
        return config.config(ClientPlatform.parse(platform), appVersion, quality);
    }

    @GetMapping("/api/me/avatar3d/canonical")
    @Operation(summary = "MP-2 — Manifesto canônico do avatar: hash da identidade, origem de cada característica e pedidos")
    public Map<String, Object> canonical(CurrentUser user) {
        return avatar.mine(user);
    }

    @GetMapping("/api/try-on/session")
    @Operation(summary = "MP-2 — Provador sincronizado: quatro lugares, revisão e como desenhar cada peça neste aparelho")
    public ResponseEntity<Map<String, Object>> session(CurrentUser user,
                                                       @RequestHeader(name = "X-FAI-Platform", required = false) String platform,
                                                       @RequestHeader(name = "X-FAI-Quality", required = false) String quality) {
        return withEtag(tryOn.get(user, QualityProfile.resolve(ClientPlatform.parse(platform), quality)));
    }

    public record SlotBody(UUID pieceId) {
    }

    @PutMapping("/api/try-on/session/slots/{slot}")
    @Operation(summary = "MP-2 — Vestir uma peça num lugar (sem título, sem salvar look). Exige If-Match com a revisão vista")
    public ResponseEntity<Map<String, Object>> put(CurrentUser user, @PathVariable TryOnSlot slot, @RequestBody SlotBody body,
                                                   @RequestHeader(name = "If-Match", required = false) String ifMatch,
                                                   @RequestHeader(name = "X-FAI-Platform", required = false) String platform,
                                                   @RequestHeader(name = "X-FAI-Quality", required = false) String quality) {
        ClientPlatform p = ClientPlatform.parse(platform);
        return withEtag(tryOn.put(user, slot, body == null ? null : body.pieceId(), revision(ifMatch), p, QualityProfile.resolve(p, quality)));
    }

    @DeleteMapping("/api/try-on/session/slots/{slot}")
    @Operation(summary = "MP-2 — Tirar a peça de um lugar")
    public ResponseEntity<Map<String, Object>> clearSlot(CurrentUser user, @PathVariable TryOnSlot slot,
                                                         @RequestHeader(name = "If-Match", required = false) String ifMatch,
                                                         @RequestHeader(name = "X-FAI-Platform", required = false) String platform,
                                                         @RequestHeader(name = "X-FAI-Quality", required = false) String quality) {
        ClientPlatform p = ClientPlatform.parse(platform);
        return withEtag(tryOn.clear(user, slot, revision(ifMatch), p, QualityProfile.resolve(p, quality)));
    }

    @DeleteMapping("/api/try-on/session/slots")
    @Operation(summary = "MP-2 — Esvaziar o provador (o guarda-roupa não muda)")
    public ResponseEntity<Map<String, Object>> clearAll(CurrentUser user,
                                                        @RequestHeader(name = "If-Match", required = false) String ifMatch,
                                                        @RequestHeader(name = "X-FAI-Platform", required = false) String platform,
                                                        @RequestHeader(name = "X-FAI-Quality", required = false) String quality) {
        ClientPlatform p = ClientPlatform.parse(platform);
        return withEtag(tryOn.clear(user, null, revision(ifMatch), p, QualityProfile.resolve(p, quality)));
    }

    @PostMapping("/api/admin/garment-assets")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "MP-2 — Registrar asset 3D de roupa com métricas de vestir (gate automático)")
    public Map<String, Object> registerGarment(CurrentUser user, @RequestBody GarmentAssetService.RegisterCommand body) {
        return garments.register(user, body);
    }

    public record ReviewBody(boolean approve, String notes) {
    }

    @PostMapping("/api/admin/garment-assets/{id}/review")
    @Operation(summary = "MP-2 — Revisão humana do asset 3D (cor, estampa, logo autorizado, detalhes)")
    public Map<String, Object> reviewGarment(CurrentUser user, @PathVariable UUID id, @RequestBody ReviewBody body) {
        return garments.review(user, id, body.approve(), body.notes());
    }

    /** ETag forte com a revisão: o cliente devolve no If-Match da próxima mudança. */
    private static ResponseEntity<Map<String, Object>> withEtag(Map<String, Object> body) {
        return ResponseEntity.ok().eTag("\"" + body.get("revision") + "\"").body(body);
    }

    /** Aceita {@code "3"}, {@code 3} ou {@code W/"3"}; vazio → null (o serviço responde 428). */
    static Long revision(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) {
            return null;
        }
        String v = ifMatch.trim();
        if (v.startsWith("W/")) {
            v = v.substring(2);
        }
        v = v.replace("\"", "");
        try {
            return Long.parseLong(v);
        } catch (NumberFormatException ex) {
            return -1L;                                                  // revisão ilegível nunca casa: 412
        }
    }
}
