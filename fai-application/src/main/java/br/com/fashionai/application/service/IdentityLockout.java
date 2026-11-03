package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.domain.model.User;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import static br.com.fashionai.application.service.IdentityService.LOGIN_FAIL;

/** Bloqueio por tentativas de senha (5 em 15 min), o mesmo do login, para quem já está logado e confere a senha. */
final class IdentityLockout {
    static final int MAX_LOGIN_FAILURES = 5;
    static final Duration LOCK_WINDOW = Duration.ofMinutes(15);
    private final RateLimitPort rateLimit;
    private final PasswordHasherPort hasher;
    private final Audit audit;

    IdentityLockout(RateLimitPort rateLimit, PasswordHasherPort hasher, Audit audit) {
        this.rateLimit = rateLimit;
        this.hasher = hasher;
        this.audit = audit;
    }

    /**
     * Senha conferida para quem já está logado (troca de senha, dados sensíveis, exclusão da conta), no MESMO bloqueio do
     * login (5 erros em 15 min). Sem isso, uma sessão roubada — um token de acesso de 15 min basta — testaria a senha
     * atual sem limite e, acertando, trocaria a senha e encerraria as sessões da vítima. Bloqueado, responde 429 sem
     * olhar o resultado: nem a senha certa passa, então o bloqueio não vira oráculo.
     */
    boolean passwordMatchesWithLockout(User u, String password, String via) {
        boolean withinLimit = rateLimit.tryAcquire(u.getId(), LOGIN_FAIL, MAX_LOGIN_FAILURES, LOCK_WINDOW);
        boolean ok = hasher.matches(password == null ? "" : password, u.getPasswordHash());
        if (!withinLimit) {
            RateLimitPort.QuotaStatus lock = rateLimit.status(u.getId(), LOGIN_FAIL, MAX_LOGIN_FAILURES, LOCK_WINDOW);
            audit.log(u.getId().toString(), AuditActions.LOGIN_BLOQUEADO_TENTATIVAS, "auth", "BLOQUEADO", null, null,
                    Map.of("resetAt", lock.resetAt().toString(), "via", via));
            long minutes = Math.max(1, (Duration.between(Instant.now(), lock.resetAt()).getSeconds() + 59) / 60);
            throw new ApiException(429, "MUITAS_TENTATIVAS", Msg.t("identity.muitas_tentativas_senha_minutos", minutes),
                    Map.of("resetAt", lock.resetAt().toString()));
        }
        if (ok) {
            rateLimit.release(u.getId(), LOGIN_FAIL);
        } else {
            audit.log(u.getId().toString(), AuditActions.LOGIN_FALHO, "auth", "FALHA", null, null, Map.of("reason", via));
        }
        return ok;
    }
}
