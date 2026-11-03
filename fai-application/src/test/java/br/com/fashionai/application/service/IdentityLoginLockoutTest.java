package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Bloqueio de login que responde como credencial errada, palpites em paralelo, senha certa sem 2FA, troca de senha e
 * reautenticação no mesmo bloqueio, e códigos 2FA contando tentativas (antes em IdentitySecurityTest).
 */
class IdentityLoginLockoutTest extends IdentitySecurityFixture {
    // ------------------------------------------------------------------ login

    @Test
    void contaBloqueadaRespondeIgualAContaInexistente() {
        for (int i = 0; i < 5; i++) {
            error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        }
        ApiException locked = error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua"));
        ApiException lockedWrong = error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        ApiException missing = error(() -> identity.login(login("ninguem", "errada", null), "1.1.1.1", "ua"));
        for (ApiException e : List.of(locked, lockedWrong)) {
            assertEquals(missing.status(), e.status());
            assertEquals(missing.code(), e.code());
            assertEquals(missing.getMessage(), e.getMessage());
            assertEquals(missing.details(), e.details());
        }
        assertEquals(401, locked.status());
        assertTrue(audited.contains("LOGIN_BLOQUEADO_TENTATIVAS:BLOQUEADO"), audited.toString());
    }

    @Test
    void loginCertoZeraAsFalhas() {
        for (int i = 0; i < 4; i++) {
            error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        }
        assertNotNull(identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua").accessToken());
        assertFalse(rateLimit.status(user.getId(), IdentityService.LOGIN_FAIL, 5, Duration.ofMinutes(15)).exhausted());
        for (int i = 0; i < 4; i++) {
            error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        }
        assertNotNull(identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua").accessToken());
    }

    /**
     * Corrida: o contador era lido antes do hash e somado depois — 40 pedidos em paralelo liam "0 falhas" e avaliavam
     * 40 senhas. Com a reserva atômica antes do hash, só 5 palpites são avaliados, venha de quantos IPs vier.
     */
    @Test
    void palpitesEmParaleloNaoPassamDoLimiteDoBloqueio() throws Exception {
        hashDelayMs = 30;
        ExecutorService pool = Executors.newFixedThreadPool(40);
        try {
            List<Future<?>> all = new ArrayList<>();
            for (int i = 0; i < 40; i++) {
                String guess = "errada" + i;
                String ip = "100.64.0." + (i + 1);
                all.add(pool.submit(() -> error(() -> identity.login(login("maria", guess, null), ip, "ua"))));
            }
            for (Future<?> f : all) {
                f.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
        long evaluated = audited.stream().filter(a -> a.startsWith(AuditActions.LOGIN_FALHO + ":")).count();
        assertEquals(5, evaluated, "palpites de senha avaliados");
        hashDelayMs = 0;
        assertEquals("NAO_AUTENTICADO", error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua")).code());
    }

    @Test
    void senhaCertaNaoContaComoFalha() {
        for (int i = 0; i < 4; i++) {
            error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        }
        user.setTwoFactorEnabled(true);           // senha certa sem o código: não zera nem soma
        assertEquals("DOIS_FATORES_NECESSARIO", error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua")).code());
        assertEquals(4, rateLimit.status(user.getId(), IdentityService.LOGIN_FAIL, 5, Duration.ofMinutes(15)).used());
    }

    /** Sessão roubada (token de 15 min) tentando descobrir a senha atual pela troca de senha: mesmo bloqueio do login. */
    @Test
    void trocaDeSenhaContaNoBloqueioENaoViraOraculo() {
        CurrentUser me = CurrentUser.of(user, "1.1.1.1", "ua");
        for (int i = 0; i < 5; i++) {
            String guess = "chute" + i;
            assertEquals("SENHA_ATUAL_INCORRETA",
                    error(() -> identity.changePassword(me, UUID.randomUUID(), guess, "Nova@Forte123", "Nova@Forte123")).code());
        }
        ApiException blocked = error(() -> identity.changePassword(me, UUID.randomUUID(), PASSWORD, "Nova@Forte123", "Nova@Forte123"));
        assertEquals(429, blocked.status());
        assertEquals("MUITAS_TENTATIVAS", blocked.code());
        assertEquals("h:" + PASSWORD, user.getPasswordHash());
        assertEquals("NAO_AUTENTICADO", error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua")).code());
    }

    @Test
    void reautenticacaoTambemContaNoBloqueio() {
        for (int i = 0; i < 5; i++) {
            assertEquals("REAUTENTICACAO_FALHOU", error(() -> identity.reauthenticate(user.getId(), "chute")).code());
        }
        assertEquals(429, error(() -> identity.reauthenticate(user.getId(), PASSWORD)).status());
    }

    @Test
    void codigo2faErradoContaTentativasEAlimentaOBloqueio() {
        user.setTwoFactorEnabled(true);
        assertEquals("DOIS_FATORES_NECESSARIO", error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua")).code());
        VerificationCode vc = codeRows.get(codeRows.size() - 1);
        for (int i = 0; i < 5; i++) {
            assertEquals(401, error(() -> identity.login(login("maria", PASSWORD, "000000"), "1.1.1.1", "ua")).status());
        }
        assertEquals(5, vc.getAttempts());
        assertFalse(vc.isUsable(Instant.now().plusSeconds(1)));
        assertTrue(rateLimit.status(user.getId(), IdentityService.LOGIN_FAIL, 5, Duration.ofMinutes(15)).exhausted());
        // bloqueada: mesmo com senha certa e um código válido novo
        VerificationCode fresh = code(VerificationPurpose.TWO_FACTOR, "654321");
        assertEquals("NAO_AUTENTICADO", error(() -> identity.login(login("maria", PASSWORD, "654321"), "1.1.1.1", "ua")).code());
        assertTrue(fresh.getConsumedAt() == null);
    }

    @Test
    void novoCodigo2faInvalidaOAnterior() {
        user.setTwoFactorEnabled(true);
        VerificationCode old = code(VerificationPurpose.TWO_FACTOR, "111111");
        error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua"));
        assertNotNull(old.getConsumedAt());
    }
}
