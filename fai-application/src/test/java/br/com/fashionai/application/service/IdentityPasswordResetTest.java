package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Links de redefinição de senha invalidados e resposta uniforme para e-mail inexistente (antes em IdentitySecurityTest). */
class IdentityPasswordResetTest extends IdentitySecurityFixture {
    // ------------------------------------------------------------------ redefinição de senha

    @Test
    void redefinicaoInvalidaOsOutrosLinksEZeraOBloqueio() {
        identity.requestPasswordReset("maria@exemplo.com", "1.1.1.1", "ua");
        identity.requestPasswordReset("maria@exemplo.com", "1.1.1.1", "ua");
        assertTrue(mails.isEmpty(), "o e-mail sai depois, fora da requisição");
        assertEquals(2, queuedMails.size());
        queuedMails.forEach(Runnable::run);
        String first = token(mails.get(0));
        String second = token(mails.get(1));
        for (int i = 0; i < 5; i++) {
            buckets.merge(IdentityService.LOGIN_FAIL + ":" + user.getId(), 1L, Long::sum);
        }
        identity.confirmPasswordReset(second, "Nova@Senha1", "Nova@Senha1");
        assertEquals("LINK_INVALIDO", error(() -> identity.confirmPasswordReset(first, "Outra@Senha2", "Outra@Senha2")).code());
        assertEquals("h:Nova@Senha1", user.getPasswordHash());
        assertFalse(rateLimit.status(user.getId(), IdentityService.LOGIN_FAIL, 5, Duration.ofMinutes(15)).exhausted());
    }

    @Test
    void trocaDeSenhaInvalidaLinksDeRedefinicaoPendentes() {
        identity.requestPasswordReset("maria@exemplo.com", "1.1.1.1", "ua");
        queuedMails.forEach(Runnable::run);
        String pending = token(mails.get(0));
        identity.changePassword(me(), UUID.randomUUID(), PASSWORD, "Nova@Senha1", "Nova@Senha1");
        assertEquals("LINK_INVALIDO", error(() -> identity.confirmPasswordReset(pending, "Outra@Senha2", "Outra@Senha2")).code());
    }

    @Test
    void pedidoDeRedefinicaoParaEmailInexistenteNaoEnviaNada() {
        identity.requestPasswordReset("ninguem@exemplo.com", "1.1.1.1", "ua");
        assertTrue(queuedMails.isEmpty());
        assertTrue(mails.isEmpty());
    }
}
