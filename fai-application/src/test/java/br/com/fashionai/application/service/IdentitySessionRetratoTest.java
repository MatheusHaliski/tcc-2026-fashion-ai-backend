package br.com.fashionai.application.service;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.RefreshToken;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do R95 (sobre o IdentityService original): login (e-mail/@, senha errada, conta inexistente, bloqueio,
 * conta indisponível, rehash, 2FA, dispositivo novo), refresh rotativo (reuso revoga a família), sessões, logout,
 * redefinição e troca de senha, reautenticação — respostas, chamadas e linhas gravadas.
 */
class IdentitySessionRetratoTest extends IdentityRetratoFixture {
    private static final Path GOLDEN = Path.of("src/test/resources/identity/identity-session-retrato.txt");

    User person(String username, String passwordHash) {
        User u = Kit.user(username);
        u.setEmailHash(br.com.fashionai.application.common.Hashing.emailHash(u.getEmail()));
        u.setPasswordHash(passwordHash);
        return kit.dep(UserRepository.class).save(u);
    }

    IdentityService.LoginCommand cmd(String id, String password, boolean remember, String device, String code) {
        return new IdentityService.LoginCommand(id, password, remember, device, code);
    }

    @Test
    void retratoCompleto() throws Exception {
        User ana = person("ana", "h:" + PASSWORD);
        User bia = person("bia", "old:" + PASSWORD);
        User caio = person("caio", "h:" + PASSWORD);
        String agent = "Mozilla/5.0 (Macintosh; Mac OS X) Safari/605";
        r.step("login.email", () -> identity.login(cmd(" ANA@example.com ", PASSWORD, true, null, null), "1.1.1.1", agent));
        calls();
        r.step("login.mesmoAparelho", () -> identity.login(cmd("@ana", PASSWORD, false, "Meu PC", null), "1.1.1.1", agent));
        calls();
        r.step("login.inexistente", () -> identity.login(cmd("ninguem", "x", false, null, null), "1.1.1.1", null));
        r.step("login.nulo", () -> identity.login(cmd(null, null, false, null, null), null, null));
        r.step("login.senhaErrada", () -> identity.login(cmd("ana", "errada", false, null, null), "1.1.1.1", "ua"));
        calls();
        r.step("login.rehash", () -> identity.login(cmd("bia", PASSWORD, false, null, null), "2.2.2.2", null));
        calls();
        caio.setStatus(AccountStatus.SUSPENDED);
        r.step("login.suspensa", () -> identity.login(cmd("caio", PASSWORD, false, null, null), "3.3.3.3", "ua"));
        caio.setStatus(AccountStatus.ACTIVE);
        for (int i = 0; i < 5; i++) {
            String guess = "x" + i;
            r.step("login.chute" + i, () -> identity.login(cmd("caio", guess, false, null, null), "3.3.3.3", "ua"));
        }
        r.step("login.bloqueada", () -> identity.login(cmd("caio", PASSWORD, false, null, null), "3.3.3.3", "ua"));
        calls();

        bia.setTwoFactorEnabled(true);
        r.step("2fa.semCodigo", () -> identity.login(cmd("bia", PASSWORD, false, null, " "), "2.2.2.2", "Firefox Linux"));
        r.step("2fa.semCodigoAberto", () -> {
            kit.dep(br.com.fashionai.domain.repository.VerificationCodeRepository.class)
                    .findByUserIdAndPurposeAndConsumedAtIsNull(bia.getId(), VerificationPurpose.TWO_FACTOR)
                    .forEach(c -> c.setConsumedAt(Instant.now()));
            return identity.login(cmd("bia", PASSWORD, false, null, "111111"), "2.2.2.2", "Firefox Linux");
        });
        var expired = knownCode(bia, VerificationPurpose.TWO_FACTOR, "222222");
        expired.setExpiresAt(Instant.now().minusSeconds(5));
        r.step("2fa.expirado", () -> identity.login(cmd("bia", PASSWORD, false, null, "222222"), "2.2.2.2", "Firefox Linux"));
        expired.setConsumedAt(Instant.now());
        knownCode(bia, VerificationPurpose.TWO_FACTOR, "333333");
        r.step("2fa.errado", () -> identity.login(cmd("bia", PASSWORD, false, null, "000000"), "2.2.2.2", "Firefox Linux"));
        r.step("2fa.certo", () -> identity.login(cmd("bia", PASSWORD, false, "Tablet", "333333"), "2.2.2.2", "Firefox Linux"));
        calls();
        rows();

        RefreshToken first = kit.dep(RefreshTokenRepository.class).findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(ana.getId(),
                Instant.now()).get(0);
        UUID family = first.getFamilyId();
        String raw = "raw-ana";
        first.setTokenHash(br.com.fashionai.application.common.Hashing.sha256(raw));
        r.step("refresh.vazio", () -> identity.refresh(" ", "1.1.1.1", "ua"));
        r.step("refresh.desconhecido", () -> identity.refresh("nada", "1.1.1.1", "ua"));
        r.step("refresh.ok", () -> identity.refresh(raw, "4.4.4.4", "Edg/120 Android"));
        r.step("refresh.reuso", () -> identity.refresh(raw, "5.5.5.5", "ua"));
        r.line("sessionActive", java.util.List.of(identity.sessionActive(family), identity.sessionActive(null),
                identity.sessionActive(UUID.randomUUID())));
        calls();
        RefreshToken biaToken = kit.dep(RefreshTokenRepository.class).findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(bia.getId(),
                Instant.now()).get(0);
        biaToken.setTokenHash(br.com.fashionai.application.common.Hashing.sha256("raw-bia"));
        biaToken.setExpiresAt(Instant.now().minusSeconds(1));
        r.step("refresh.expirado", () -> identity.refresh("raw-bia", "1.1.1.1", "ua"));
        biaToken.setExpiresAt(Instant.now().plusSeconds(600));
        bia.setStatus(AccountStatus.DELETED);
        r.step("refresh.contaExcluida", () -> identity.refresh("raw-bia", "1.1.1.1", "ua"));
        bia.setStatus(AccountStatus.ACTIVE);
        calls();

        CurrentUser me = Kit.as(ana);
        identity.login(cmd("ana", PASSWORD, false, "A", null), "1.1.1.1", "iPhone Safari");
        identity.login(cmd("ana", PASSWORD, true, "B", null), "1.1.1.1", "Windows Chrome");
        calls();
        var list = identity.sessions(me, family);
        r.line("sessions.count", list.size());
        UUID keep = (UUID) list.get(0).get("sessionId");
        UUID other = (UUID) list.get(1).get("sessionId");
        r.step("revokeSession.alheia", () -> {
            identity.revokeSession(Kit.as(bia), other);
            return "ok";
        });
        r.run("revokeSession", () -> identity.revokeSession(me, other));
        r.run("logout", () -> identity.logout(me, keep));
        r.line("revokeOtherSessions", identity.revokeOtherSessions(ana.getId(), null));
        calls();

        r.run("reset.inexistente", () -> identity.requestPasswordReset("ninguem@example.com", "1.1.1.1", "ua"));
        r.run("reset.pedido", () -> identity.requestPasswordReset(" ANA@example.com ", "1.1.1.1", "ua"));
        String token = lastMailedToken();
        for (int i = 0; i < 5; i++) {
            identity.requestPasswordReset("ana@example.com", "1.1.1.1", "ua");
        }
        calls();
        r.step("reset.tokenNulo", () -> run(() -> identity.confirmPasswordReset(null, "x", "x")));
        r.step("reset.fraca", () -> run(() -> identity.confirmPasswordReset(token, "fraca", "outra")));
        r.step("reset.nula", () -> run(() -> identity.confirmPasswordReset(token, null, null)));
        r.step("reset.ok", () -> run(() -> identity.confirmPasswordReset(token, "Nova@Senha1", "Nova@Senha1")));
        r.step("reset.reuso", () -> run(() -> identity.confirmPasswordReset(token, "Nova@Senha1", "Nova@Senha1")));
        calls();
        r.step("change.errada", () -> identity.changePassword(me, family, "errada", "Outra@Senha2", "Outra@Senha2"));
        r.step("change.fraca", () -> identity.changePassword(me, family, "Nova@Senha1", "fraca", "fraca2"));
        identity.login(cmd("ana", "Nova@Senha1", false, "C", null), "1.1.1.1", "x");
        r.step("change.ok", () -> identity.changePassword(me, family, "Nova@Senha1", "Outra@Senha2", "Outra@Senha2"));
        r.step("reauth.ok", () -> run(() -> identity.reauthenticate(ana.getId(), "Outra@Senha2")));
        r.step("reauth.errada", () -> run(() -> identity.reauthenticate(ana.getId(), null)));
        r.step("reauth.inexistente", () -> run(() -> identity.reauthenticate(UUID.randomUUID(), "x")));
        for (int i = 0; i < 4; i++) {
            r.step("login.depois" + i, () -> identity.login(cmd("ana", "z", false, null, null), "1.1.1.1", "x"));
        }
        calls();
        rows();
        assertThat(r.text()).isEqualTo(IdentityRetrato.golden(r.text(), GOLDEN));
    }

    static Object run(Runnable call) {
        call.run();
        return "ok";
    }
}
