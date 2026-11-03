package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;

import static br.com.fashionai.application.service.AccountService.DELETION_GRACE;

/** RF3.CA05 — exclusão da conta com reautenticação e 30 dias para desistir (o cancelamento volta ao status certo). */
final class AccountDeletion {
    private final IdentityService identity;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final EmailSenderPort email;
    private final Audit audit;
    private final AccountLookup lookup;

    AccountDeletion(IdentityService identity, BrandProfileRepository brands, CelebrityProfileRepository celebrities,
                    EmailSenderPort email, Audit audit, AccountLookup lookup) {
        this.identity = identity;
        this.brands = brands;
        this.celebrities = celebrities;
        this.email = email;
        this.audit = audit;
        this.lookup = lookup;
    }

    Map<String, Object> requestDeletion(CurrentUser user, String password) {
        identity.reauthenticate(user.id(), password);
        User u = lookup.load(user);
        u.setDeletionRequestedAt(Instant.now());
        u.setDeletionScheduledFor(Instant.now().plus(DELETION_GRACE));
        u.setStatus(AccountStatus.DELETION_SCHEDULED);
        Locale loc = lookup.mailLocale(u);
        email.send(u.getEmail(), Msg.t(loc, "account.exclusao_de_conta_agendada"), Msg.t(loc, "account.p_sua_conta_sera_excluida", u.getDeletionScheduledFor()), "SECURITY");
        audit.log(user, AuditActions.EXCLUSAO_CONTA, "user:" + u.getId(), Map.of("scheduledFor", u.getDeletionScheduledFor().toString()));
        return Map.of("status", u.getStatus(), "deletionScheduledFor", u.getDeletionScheduledFor());
    }

    Map<String, Object> cancelDeletion(CurrentUser user) {
        User u = lookup.load(user);
        if (u.getStatus() != AccountStatus.DELETION_SCHEDULED) {
            return Map.of("status", u.getStatus());
        }
        u.setDeletionRequestedAt(null);
        u.setDeletionScheduledFor(null);
        u.setStatus(!u.isEmailVerified() ? AccountStatus.PENDING_EMAIL_VERIFICATION : pendingApproval(u)
                ? AccountStatus.PENDING_VALIDATION : AccountStatus.ACTIVE);
        audit.log(user, AuditActions.EXCLUSAO_CANCELADA, "user:" + u.getId(), Map.of());
        return Map.of("status", u.getStatus());
    }

    private boolean pendingApproval(User u) {
        return switch (u.getProfileType()) {
            case MARCA -> brands.findByOwnerId(u.getId()).map(b -> b.getApprovalStatus() != ApprovalStatus.APROVADO).orElse(true);
            case CELEBRIDADE -> celebrities.findByOwnerId(u.getId()).map(c -> c.getVerificationStatus() != ApprovalStatus.APROVADO).orElse(true);
            default -> false;
        };
    }
}
