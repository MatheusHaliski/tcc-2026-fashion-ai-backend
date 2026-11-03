package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.service.IdentityService.LoginCommand;
import br.com.fashionai.application.service.IdentityService.Session;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static br.com.fashionai.application.service.IdentityCodes.codeMatches;
import static br.com.fashionai.application.service.IdentityFieldRules.normalizeUsername;
import static br.com.fashionai.application.service.IdentityFormats.shortAgent;
import static br.com.fashionai.application.service.IdentityLockout.LOCK_WINDOW;
import static br.com.fashionai.application.service.IdentityLockout.MAX_LOGIN_FAILURES;
import static br.com.fashionai.application.service.IdentityService.LOGIN_FAIL;
import static br.com.fashionai.application.service.IdentityService.MAX_CODE_ATTEMPTS;

/**
 * RF2 — login por e-mail ou @: hash sempre conferido (tempo uniforme, inclusive para conta inexistente), palpite
 * reservado no bloqueio antes da senha, 2FA por código, aviso de aparelho novo e a sessão; e a conta pelo e-mail.
 */
final class IdentityLogin {
    private final UserRepository users;
    private final VerificationCodeRepository codes;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordHasherPort hasher;
    private final RateLimitPort rateLimit;
    private final NotificationService notifications;
    private final Audit audit;
    private final IdentityCodes codeBook;
    private final IdentitySessions sessions;
    /** Hash descartável conferido quando a conta não existe (o tempo de resposta não revela o cadastro). */
    private final String dummyHash;

    IdentityLogin(UserRepository users, VerificationCodeRepository codes, RefreshTokenRepository refreshTokens,
                  PasswordHasherPort hasher, RateLimitPort rateLimit, NotificationService notifications, Audit audit,
                  IdentityCodes codeBook, IdentitySessions sessions, String dummyHash) {
        this.users = users;
        this.codes = codes;
        this.refreshTokens = refreshTokens;
        this.hasher = hasher;
        this.rateLimit = rateLimit;
        this.notifications = notifications;
        this.audit = audit;
        this.codeBook = codeBook;
        this.sessions = sessions;
        this.dummyHash = dummyHash;
    }

