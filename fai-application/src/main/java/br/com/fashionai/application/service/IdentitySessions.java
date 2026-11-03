package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.TokenIssuerPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.IdentityService.Session;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.RefreshToken;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.repository.RefreshTokenRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.IdentityFormats.shortAgent;

/**
 * RNF2 — sessões: refresh token rotativo por família (reuso de um já rotacionado revoga a família), token de acesso,
 * avisos da sessão, lista de sessões ativas (RF3.CA10), logout e encerramento das demais sessões.
 */
final class IdentitySessions {
    private final RefreshTokenRepository refreshTokens;
    private final TokenIssuerPort tokens;
    private final Audit audit;

    IdentitySessions(RefreshTokenRepository refreshTokens, TokenIssuerPort tokens, Audit audit) {
        this.refreshTokens = refreshTokens;
        this.tokens = tokens;
        this.audit = audit;
    }

    Session openSession(User u, boolean persistent, String ip, String userAgent, String deviceName) {
        UUID family = UUID.randomUUID();
        return issue(u, family, null, persistent, ip, userAgent, deviceName);
    }

    private Session issue(User u, UUID family, UUID rotatedFrom, boolean persistent, String ip, String userAgent, String deviceName) {
        String raw = Hashing.randomToken(32);
        RefreshToken rt = new RefreshToken();
        rt.setUser(u);
        rt.setTokenHash(Hashing.sha256(raw));
        rt.setFamilyId(family);
        rt.setRotatedFromId(rotatedFrom);
        rt.setPersistent(persistent);
        rt.setExpiresAt(Instant.now().plus(persistent ? Duration.ofDays(30) : Duration.ofDays(1)));
        rt.setCreatedIp(ip);
        rt.setUserAgent(userAgent == null ? null : userAgent.length() > 500 ? userAgent.substring(0, 500) : userAgent);
        rt.setDeviceName(deviceName == null ? shortAgent(userAgent) : deviceName);
        rt.setLocationApprox(u.getCountry());
        rt.setLastUsedAt(Instant.now());
        refreshTokens.save(rt);
        List<String> warnings = new ArrayList<>();
        if (!u.isEmailVerified()) {
            warnings.add(Msg.t("identity.confirme_seu_e_mail_para"));
        }
        if (u.getStatus() == AccountStatus.PENDING_VALIDATION) {
            warnings.add(Msg.t("identity.seu_perfil_aguarda_a_validacao"));
        }
        if (u.getStatus() == AccountStatus.DELETION_SCHEDULED) {
            warnings.add(Msg.t("identity.sua_conta_sera_excluida_em", u.getDeletionScheduledFor()));
        }
        return new Session(tokens.issueAccessToken(u, family), tokens.accessTokenTtl().toSeconds(), raw, rt.getExpiresAt(),
                family, Views.user(u), u.getStatus().name(), u.isEmailVerified(), warnings);
    }

    Session refresh(String rawRefresh, String ip, String userAgent) {
        if (rawRefresh == null || rawRefresh.isBlank()) {
            throw ApiException.unauthorized(Msg.t("identity.sessao_expirada_faca_login_novamente"));
        }
        RefreshToken rt = refreshTokens.findByTokenHash(Hashing.sha256(rawRefresh))
                .orElseThrow(() -> ApiException.unauthorized(Msg.t("identity.sessao_expirada_faca_login_novamente")));
        if (rt.getRevokedAt() != null) {
            // reutilização de refresh token já rotacionado: revoga a família inteira (roubo de token).
            revokeFamily(rt.getFamilyId());
            audit.log(rt.getUser().getId().toString(), AuditActions.REFRESH_REUTILIZADO, "session:" + rt.getFamilyId(),
                    "BLOQUEADO", ip, userAgent, Map.of());
            throw ApiException.unauthorized(Msg.t("identity.sessao_encerrada_por_seguranca_faca"));
        }
        if (rt.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized(Msg.t("identity.sessao_expirada_faca_login_novamente"));
        }
        User u = rt.getUser();
        if (u.getStatus() == AccountStatus.DELETED || u.getStatus() == AccountStatus.SUSPENDED) {
            throw ApiException.unauthorized(Msg.t("identity.conta_indisponivel"));
        }
        rt.setRevokedAt(Instant.now());
        return issue(u, rt.getFamilyId(), rt.getId(), rt.isPersistent(), ip, userAgent, rt.getDeviceName());
    }

    boolean sessionActive(UUID familyId) {
        if (familyId == null) {
            return false;
        }
        Instant now = Instant.now();
        return refreshTokens.findByFamilyId(familyId).stream()
                .anyMatch(t -> t.getRevokedAt() == null && t.getExpiresAt().isAfter(now));
    }

    void logout(CurrentUser user, UUID sessionId) {
        revokeFamily(sessionId);
        audit.log(user, AuditActions.LOGOUT, "session:" + sessionId, Map.of());
    }

    private void revokeFamily(UUID family) {
        Instant now = Instant.now();
        refreshTokens.findByFamilyId(family).forEach(t -> {
            if (t.getRevokedAt() == null) {
                t.setRevokedAt(now);
            }
        });
    }

    /** RF3.CA10 — sessões ativas (uma por família de refresh token). */
    List<Map<String, Object>> sessions(CurrentUser user, UUID currentSession) {
        Map<UUID, RefreshToken> latest = new LinkedHashMap<>();
        refreshTokens.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(user.id(), Instant.now()).forEach(t ->
                latest.merge(t.getFamilyId(), t, (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b));
        List<Map<String, Object>> out = new ArrayList<>();
        for (RefreshToken t : latest.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sessionId", t.getFamilyId());
            m.put("device", t.getDeviceName());
            m.put("userAgent", t.getUserAgent());
            m.put("ip", t.getCreatedIp());
            m.put("location", t.getLocationApprox());
            m.put("lastUsedAt", t.getLastUsedAt());
            m.put("expiresAt", t.getExpiresAt());
            m.put("current", t.getFamilyId().equals(currentSession));
            out.add(m);
        }
        return out;
    }

    void revokeSession(CurrentUser user, UUID sessionId) {
        List<RefreshToken> family = refreshTokens.findByFamilyId(sessionId);
        if (family.isEmpty() || !family.get(0).getUser().getId().equals(user.id())) {
            throw ApiException.notFound(Msg.t("identity.sessao"));
        }
        revokeFamily(sessionId);
        audit.log(user, AuditActions.SESSAO_REVOGADA, "session:" + sessionId, Map.of());
    }

    int revokeOtherSessions(UUID userId, UUID keepSession) {
        int count = 0;
        Instant now = Instant.now();
        for (RefreshToken t : refreshTokens.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(userId, now)) {
            if (!t.getFamilyId().equals(keepSession)) {
                t.setRevokedAt(now);
                count++;
            }
        }
        return count;
    }
}
