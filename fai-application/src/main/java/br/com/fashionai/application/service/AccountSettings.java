package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AccountService.SensitiveUpdate;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static br.com.fashionai.application.service.AccountService.defaultVisibility;

/**
 * RF3 — dados sensíveis com reautenticação (troca de e-mail confirmada por código no novo endereço, telefone,
 * nascimento, 2FA), confirmação da troca de e-mail e visibilidade do perfil (RF3.CA12).
 */
final class AccountSettings {
    private final UserRepository users;
    private final VerificationCodeRepository codes;
    private final IdentityService identity;
    private final EmailSenderPort email;
    private final Audit audit;
    private final AccountLookup lookup;

    AccountSettings(UserRepository users, VerificationCodeRepository codes, IdentityService identity, EmailSenderPort email,
                    Audit audit, AccountLookup lookup) {
        this.users = users;
        this.codes = codes;
        this.identity = identity;
        this.email = email;
        this.audit = audit;
        this.lookup = lookup;
    }

    Map<String, Object> updateSensitive(CurrentUser user, SensitiveUpdate cmd) {
        identity.reauthenticate(user.id(), cmd.password());
        User u = lookup.load(user);
        List<String> changed = new ArrayList<>();
        Map<String, Object> out = new LinkedHashMap<>();
        if (cmd.email() != null && !cmd.email().isBlank() && !cmd.email().trim().equalsIgnoreCase(u.getEmail())) {
            String mail = cmd.email().trim().toLowerCase(Locale.ROOT);
            if (!IdentityService.EMAIL.matcher(mail).matches()) {
                throw ApiException.badRequest("EMAIL_INVALIDO", Msg.t("common.formato_de_e_mail_invalido"));
            }
            if (users.existsByEmailHash(Hashing.emailHash(mail))) {
                throw ApiException.conflict("EMAIL_EM_USO", Msg.t("account.este_e_mail_ja_esta"));
            }
            identity.invalidateCodes(u.getId(), VerificationPurpose.EMAIL_CHANGE);   // só o pedido mais novo vale
            String code = Hashing.numericCode(6);
            VerificationCode vc = new VerificationCode();
            vc.setUser(u);
            vc.setPurpose(VerificationPurpose.EMAIL_CHANGE);
            vc.setCodeHash(Hashing.sha256(u.getId() + ":" + code));
            vc.setTarget(mail);
            vc.setExpiresAt(Instant.now().plus(Duration.ofHours(2)));
            vc.setLastSentAt(Instant.now());
            codes.save(vc);
            Locale loc = lookup.mailLocale(u);
            email.send(mail, Msg.t(loc, "account.confirme_o_novo_e_mail"), Msg.t(loc, "account.p_codigo_para_confirmar_o", code), "SECURITY");
            email.send(u.getEmail(), Msg.t(loc, "account.pedido_de_troca_de_e"), Msg.t(loc, "account.p_foi_pedida_a_troca", IdentityService.maskEmail(mail)), "SECURITY");
            out.put("emailChangePending", IdentityService.maskEmail(mail));
            changed.add("email(pendente)");
        }
        if (cmd.phone() != null) {
            u.setPhone(cmd.phone().isBlank() ? null : cmd.phone().replaceAll("[^0-9+]", ""));
            changed.add("phone");
        }
        if (cmd.birthDate() != null) {
            u.setBirthDate(cmd.birthDate().isBlank() ? null : cmd.birthDate());
            changed.add("birthDate");
        }
        if (cmd.twoFactorEnabled() != null) {
            u.setTwoFactorEnabled(cmd.twoFactorEnabled());
            changed.add("twoFactor");
        }
        audit.log(user, AuditActions.ALTERACAO_DADO_PESSOAL_SENSIVEL, "user:" + u.getId(), Map.of("fields", changed));
        out.put("changed", changed);
        return out;
    }

    /**
     * Código de 6 dígitos com tentativas contadas e gravadas (noRollbackFor): na quinta errada o pedido de troca é
     * invalidado e é preciso pedir outro código.
     */
    Views.UserCard confirmEmailChange(CurrentUser user, String code) {
        User u = lookup.load(user);
        VerificationCode vc = codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId(),
                VerificationPurpose.EMAIL_CHANGE).orElseThrow(() -> ApiException.badRequest("CODIGO_INVALIDO", Msg.t("account.nenhuma_troca_pendente")));
        identity.requireCodeAttemptQuota(u.getId(), VerificationPurpose.EMAIL_CHANGE);
        if (!vc.isUsable(Instant.now())) {
            throw ApiException.badRequest("CODIGO_INVALIDO", Msg.t("account.codigo_invalido_ou_expirado"));
        }
        if (!IdentityService.codeMatches(vc, u.getId(), code)) {
            throw IdentityService.wrongCode(vc);
        }
        if (users.existsByEmailHash(Hashing.emailHash(vc.getTarget()))) {
            vc.setConsumedAt(Instant.now());                  // o endereço foi tomado por outra conta depois do pedido
            throw ApiException.conflict("EMAIL_EM_USO", Msg.t("account.este_e_mail_ja_esta"));
        }
        vc.setConsumedAt(Instant.now());
        u.setEmail(vc.getTarget());
        u.setEmailHash(Hashing.emailHash(vc.getTarget()));
        u.setEmailVerified(true);
        audit.log(user, AuditActions.ALTERACAO_DADO_PESSOAL_SENSIVEL, "user:" + u.getId(), Map.of("fields", List.of("email")));
        return Views.user(u);
    }

    /**
     * RF3.CA12 — visibilidade do perfil (público / somente seguidores / privado), aplicada imediatamente ao feed
     * (RF8) e ao perfil público (RF17). Privacy by Default: a conta nasce PRIVATE (RF3.CA19).
     */
    Map<String, Object> updatePrivacy(CurrentUser user, Visibility visibility) {
        if (visibility == null) {
            throw ApiException.badRequest("VISIBILIDADE_INVALIDA", Msg.t("account.escolha_publico_somente_seguidores"));
        }
        User u = lookup.load(user);
        u.setProfileVisibility(visibility);
        u.setPrivateAccount(visibility != Visibility.PUBLIC);
        audit.log(user, AuditActions.ALTERACAO_PERFIL, "user:" + u.getId(), Map.of("profileVisibility", visibility.name()));
        return Map.of("profileVisibility", visibility, "privateAccount", u.isPrivateAccount(),
                "defaultSchemeVisibility", defaultVisibility(u));
    }
}
