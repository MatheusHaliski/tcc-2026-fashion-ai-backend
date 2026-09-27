package br.com.fashionai.web.controller;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AdminService;
import br.com.fashionai.application.view.Views;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@Tag(name = "Administração (aprovações, moderação, usuários, auditoria, IA, backups, jobs)")
public class AdminController {
    private final AdminService admin;
    private final AiEngine ai;

    public AdminController(AdminService admin, AiEngine ai) {
        this.admin = admin;
        this.ai = ai;
    }

    @GetMapping("/approvals")
    @Operation(summary = "RF1.CA08 — Marcas e celebridades aguardando validação")
    public Map<String, Object> approvals(CurrentUser user) {
        return admin.approvals(user);
    }

    public record DecisionRequest(boolean approve, String notes) {
    }

    @PostMapping("/approvals/{userId}")
    @Operation(summary = "RF1.CA08 — Aprovar ou rejeitar perfil institucional")
    public Map<String, Object> decide(CurrentUser user, @PathVariable UUID userId, @RequestBody DecisionRequest body) {
        return admin.decide(user, userId, body.approve(), body.notes());
    }

    @GetMapping("/moderation")
    @Operation(summary = "RF4/RNF — Fila de moderação de conteúdo")
    public List<Map<String, Object>> moderationQueue(CurrentUser user) {
        return admin.moderationQueue(user);
    }

    public record ModerationRequest(boolean approve, String reason) {
    }

    @PostMapping("/moderation/{itemId}")
    @Operation(summary = "RNF — Decidir item da fila de moderação")
    public Map<String, Object> moderate(CurrentUser user, @PathVariable UUID itemId, @RequestBody ModerationRequest body) {
        return admin.moderate(user, itemId, body.approve(), body.reason());
    }

    @GetMapping("/moderation/{itemId}/image")
    @Operation(summary = "Moderação de imagens — foto retida para revisão humana (só ADMIN, sem cache)")
    public ResponseEntity<byte[]> moderationImage(CurrentUser user, @PathVariable UUID itemId) {
        byte[] bytes = admin.moderationImage(user, itemId);
        String mime = ImageOps.detectMime(bytes);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(mime == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(mime)).body(bytes);
    }

    @GetMapping("/users")
    @Operation(summary = "Buscar usuários")
    public List<Views.UserCard> searchUsers(CurrentUser user, @RequestParam(required = false) String term) {
        return admin.searchUsers(user, term);
    }

    public record StatusRequest(boolean suspend, String reason) {
    }

    @PutMapping("/users/{userId}/status")
    @Operation(summary = "Suspender ou reativar conta")
    public Map<String, Object> setStatus(CurrentUser user, @PathVariable UUID userId, @RequestBody StatusRequest body) {
        return admin.setStatus(user, userId, body.suspend(), body.reason());
    }

    public record RoleRequest(@NotBlank String role) {
    }

    @PutMapping("/users/{userId}/role")
    @Operation(summary = "Definir papel (USER/ADMIN)")
    public Map<String, Object> setRole(CurrentUser user, @PathVariable UUID userId, @RequestBody RoleRequest body) {
        return admin.setRole(user, userId, body.role());
    }

    @GetMapping("/audit")
    @Operation(summary = "RNF5 — Trilha de auditoria (filtro por ator)")
    public List<Map<String, Object>> auditLog(CurrentUser user, @RequestParam(required = false) String actor) {
        return admin.auditLog(user, actor);
    }

    @GetMapping("/ai")
    @Operation(summary = "RF24 — Visão da IA: provedores, custo, latência, fallbacks")
    public Map<String, Object> aiOverview(CurrentUser user) {
        Map<String, Object> overview = new java.util.LinkedHashMap<>(admin.aiOverview(user));
        overview.put("providers", ai.providerAvailability());
        overview.put("remoteEnabled", ai.remoteEnabled());
        return overview;
    }

    @PostMapping("/backups")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "RNF — Executar backup do MySQL agora")
    public Map<String, Object> runBackup(CurrentUser user) {
        return admin.runBackup(user);
    }

    @GetMapping("/backups")
    @Operation(summary = "RNF — Histórico de backups")
    public List<Map<String, Object>> backups(CurrentUser user) {
        return admin.backups(user);
    }

    @PostMapping("/jobs/{job}")
    @Operation(summary = "Executar job manualmente: hype | rankings | challenges | assets | notifications")
    public Map<String, Object> runJob(CurrentUser user, @PathVariable String job) {
        return admin.runJob(user, job);
    }

    @PostMapping("/hype/recalibration")
    @Operation(summary = "RF6 — Recalibrar percentis do Hype Score")
    public Map<String, Object> recalibrate(CurrentUser user) {
        return admin.runJob(user, "hype");
    }

    @PostMapping("/challenges/{code}/promotion")
    @Operation(summary = "RF36.CA10 — Promover proposta de desafio ao catálogo")
    public Map<String, Object> promoteChallenge(CurrentUser user, @PathVariable String code) {
        return admin.promoteChallenge(user, code);
    }
}
