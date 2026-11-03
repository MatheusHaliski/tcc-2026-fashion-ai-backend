package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import br.com.fashionai.domain.repository.CommentRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.PhotoRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Conteúdo do pacote LGPD (art. 18, V): perfil, preferências, consentimentos, acervo, interações, DNA, IA e Hype. */
final class AccountExportData {
    private final UserPreferencesRepository preferences;
    private final UserConsentRepository consents;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final CommentRepository comments;
    private final SavedItemRepository saved;
    private final FollowRepository follows;
    private final PhotoRepository photos;
    private final NotificationRepository notificationRepository;
    private final StyleDnaRepository styleDna;
    private final DnaSchemeRepository dnaSchemes;
    private final AiInferenceLogRepository inferences;
    private final AccountHypeExport hype;

    AccountExportData(UserPreferencesRepository preferences, UserConsentRepository consents, WardrobeItemRepository pieces,
                      SchemeRepository schemes, SchemeItemRepository schemeItems, CommentRepository comments,
                      SavedItemRepository saved, FollowRepository follows, PhotoRepository photos,
                      NotificationRepository notificationRepository, StyleDnaRepository styleDna, DnaSchemeRepository dnaSchemes,
                      AiInferenceLogRepository inferences, AccountHypeExport hype) {
        this.preferences = preferences;
        this.consents = consents;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.comments = comments;
        this.saved = saved;
        this.follows = follows;
        this.photos = photos;
        this.notificationRepository = notificationRepository;
        this.styleDna = styleDna;
        this.dnaSchemes = dnaSchemes;
        this.inferences = inferences;
        this.hype = hype;
    }

    Map<String, Object> exportData(User u) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exportedAt", Instant.now());
        data.put("format", Msg.t("account.fashion_ai_exportacao_lgpd_art"));
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", u.getId());
        profile.put("username", u.getUsername());
        profile.put("displayName", u.getDisplayName());
        profile.put("email", u.getEmail());
        profile.put("phone", u.getPhone());
        profile.put("birthDate", u.getBirthDate());
        profile.put("bio", u.getBio());
        profile.put("country", u.getCountry());
        profile.put("profileType", u.getProfileType());
        profile.put("privateAccount", u.isPrivateAccount());
        profile.put("createdAt", u.getCreatedAt());
        profile.put("termsAcceptedAt", u.getTermsAcceptedAt());
        data.put("profile", profile);
        // RF53 · P3-12: a opção de não aparecer em "Criadores em alta" também é da pessoa e vai na exportação
        preferences.findByUserId(u.getId()).ifPresent(p -> data.put("preferences", Map.of("theme", p.getTheme(),
                "language", p.getLanguage(), "density", p.getDensity(), "fontScale", p.getFontScale(),
                "chromeBackgroundId", String.valueOf(p.getChromeBackgroundId()), "hypeCreatorOptOut", p.isHypeCreatorOptOut())));
        data.put("consents", consents.findByUserId(u.getId()).stream().map(c -> Map.of("purpose", c.getPurpose(),
                "granted", c.isGranted(), "grantedAt", String.valueOf(c.getGrantedAt()), "revokedAt", String.valueOf(c.getRevokedAt()))).toList());
        List<WardrobeItem> myPieces = pieces.findByUserIdOrderByCreatedAtDesc(u.getId());
        data.put("pieces", myPieces.stream().map(p -> Views.piece(p, null, null)).toList());
        List<Scheme> mySchemes = schemes.findByUserIdOrderByCreatedAtDesc(u.getId());
        data.put("schemes", mySchemes.stream().map(s -> Views.scheme(s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()),
                null, null)).toList());
        data.put("comments", comments.findByAuthorId(u.getId()).stream().map(c -> Map.of("id", c.getId(), "targetType",
                c.getTargetType(), "targetId", c.getTargetId(), "content", c.getContent(), "createdAt", c.getCreatedAt())).toList());
        data.put("saved", saved.findByUserIdAndTargetTypeOrderBySavedAtDesc(u.getId(), br.com.fashionai.domain.model.enums.TargetType.SCHEME)
                .stream().map(s -> Map.of("targetId", s.getTargetId(), "savedAt", s.getSavedAt())).toList());
        data.put("following", follows.findByFollowerIdAndStatus(u.getId(), FollowStatus.ACEITO).stream()
                .map(f -> f.getFollowing().getUsername()).toList());
        data.put("photos", photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(u.getId()).stream().map(Views::photo).toList());
        data.put("notifications", notificationRepository.findTop100ByRecipientIdAndDeliveredTrueOrderByCreatedAtDesc(u.getId())
                .stream().map(Views::notification).toList());
        data.put("styleDna", styleDna.findByUserId(u.getId()).map(d -> Map.of("archetype", String.valueOf(d.getArchetype()),
                "boldnessIndex", d.getBoldnessIndex(), "identityPhrase", String.valueOf(d.getIdentityPhrase()))).orElse(null));
        data.put("dnaSchemes", dnaSchemes.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().map(d -> Map.of("id", d.getId(),
                "title", d.getTitle(), "createdAt", d.getCreatedAt())).toList());
        data.put("aiInferences", inferences.findTop100ByUserIdOrderByCreatedAtDesc(u.getId()).stream().map(i -> Map.of(
                "capability", i.getCapability(), "provider", i.getProvider(), "model", i.getModel(), "result", i.getResult(),
                "createdAt", i.getCreatedAt())).toList());
        data.put("hype", hype.hypeExport(u, myPieces, mySchemes));
        return data;
    }
}
