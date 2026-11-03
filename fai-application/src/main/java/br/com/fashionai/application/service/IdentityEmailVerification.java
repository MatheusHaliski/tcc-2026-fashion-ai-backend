package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.function.Supplier;

import static br.com.fashionai.application.service.IdentityCodes.codeMatches;
import static br.com.fashionai.application.service.IdentityCodes.wrongCode;

/** Confirmação do e-mail por código (ativa a conta ou a deixa aguardando a validação do emissor) e o reenvio limitado. */
final class IdentityEmailVerification {
    private final UserRepository users;
    private final VerificationCodeRepository codes;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final RateLimitPort rateLimit;
    private final Audit audit;
    private final IdentityCodes codeBook;
    /** Análise de emissor (opcional, definida depois da construção pelo setter do service). */
    private final Supplier<IssuerReviewService> issuerReview;

    IdentityEmailVerification(UserRepository users, VerificationCodeRepository codes, BrandProfileRepository brands,
                              CelebrityProfileRepository celebrities, RateLimitPort rateLimit, Audit audit, IdentityCodes codeBook,
                              Supplier<IssuerReviewService> issuerReview) {
        this.users = users;
        this.codes = codes;
        this.brands = brands;
        this.celebrities = celebrities;
        this.rateLimit = rateLimit;
        this.audit = audit;
        this.codeBook = codeBook;
        this.issuerReview = issuerReview;
    }

    /**
     * Sem {@code noRollbackFor}, o {@code attempts++} de um código errado era desfeito junto com o erro e os palpites
     * ficavam ilimitados. Agora a tentativa é gravada e, na quinta errada, o código é invalidado (pede-se um novo).
     */
    Views.UserCard verifyEmail(CurrentUser current, String code) {
        User u = users.findById(current.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (u.isEmailVerified()) {
            return Views.user(u);
        }
        VerificationCode vc = codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId(),
                VerificationPurpose.EMAIL_VERIFICATION).orElseThrow(() -> ApiException.badRequest("CODIGO_INVALIDO",
                Msg.t("identity.codigo_invalido_peca_um_novo")));
        codeBook.requireCodeAttemptQuota(u.getId(), VerificationPurpose.EMAIL_VERIFICATION);
        if (!vc.isUsable(Instant.now())) {
            throw ApiException.badRequest("CODIGO_EXPIRADO", Msg.t("identity.o_codigo_expirou_peca_um"));
        }
        if (!codeMatches(vc, u.getId(), code)) {
            throw wrongCode(vc);
        }
        vc.setConsumedAt(Instant.now());
        u.setEmailVerified(true);
        boolean needsApproval = u.getProfileType() != ProfileType.PESSOAL && !approved(u);
        u.setStatus(needsApproval ? AccountStatus.PENDING_VALIDATION : AccountStatus.ACTIVE);
        if (needsApproval && issuerReview.get() != null) {
            issuerReview.get().emailConfirmed(u);          // o prazo da primeira análise começa aqui (política de verificação §5)
        }
        audit.log(current, AuditActions.EMAIL_CONFIRMADO, "user:" + u.getId(), Map.of());
        return Views.user(u);
    }

    private boolean approved(User u) {
        if (u.getProfileType() == ProfileType.MARCA) {
            return brands.findByOwnerId(u.getId()).map(b -> b.getApprovalStatus() == ApprovalStatus.APROVADO).orElse(false);
        }
        if (u.getProfileType() == ProfileType.CELEBRIDADE) {
            return celebrities.findByOwnerId(u.getId()).map(c -> c.getVerificationStatus() == ApprovalStatus.APROVADO).orElse(false);
        }
        return true;
    }

    void resendEmailVerification(CurrentUser current) {
        User u = users.findById(current.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (u.isEmailVerified()) {
            return;
        }
        if (!rateLimit.tryAcquire(u.getId(), "email-verification", 5, Duration.ofDays(1))) {
            RateLimitPort.QuotaStatus st = rateLimit.status(u.getId(), "email-verification", 5, Duration.ofDays(1));
            throw ApiException.tooMany(Msg.t("identity.limite_de_reenvios_atingido"), Map.of("resetAt", st.resetAt().toString()));
        }
        codeBook.sendEmailVerification(u);
    }
}
