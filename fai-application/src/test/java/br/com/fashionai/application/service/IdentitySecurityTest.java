package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Força bruta e enumeração no IdentityService: tentativas de código gravadas e limitadas, bloqueio de login que
 * responde como credencial errada, 2FA contando no bloqueio, links de redefinição invalidados e @ reservados.
 */
class IdentitySecurityTest extends IdentitySecurityFixture {
    // ------------------------------------------------------------------ confirmação de e-mail

    @Test
    void tentativaErradaNaConfirmacaoNaoEDesfeitaPeloRollback() throws Exception {
        Transactional tx = IdentityService.class.getMethod("verifyEmail", CurrentUser.class, String.class).getAnnotation(Transactional.class);
        assertTrue(Arrays.asList(tx.noRollbackFor()).contains(ApiException.class));
        Transactional change = AccountService.class.getMethod("confirmEmailChange", CurrentUser.class, String.class).getAnnotation(Transactional.class);
        assertTrue(Arrays.asList(change.noRollbackFor()).contains(ApiException.class));
    }

    @Test
    void cincoCodigosErradosInvalidamOCodigoDeConfirmacao() {
        user.setEmailVerified(false);
        VerificationCode vc = code(VerificationPurpose.EMAIL_VERIFICATION, "123456");
        for (int i = 1; i <= 4; i++) {
            assertEquals("CODIGO_INVALIDO", error(() -> identity.verifyEmail(me(), "000000")).code());
            assertEquals(i, vc.getAttempts());
        }
        assertEquals("CODIGO_EXPIRADO", error(() -> identity.verifyEmail(me(), "000000")).code());
        assertEquals(5, vc.getAttempts());
        // nem o código certo vale mais: é preciso pedir outro
        assertEquals("CODIGO_EXPIRADO", error(() -> identity.verifyEmail(me(), "123456")).code());
        assertFalse(user.isEmailVerified());
    }

    @Test
    void palpitesPorHoraSaoLimitadosMesmoComCodigosNovos() {
        user.setEmailVerified(false);
        for (int i = 0; i < IdentityService.CODE_ATTEMPTS_PER_HOUR; i++) {
            if (i % 4 == 0) {
                code(VerificationPurpose.EMAIL_VERIFICATION, "123456");
            }
            error(() -> identity.verifyEmail(me(), "000000"));
        }
        code(VerificationPurpose.EMAIL_VERIFICATION, "123456");
        assertEquals(429, error(() -> identity.verifyEmail(me(), "123456")).status());
    }

    @Test
    void reenvioInvalidaOCodigoAnterior() {
        user.setEmailVerified(false);
        VerificationCode old = code(VerificationPurpose.EMAIL_VERIFICATION, "111111");
        identity.resendEmailVerification(me());
        assertNotNull(old.getConsumedAt());
        assertEquals(2, codeRows.size());
        assertEquals("CODIGO_INVALIDO", error(() -> identity.verifyEmail(me(), "111111")).code());
        assertFalse(user.isEmailVerified());
    }

    @Test
    void codigoCertoConfirma() {
        user.setEmailVerified(false);
        code(VerificationPurpose.EMAIL_VERIFICATION, "123456");
        identity.verifyEmail(me(), " 123456 ");
        assertTrue(user.isEmailVerified());
    }

    @Test
    void trocaDeEmailTambemContaTentativasEInvalidaNaQuinta() {
        VerificationCode vc = code(VerificationPurpose.EMAIL_CHANGE, "222222");
        vc.setTarget("novo@exemplo.com");
        AccountService account = account();
        for (int i = 1; i <= 4; i++) {
            assertEquals("CODIGO_INVALIDO", error(() -> account.confirmEmailChange(me(), "999999")).code());
            assertEquals(i, vc.getAttempts());
        }
        assertEquals("CODIGO_EXPIRADO", error(() -> account.confirmEmailChange(me(), "999999")).code());
        assertEquals("CODIGO_INVALIDO", error(() -> account.confirmEmailChange(me(), "222222")).code());
        assertEquals("maria@exemplo.com", user.getEmail());
    }

    @Test
    void trocaDeEmailComCodigoCerto() {
        VerificationCode vc = code(VerificationPurpose.EMAIL_CHANGE, "222222");
        vc.setTarget("novo@exemplo.com");
        account().confirmEmailChange(me(), "222222");
        assertEquals("novo@exemplo.com", user.getEmail());
        assertNotNull(vc.getConsumedAt());
    }
}
