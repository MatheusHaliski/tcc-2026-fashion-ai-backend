package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;

import java.util.LinkedHashMap;
import java.util.Map;

import static br.com.fashionai.application.service.AccountService.defaultVisibility;

/** "Minha conta": dados da pessoa, perfil de marca/celebridade e os consentimentos atuais. */
final class AccountProfileView {
    private final UserPreferencesRepository preferences;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final AccountLookup lookup;
    private final AccountConsents consents;

    AccountProfileView(UserPreferencesRepository preferences, BrandProfileRepository brands, CelebrityProfileRepository celebrities,
                       AccountLookup lookup, AccountConsents consents) {
        this.preferences = preferences;
        this.brands = brands;
        this.celebrities = celebrities;
        this.lookup = lookup;
        this.consents = consents;
    }

    Map<String, Object> me(CurrentUser user) {
        User u = lookup.load(user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", Views.user(u));
        out.put("email", u.getEmail());
        out.put("emailVerified", u.isEmailVerified());
        out.put("phone", u.getPhone());
        out.put("birthDate", u.getBirthDate());
        out.put("bio", u.getBio());
        out.put("coverUrl", u.getCoverUrl());
        out.put("status", u.getStatus());
        out.put("role", u.getRole());
        out.put("twoFactorEnabled", u.isTwoFactorEnabled());
        out.put("termsVersion", u.getTermsVersion());
        out.put("deletionScheduledFor", u.getDeletionScheduledFor());
        out.put("lookDoDiaPanelVersion", u.getLookDoDiaPanelVersion());
        out.put("defaultSchemeVisibility", defaultVisibility(u));
        out.put("profileVisibility", u.getProfileVisibility());
        out.put("sex", u.getSex());
        out.put("runwayOptOut", u.isRunwayOptOut());
        out.put("auraHypeEnabled", preferences.findByUserId(u.getId()).map(p -> p.isAuraHype()).orElse(false));
        out.put("pronouns", u.getPronouns());
        out.put("links", Json.list(u.getLinksJson()));
        if (u.getProfileType() == ProfileType.MARCA) {
            brands.findByOwnerId(u.getId()).ifPresent(b -> out.put("brandProfile", Map.of("id", b.getId(), "slug", b.getSlug(),
                    "approvalStatus", b.getApprovalStatus(), "brandName", b.getBrandName())));
        }
        if (u.getProfileType() == ProfileType.CELEBRIDADE) {
            celebrities.findByOwnerId(u.getId()).ifPresent(c -> out.put("celebrityProfile", Map.of("id", c.getId(),
                    "slug", c.getSlug(), "verificationStatus", c.getVerificationStatus(), "stageName", c.getStageName())));
        }
        out.put("consents", consents.consents(user));
        return out;
    }
}
