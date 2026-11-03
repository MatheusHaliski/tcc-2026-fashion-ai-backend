package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import static br.com.fashionai.application.service.IdentityService.CODE_ATTEMPTS_PER_HOUR;
import static br.com.fashionai.application.service.IdentityService.MAX_CODE_ATTEMPTS;

/**
 * Códigos de 6 dígitos (confirmação de e-mail e 2FA): emissão com hash {@code userId:código}, invalidação dos abertos,
 * comparação em tempo constante, tentativas erradas contadas e a cota por hora; e o idioma dos e-mails do usuário.
 */
final class IdentityCodes {
    private final VerificationCodeRepository codes;
    private final RateLimitPort rateLimit;
    private final EmailSenderPort email;
    private final UserPreferencesRepository preferences;
    private final String frontendUrl;

    IdentityCodes(VerificationCodeRepository codes, RateLimitPort rateLimit, EmailSenderPort email,
                  UserPreferencesRepository preferences, String frontendUrl) {
        this.codes = codes;
        this.rateLimit = rateLimit;
        this.email = email;
        this.preferences = preferences;
        this.frontendUrl = frontendUrl;
    }

    void sendEmailVerification(User u) {
        invalidateCodes(u.getId(), VerificationPurpose.EMAIL_VERIFICATION);   // só o código mais novo vale
        String code = Hashing.numericCode(6);
        VerificationCode vc = new VerificationCode();
        vc.setUser(u);
        vc.setPurpose(VerificationPurpose.EMAIL_VERIFICATION);
        vc.setCodeHash(Hashing.sha256(u.getId() + ":" + code));
        vc.setTarget(u.getEmailHash());
        vc.setExpiresAt(Instant.now().plus(Duration.ofHours(24)));
        vc.setLastSentAt(Instant.now());
        codes.save(vc);
        Locale loc = mailLocale(u);
        email.send(u.getEmail(), Msg.t(loc, "identity.confirme_seu_e_mail_no"),
                Msg.t(loc, "identity.p_seu_codigo_de_confirmacao", code, frontendUrl, code),
                "SECURITY");
    }

    /** Invalida os códigos ainda abertos da finalidade (novo envio, senha trocada): só o mais novo pode valer. */
    void invalidateCodes(UUID userId, VerificationPurpose purpose) {
        Instant now = Instant.now();
        codes.findByUserIdAndPurposeAndConsumedAtIsNull(userId, purpose).forEach(c -> c.setConsumedAt(now));
    }

    /** Comparação em tempo constante do código digitado com o hash guardado ({@code userId:código}). */
    static boolean codeMatches(VerificationCode vc, UUID userId, String code) {
        String given = Hashing.sha256(userId + ":" + (code == null ? "" : code.trim()));
        return Hashing.constantTimeEquals(vc.getCodeHash(), given);
    }

    /**
     * Conta uma tentativa errada (persistida: os métodos que chamam não desfazem a transação no ApiException) e, na
     * {@value IdentityService#MAX_CODE_ATTEMPTS}ª, invalida o código. Devolve o erro para a pessoa: quantas restam ou "peça um novo".
     */
    static ApiException wrongCode(VerificationCode vc) {
        vc.setAttempts(vc.getAttempts() + 1);
        int remaining = MAX_CODE_ATTEMPTS - vc.getAttempts();
        if (remaining <= 0) {
            vc.setExpiresAt(Instant.now());
            return ApiException.badRequest("CODIGO_EXPIRADO", Msg.t("identity.muitas_tentativas_codigo"));
        }
        return ApiException.badRequest("CODIGO_INVALIDO", Msg.t("identity.codigo_incorreto_restam_tentativas", remaining));
    }

    /**
     * Palpites em paralelo leriam o mesmo {@code attempts} antes de gravar: o contador atômico do RateLimitPort limita
     * as tentativas por hora de cada finalidade, independentemente disso.
     */
    void requireCodeAttemptQuota(UUID userId, VerificationPurpose purpose) {
        if (!rateLimit.tryAcquire(userId, "code-attempt:" + purpose.name(), CODE_ATTEMPTS_PER_HOUR, Duration.ofHours(1))) {
            throw new ApiException(429, "MUITAS_TENTATIVAS", Msg.t("identity.muitas_tentativas_codigo"));
        }
    }

    void sendTwoFactor(User u) {
        invalidateCodes(u.getId(), VerificationPurpose.TWO_FACTOR);
        String code = Hashing.numericCode(6);
        VerificationCode vc = new VerificationCode();
        vc.setUser(u);
        vc.setPurpose(VerificationPurpose.TWO_FACTOR);
        vc.setCodeHash(Hashing.sha256(u.getId() + ":" + code));
        vc.setTarget(u.getEmailHash());
        vc.setExpiresAt(Instant.now().plus(Duration.ofMinutes(10)));
        vc.setLastSentAt(Instant.now());
        codes.save(vc);
        Locale loc = mailLocale(u);
        email.send(u.getEmail(), Msg.t(loc, "identity.seu_codigo_de_acesso_ao"), Msg.t(loc, "identity.p_codigo_b_b_valido", code), "SECURITY");
    }

    /** Idioma dos e-mails do usuário: a preferência salva (RF23) e, sem ela, o idioma da requisição. */
    Locale mailLocale(User u) {
        return preferences.findByUserId(u.getId()).map(p -> p.getLanguage() == null ? Msg.locale() : Msg.fromPreference(p.getLanguage().name())).orElseGet(Msg::locale);
    }
}