    /**
     * Conta bloqueada (5 falhas em 15 min) responde igual a credencial errada — o mesmo 401 NAO_AUTENTICADO de uma conta
     * que não existe, e sempre depois de conferir o hash (tempo uniforme). Um 423 só para contas existentes revelaria o
     * cadastro; um 423 só com a senha certa viraria um oráculo de senha durante o bloqueio. Códigos 2FA errados contam
     * no mesmo bloqueio; o login completo zera o contador. O palpite é reservado no contador ANTES de conferir a senha
     * (atômico) e devolvido quando ela confere: ler o contador e só somar depois deixava N pedidos em paralelo avaliarem
     * N senhas, todos vendo "ainda não bloqueado".
     */
    Session login(LoginCommand cmd, String ip, String userAgent) {
        String id = cmd.identifier() == null ? "" : cmd.identifier().trim();
        String password = cmd.password() == null ? "" : cmd.password();
        User u = id.contains("@") ? findByEmail(id).orElse(null)
                : users.findByUsernameIgnoreCase(normalizeUsername(id)).orElse(null);
        if (u == null) {
            hasher.matches(password, dummyHash);
            audit.log("anonymous", AuditActions.LOGIN_FALHO, "auth", "FALHA", ip, userAgent, Map.of("reason", "usuario_inexistente"));
            throw invalidCredentials();
        }
        boolean withinLimit = rateLimit.tryAcquire(u.getId(), LOGIN_FAIL, MAX_LOGIN_FAILURES, LOCK_WINDOW);
        boolean passwordOk = hasher.matches(password, u.getPasswordHash());     // sempre: tempo igual bloqueado ou não
        if (!withinLimit) {
            RateLimitPort.QuotaStatus lock = rateLimit.status(u.getId(), LOGIN_FAIL, MAX_LOGIN_FAILURES, LOCK_WINDOW);
            audit.log(u.getId().toString(), AuditActions.LOGIN_BLOQUEADO_TENTATIVAS, "auth", "BLOQUEADO", ip, userAgent,
                    Map.of("resetAt", lock.resetAt().toString()));
            throw invalidCredentials();
        }
        if (!passwordOk) {
            audit.log(u.getId().toString(), AuditActions.LOGIN_FALHO, "auth", "FALHA", ip, userAgent, Map.of("reason", "senha"));
            throw invalidCredentials();                                          // a reserva fica: conta como falha
        }
        rateLimit.release(u.getId(), LOGIN_FAIL);                                 // senha certa não é falha
        if (u.getStatus() == AccountStatus.DELETED || u.getStatus() == AccountStatus.SUSPENDED) {
            throw new ApiException(403, "CONTA_INDISPONIVEL", Msg.t("identity.esta_conta_nao_esta_disponivel"));
        }
        if (hasher.needsRehash(u.getPasswordHash())) {
            u.setPasswordHash(hasher.hash(password));       // parâmetros do Argon2 atualizados: refaz com a senha certa
        }
        if (u.isTwoFactorEnabled()) {
            if (cmd.twoFactorCode() == null || cmd.twoFactorCode().isBlank()) {
                codeBook.sendTwoFactor(u);
                throw new ApiException(401, "DOIS_FATORES_NECESSARIO", Msg.t("identity.enviamos_um_codigo_de_verificacao"),
                        Map.of("twoFactorRequired", true));
            }
            VerificationCode vc = codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId(),
                    VerificationPurpose.TWO_FACTOR).orElseThrow(() -> ApiException.unauthorized(Msg.t("identity.codigo_de_verificacao_invalido")));
            if (!vc.isUsable(Instant.now())) {
                throw ApiException.unauthorized(Msg.t("identity.codigo_de_verificacao_invalido_ou"));
            }
            if (!codeMatches(vc, u.getId(), cmd.twoFactorCode())) {
                vc.setAttempts(vc.getAttempts() + 1);
                if (vc.getAttempts() >= MAX_CODE_ATTEMPTS) {
                    vc.setExpiresAt(Instant.now());           // quinto erro: o código morre, é preciso pedir outro
                }
                rateLimit.tryAcquire(u.getId(), LOGIN_FAIL, MAX_LOGIN_FAILURES, LOCK_WINDOW);
                audit.log(u.getId().toString(), AuditActions.LOGIN_FALHO, "auth", "FALHA", ip, userAgent, Map.of("reason", "2fa"));
                throw ApiException.unauthorized(Msg.t("identity.codigo_de_verificacao_invalido_ou"));
            }
            vc.setConsumedAt(Instant.now());
        }
        rateLimit.reset(u.getId(), LOGIN_FAIL);
        boolean newDevice = refreshTokens.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(u.getId(), Instant.now()).stream()
                .noneMatch(t -> userAgent != null && userAgent.equals(t.getUserAgent()));
        u.setLastLoginAt(Instant.now());
        audit.log(u.getId().toString(), AuditActions.LOGIN_SUCESSO, "auth", "SUCESSO", ip, userAgent, Map.of("newDevice", newDevice));
        if (newDevice && u.getLastLoginAt() != null) {
            notifications.notify(u.getId(), null, NotificationType.NEW_LOGIN_DEVICE, "SESSION", null,
                    Msg.k("identity.novo_acesso_a_sua_conta"), Msg.k("identity.login_em_se_nao_foi", (userAgent == null ? "dispositivo desconhecido" : shortAgent(userAgent))), Map.of("ip", ip == null ? "" : ip));
        }
        return sessions.openSession(u, cmd.rememberMe(), ip, userAgent, cmd.deviceName());
    }

    private static ApiException invalidCredentials() {
        return ApiException.unauthorized(Msg.t("identity.credenciais_invalidas_ou_bloqueio"));
    }

    /** Conta pelo e-mail (hash de busca). */
    Optional<User> findByEmail(String rawEmail) {
        return users.findByEmailHash(Hashing.emailHash(rawEmail == null ? "" : rawEmail));
    }
}
