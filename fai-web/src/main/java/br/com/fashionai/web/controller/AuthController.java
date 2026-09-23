package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.IdentityService;
import br.com.fashionai.web.support.RequestContextFilter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "RF1/RF2 — Conta e autenticação")
public class AuthController {
    private final IdentityService identity;

    public AuthController(IdentityService identity) {
        this.identity = identity;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF1 — Cadastrar conta (pessoal, marca ou celebridade) e abrir sessão")
    public IdentityService.Session register(@RequestBody IdentityService.RegisterCommand cmd, HttpServletRequest req) {
        return identity.register(cmd, RequestContextFilter.clientIp(req), req.getHeader("User-Agent"));
    }

    @GetMapping("/username-suggestions")
    @Operation(summary = "RF1.CA03 — Sugerir usernames livres a partir do nome ou de um username ocupado")
    public Map<String, Object> usernameSuggestions(@RequestParam(required = false) String name,
                                                   @RequestParam(required = false) String taken) {
        if (taken != null && !taken.isBlank()) {
            return Map.of("suggestions", identity.usernameSuggestions(taken));
        }
        String suggested = identity.suggestUsername(name == null ? "" : name);
        return Map.of("suggested", suggested, "suggestions", List.of(suggested));
    }

    @PostMapping("/login")
    @Operation(summary = "RF2 — Autenticar por e-mail/username e senha (2FA opcional)")
    public IdentityService.Session login(@RequestBody IdentityService.LoginCommand cmd, HttpServletRequest req) {
        return identity.login(cmd, RequestContextFilter.clientIp(req), req.getHeader("User-Agent"));
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    @PostMapping("/refresh")
    @Operation(summary = "RF2 — Renovar access token com rotação do refresh token")
    public IdentityService.Session refresh(@RequestBody RefreshRequest body, HttpServletRequest req) {
        return identity.refresh(body.refreshToken(), RequestContextFilter.clientIp(req), req.getHeader("User-Agent"));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF2 — Encerrar a sessão atual")
    public void logout(CurrentUser user, @AuthenticationPrincipal Jwt jwt) {
        identity.logout(user, UUID.fromString(jwt.getClaimAsString("sid")));
    }

    public record CodeRequest(@NotBlank String code) {
    }

    @PostMapping("/email-verification")
    @Operation(summary = "RF1.CA05 — Confirmar e-mail com o código recebido")
    public Object verifyEmail(CurrentUser user, @RequestBody CodeRequest body) {
        return identity.verifyEmail(user, body.code());
    }

    @PostMapping("/email-verification/resend")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "RF1.CA05 — Reenviar código de confirmação de e-mail")
    public void resendEmail(CurrentUser user) {
        identity.resendEmailVerification(user);
    }

    public record EmailRequest(@NotBlank String email) {
    }

    @PostMapping("/password-reset/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "RF2.CA06 — Pedir redefinição de senha (resposta idêntica exista ou não a conta)")
    public Map<String, String> requestReset(@RequestBody EmailRequest body, HttpServletRequest req) {
        identity.requestPasswordReset(body.email(), RequestContextFilter.clientIp(req), req.getHeader("User-Agent"));
        return Map.of("message", "Se o e-mail estiver cadastrado, você receberá as instruções em instantes.");
    }

    public record ResetConfirm(@NotBlank String token, @NotBlank String newPassword, @NotBlank String confirmPassword) {
    }

    @PostMapping("/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF2.CA06 — Definir nova senha com o token recebido")
    public void confirmReset(@RequestBody ResetConfirm body) {
        identity.confirmPasswordReset(body.token(), body.newPassword(), body.confirmPassword());
    }

    public record PasswordChange(@NotBlank String currentPassword, @NotBlank String newPassword, @NotBlank String confirmPassword) {
    }

    @PutMapping("/password")
    @Operation(summary = "RF3 — Trocar senha (encerra as outras sessões)")
    public Map<String, Object> changePassword(CurrentUser user, @AuthenticationPrincipal Jwt jwt, @RequestBody PasswordChange body) {
        int revoked = identity.changePassword(user, UUID.fromString(jwt.getClaimAsString("sid")),
                body.currentPassword(), body.newPassword(), body.confirmPassword());
        return Map.of("revokedSessions", revoked, "message", "Senha alterada. As outras sessões foram encerradas.");
    }

    @GetMapping("/sessions")
    @Operation(summary = "RF3 — Listar dispositivos/sessões ativas")
    public List<Map<String, Object>> sessions(CurrentUser user, @AuthenticationPrincipal Jwt jwt) {
        return identity.sessions(user, UUID.fromString(jwt.getClaimAsString("sid")));
    }

    @DeleteMapping("/sessions/{sessionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF3 — Encerrar uma sessão específica")
    public void revokeSession(CurrentUser user, @PathVariable UUID sessionId) {
        identity.revokeSession(user, sessionId);
    }

    @DeleteMapping("/sessions")
    @Operation(summary = "RF3 — Sair de todos os outros dispositivos")
    public Map<String, Object> revokeOthers(CurrentUser user, @AuthenticationPrincipal Jwt jwt) {
        return Map.of("revokedSessions", identity.revokeOtherSessions(user.id(), UUID.fromString(jwt.getClaimAsString("sid"))));
    }
}
