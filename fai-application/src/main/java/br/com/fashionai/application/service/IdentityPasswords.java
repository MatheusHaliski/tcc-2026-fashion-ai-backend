package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import static br.com.fashionai.application.service.IdentityFieldRules.validatePassword;
import static br.com.fashionai.application.service.IdentityService.LOGIN_FAIL;

/**
 * RF3.CA07–CA11/CA29–CA33 — senha: pedido de redefinição com resposta uniforme (e-mail depois do commit, fora da
 * requisição), confirmação pelo link, troca com a senha atual e reautenticação, as duas no bloqueio do login.
 */
final class IdentityPasswords {
    /** Mesma categoria de log de antes da extração (IdentityService). */
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(IdentityService.class);
    private final UserRepository users;
    private final VerificationCodeRepository codes;
    private final PasswordHasherPort hasher;
    private final RateLimitPort rateLimit;
    private final EmailSenderPort email;
    private final NotificationService notifications;
    private final Audit audit;
    private final String frontendUrl;
    private final IdentityCodes codeBook;
    private final IdentitySessions sessions;
    private final IdentityLockout lockout;
    private final IdentityLogin login;
    /** Envio fora da requisição (redefinição de senha): o tempo de resposta não depende de o e-mail existir. */
    private Executor mailExecutor = Executors.newVirtualThreadPerTaskExecutor();

    IdentityPasswords(UserRepository users, VerificationCodeRepository codes, PasswordHasherPort hasher, RateLimitPort rateLimit,
                      EmailSenderPort email, NotificationService notifications, Audit audit, String frontendUrl,
                      IdentityCodes codeBook, IdentitySessions sessions, IdentityLockout lockout, IdentityLogin login) {
        this.users = users;
        this.codes = codes;
        this.hasher = hasher;
        this.rateLimit = rateLimit;
        this.email = email;
        this.notifications = notifications;
        this.audit = audit;
        this.frontendUrl = frontendUrl;
        this.codeBook = codeBook;
        this.sessions = sessions;
        this.lockout = lockout;
        this.login = login;
    }

    /**
     * Resposta uniforme (RF3.CA29): nunca revela se o e-mail existe — nem pelo corpo nem pelo tempo. O e-mail, que é a
     * parte lenta (chamada HTTP ao provedor), sai depois do commit numa thread à parte.
     */
    void requestPasswordReset(String rawEmail, String ip, String userAgent) {
        String mail = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        login.findByEmail(mail).ifPresent(u -> {
            if (!rateLimit.tryAcquire(u.getId(), "password-reset", 5, Duration.ofHours(1))) {
                // a tela responde igual (não revela se o e-mail existe), mas o log mostra por que nada foi enviado
                log.info("Redefinição de senha não enviada: limite de 5 pedidos por hora atingido (user {})", u.getId());
                return;
            }
            String token = Hashing.randomToken(32);
            VerificationCode vc = new VerificationCode();
            vc.setUser(u);
            vc.setPurpose(VerificationPurpose.PASSWORD_RESET);
            vc.setCodeHash(Hashing.sha256(token));
            vc.setTarget(u.getEmailHash());
            vc.setExpiresAt(Instant.now().plus(Duration.ofMinutes(30)));
            vc.setLastSentAt(Instant.now());
            codes.save(vc);
            Locale loc = codeBook.mailLocale(u);
            sendAfterCommit(u.getEmail(), Msg.t(loc, "identity.redefinicao_de_senha_fashion_ai"),
                    Msg.t(loc, "identity.p_recebemos_um_pedido_para", frontendUrl, token), "SECURITY");
            notifications.notify(u.getId(), null, NotificationType.PASSWORD_RESET, "USER", u.getId(),
                    Msg.k("identity.pedido_de_redefinicao_de_senha"), Msg.k("identity.se_nao_foi_voce_ignore"), null);
            audit.log(u.getId().toString(), AuditActions.RECUPERACAO_SENHA, "auth", "SOLICITADA", ip, userAgent, Map.of());
        });
        // resposta uniforme: nunca revela se o e-mail existe (RF3.CA29).
    }

    /** Envia o e-mail só depois do commit (o link precisa do token gravado) e fora da thread da requisição. */
    private void sendAfterCommit(String to, String subject, String html, String category) {
        Runnable send = () -> {
            try {
                email.send(to, subject, html, category);
            } catch (RuntimeException ex) {
                log.warn("Falha ao enviar e-mail de {}: {}", category, ex.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    mailExecutor.execute(send);
                }
            });
        } else {
            mailExecutor.execute(send);
        }
    }

    /** Testes: executa o envio assíncrono na própria thread. */
    void mailExecutor(Executor executor) {
        this.mailExecutor = executor;
    }

    void confirmPasswordReset(String token, String newPassword, String confirm) {
        VerificationCode vc = codes.findByCodeHashAndPurpose(Hashing.sha256(token == null ? "" : token),
                VerificationPurpose.PASSWORD_RESET).orElseThrow(() -> ApiException.badRequest("LINK_INVALIDO",
                Msg.t("identity.link_invalido_ou_expirado_peca")));
        if (vc.getConsumedAt() != null || vc.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("LINK_INVALIDO", Msg.t("identity.link_invalido_ou_expirado_peca"));
        }
        Map<String, Object> errors = new LinkedHashMap<>();
        validatePassword(newPassword, errors);
        if (newPassword != null && !newPassword.equals(confirm)) {
            errors.put("confirmPassword", Msg.t("identity.as_senhas_nao_coincidem"));
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        User u = vc.getUser();
        u.setPasswordHash(hasher.hash(newPassword));
        vc.setConsumedAt(Instant.now());
        codeBook.invalidateCodes(u.getId(), VerificationPurpose.PASSWORD_RESET);   // os outros links pedidos antes morrem junto
        rateLimit.reset(u.getId(), LOGIN_FAIL);                           // quem provou o e-mail sai do bloqueio
        sessions.revokeOtherSessions(u.getId(), null);
        audit.log(u.getId().toString(), AuditActions.TROCA_SENHA, "user:" + u.getId(), "SUCESSO", null, null,
                Map.of("via", "reset"));
    }

    /** RF3.CA11/CA33 — troca de senha com a senha atual; encerra todas as demais sessões. */
    int changePassword(CurrentUser user, UUID currentSession, String currentPassword, String newPassword, String confirm) {
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (!lockout.passwordMatchesWithLockout(u, currentPassword, "troca_senha")) {
            throw ApiException.badRequest("SENHA_ATUAL_INCORRETA", Msg.t("identity.senha_atual_incorreta"));
        }
        Map<String, Object> errors = new LinkedHashMap<>();
        validatePassword(newPassword, errors);
        if (newPassword != null && !newPassword.equals(confirm)) {
            errors.put("confirmPassword", Msg.t("identity.as_senhas_nao_coincidem"));
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        u.setPasswordHash(hasher.hash(newPassword));
        codeBook.invalidateCodes(u.getId(), VerificationPurpose.PASSWORD_RESET);
        int ended = sessions.revokeOtherSessions(u.getId(), currentSession);
        audit.log(user, AuditActions.TROCA_SENHA, "user:" + u.getId(), Map.of("sessoesEncerradas", ended));
        return ended;
    }

    /** Reautenticação exigida para dados sensíveis (RF3.CA01). */
    void reauthenticate(UUID userId, String password) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (!lockout.passwordMatchesWithLockout(u, password, "reautenticacao")) {
            throw new ApiException(401, "REAUTENTICACAO_FALHOU", Msg.t("identity.confirme_sua_senha_para_alterar"));
        }
    }
}
