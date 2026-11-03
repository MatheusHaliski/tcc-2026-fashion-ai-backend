package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;

/**
 * RF20.CA06 / RF21.CA19 — emissor apto a conceder selo (marca validada ou celebridade verificada com consentimento),
 * emissor disponível para o modo Hype e a exigência de perfil institucional aprovado. Colaborador do {@link SealService} (R80).
 */
final class SealIssuers {
    private final BrandProfileRepository brandProfiles;
    private final CelebrityProfileRepository celebrityProfiles;
    private final Guard guard;

    SealIssuers(BrandProfileRepository brandProfiles, CelebrityProfileRepository celebrityProfiles, Guard guard) {
        this.brandProfiles = brandProfiles;
        this.celebrityProfiles = celebrityProfiles;
        this.guard = guard;
    }

    boolean hypeIssuerAvailable(User owner) {
        return owner != null && owner.getStatus() == br.com.fashionai.domain.model.enums.AccountStatus.ACTIVE
                && (owner.getProfileType() == ProfileType.MARCA || owner.getProfileType() == ProfileType.CELEBRIDADE) && issuer(owner) != null;
    }

    record Issuer(String kind, String name, String logoUrl, boolean celebrity) {
    }

    /** Emissor apto a conceder selo: marca validada ou celebridade verificada com consentimento (RF20.CA06/RF21.CA19). */
    Issuer issuer(User owner) {
        if (owner.getProfileType() == ProfileType.CELEBRIDADE) {
            return celebrityProfiles.findByOwnerId(owner.getId())
                    .filter(cp -> cp.getVerificationStatus() == ApprovalStatus.APROVADO && cp.isSealConsentGranted())
                    .map(cp -> new Issuer("CELEBRITY", cp.getStageName(), cp.getAvatarUrl(), true)).orElse(null);
        }
        return brandProfiles.findByOwnerId(owner.getId()).filter(bp -> bp.getApprovalStatus() == ApprovalStatus.APROVADO)
                .map(bp -> new Issuer("BRAND", bp.getBrandName(), bp.getLogoUrl(), false)).orElse(null);
    }

    void requireIssuer(CurrentUser user) {
        guard.requireApprovedInstitutional(user, "seals", Msg.t("seal.selos_e_promocoes_sao_geridos"));
    }
}
