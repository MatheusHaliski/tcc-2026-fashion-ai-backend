package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserConsent;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.repository.UserConsentRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.service.AccountConsentPurposes.PURPOSES;

/** Consentimento granular por finalidade (nada pré-marcado; revogar com o mesmo esforço de conceder, art. 8º §5º). */
final class AccountConsents {
    private final UserConsentRepository consents;
    private final Audit audit;
    private final AccountLookup lookup;

    AccountConsents(UserConsentRepository consents, Audit audit, AccountLookup lookup) {
        this.consents = consents;
        this.audit = audit;
        this.lookup = lookup;
    }

    List<Map<String, Object>> consents(CurrentUser user) {
        Map<ConsentPurpose, UserConsent> current = new LinkedHashMap<>();
        consents.findByUserId(user.id()).forEach(c -> current.put(c.getPurpose(), c));
        List<Map<String, Object>> out = new ArrayList<>();
        PURPOSES.forEach((purpose, info) -> {
            UserConsent c = current.get(purpose);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("purpose", purpose.name());
            m.put("title", info[0]);
            m.put("description", info[1]);
            m.put("legalBasis", info[2]);
            m.put("lgpdArticle", info[3]);
            m.put("sensitive", info[3].startsWith("Art. 11"));
            m.put("granted", c != null && c.isGranted());
            m.put("grantedAt", c == null ? null : c.getGrantedAt());
            m.put("revokedAt", c == null ? null : c.getRevokedAt());
            m.put("policyVersion", IdentityService.TERMS_VERSION);
            out.add(m);
        });
        return out;
    }

    List<Map<String, Object>> setConsent(CurrentUser user, ConsentPurpose purpose, boolean granted) {
        if (purpose == ConsentPurpose.FACIAL_RECOGNITION && granted) {
            throw ApiException.badRequest("FINALIDADE_NAO_UTILIZADA", Msg.t("account.o_fashion_ai_nao_usa"));
        }
        User u = lookup.load(user);
        UserConsent c = consents.findByUserIdAndPurpose(u.getId(), purpose).orElseGet(() -> {
            UserConsent n = new UserConsent();
            n.setUser(u);
            n.setPurpose(purpose);
            return n;
        });
        c.setGranted(granted);
        c.setLegalBasis(PURPOSES.get(purpose)[2]);
        c.setPolicyVersion(IdentityService.TERMS_VERSION);
        if (granted) {
            c.setGrantedAt(Instant.now());
            c.setRevokedAt(null);
        } else {
            c.setRevokedAt(Instant.now());
        }
        consents.save(c);
        audit.log(user, granted ? AuditActions.CONSENTIMENTO_CONCEDIDO : AuditActions.CONSENTIMENTO_REVOGADO,
                "consent:" + purpose, Map.of("purpose", purpose.name()));
        return consents(user);
    }
}
