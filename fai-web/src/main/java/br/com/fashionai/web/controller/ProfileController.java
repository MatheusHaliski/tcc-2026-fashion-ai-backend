package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.InstitutionalService;
import br.com.fashionai.application.service.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF14/RF17/RF22 — Perfis, conexões e perfis institucionais")
public class ProfileController {
    private final ProfileService profiles;
    private final InstitutionalService institutional;

    public ProfileController(ProfileService profiles, InstitutionalService institutional) {
        this.profiles = profiles;
        this.institutional = institutional;
    }

    /**
     * Perfil público. {@code sort} ordena a grade de looks (Lookbook › Looks, P3-02): recent (padrão) · hype_desc ·
     * hype_asc · growth pelo HypeScore v2 — o dono ordena pelo Hype pessoal, terceiros só pelo público elegível. Sem
     * {@code sort}, a resposta é a de sempre (mais recentes primeiro).
     */
    @GetMapping("/api/profiles/{idOrUsername}")
    @Operation(summary = "RF17 — Perfil público (por id ou @username); sort = recent | hype_desc | hype_asc | growth (HypeScore v2) ordena a grade de looks")
    public Map<String, Object> profile(CurrentUser viewer, @PathVariable String idOrUsername, @RequestParam(required = false) String sort) {
        return profiles.profile(viewer, idOrUsername, sort);
    }

    @PostMapping("/api/users/{targetId}/followers")
    @Operation(summary = "RF17.CA01 — Seguir (ou pedir para seguir perfil privado)")
    public Map<String, Object> follow(CurrentUser viewer, @PathVariable UUID targetId) {
        return profiles.follow(viewer, targetId);
    }

    @DeleteMapping("/api/users/{targetId}/followers/me")
    @Operation(summary = "RF17 — Deixar de seguir")
    public Map<String, Object> unfollow(CurrentUser viewer, @PathVariable UUID targetId) {
        return profiles.unfollow(viewer, targetId);
    }

    @GetMapping("/api/me/follow-requests")
    @Operation(summary = "RF17.CA02 — Pedidos para me seguir")
    public List<Map<String, Object>> requests(CurrentUser user) {
        return profiles.requests(user);
    }

    public record RespondRequest(boolean accept) {
    }

    @PostMapping("/api/follow-requests/{followId}")
    @Operation(summary = "RF17.CA02 — Aceitar ou recusar pedido")
    public Map<String, Object> respond(CurrentUser user, @PathVariable UUID followId, @RequestBody RespondRequest body) {
        return profiles.respond(user, followId, body.accept());
    }

    @GetMapping("/api/users/{userId}/connections")
    @Operation(summary = "RF17 — Seguidores e seguindo")
    public Map<String, Object> connections(CurrentUser viewer, @PathVariable UUID userId) {
        return profiles.connections(viewer, userId);
    }

    public record BlockRequest(boolean blocked) {
    }

    @PutMapping("/api/users/{targetId}/block")
    @Operation(summary = "RF17.CA06 — Bloquear/desbloquear usuário")
    public Map<String, Object> block(CurrentUser user, @PathVariable UUID targetId, @RequestBody BlockRequest body) {
        return profiles.block(user, targetId, body.blocked());
    }

    @GetMapping("/api/brands")
    @Operation(summary = "RF14 — Marcas (busca e ordenação)")
    public Map<String, Object> brands(CurrentUser viewer, @RequestParam(required = false) String term,
                                      @RequestParam(required = false) String order) {
        return institutional.brandFeed(viewer, term, order);
    }

    @GetMapping("/api/celebrities")
    @Operation(summary = "RF14 — Celebridades (busca e ordenação)")
    public Map<String, Object> celebrities(CurrentUser viewer, @RequestParam(required = false) String term,
                                           @RequestParam(required = false) String order) {
        return institutional.celebrityFeed(viewer, term, order);
    }

    @GetMapping("/api/institutional/{slugOrId}")
    @Operation(summary = "RF14/RF22 — Perfil institucional de marca ou celebridade")
    public Map<String, Object> institutional(CurrentUser viewer, @PathVariable String slugOrId) {
        return institutional.profile(viewer, slugOrId);
    }

    @GetMapping("/api/institutional/{slugOrId}/tabs/{tab}")
    @Operation(summary = "RF14/RF22 — Aba do perfil institucional (looks, peças, selos, promoções, agrupamentos)")
    public Object tab(CurrentUser viewer, @PathVariable String slugOrId, @PathVariable String tab,
                      @RequestParam(required = false) String filter, @RequestParam(required = false) UUID groupingId) {
        return institutional.tab(viewer, slugOrId, tab, filter, groupingId);
    }

    @GetMapping("/api/institutional/{slugOrId}/store")
    @Operation(summary = "RF22 — Loja/links oficiais da marca")
    public Map<String, Object> store(@PathVariable String slugOrId) {
        return institutional.store(slugOrId);
    }

    @PatchMapping("/api/me/brand-profile")
    @Operation(summary = "RF14 — Marca edita seus dados institucionais")
    public Map<String, Object> updateBrand(CurrentUser user, @RequestBody Map<String, String> fields) {
        return institutional.updateBrand(user, fields);
    }

    @PatchMapping("/api/me/celebrity-profile")
    @Operation(summary = "RF22 — Celebridade edita seus dados institucionais")
    public Map<String, Object> updateCelebrity(CurrentUser user, @RequestBody Map<String, Object> fields) {
        return institutional.updateCelebrity(user, fields);
    }
}
