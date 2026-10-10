package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** O feed entrega os mesmos dados públicos do header sem carregar documentos, análise ou métricas administrativas. */
class InstitutionalProfileFeedTest {
    private final UserRepository users = mock(UserRepository.class);
    private final BrandProfileRepository brands = mock(BrandProfileRepository.class);
    private final CelebrityProfileRepository celebrities = mock(CelebrityProfileRepository.class);
    private final FollowRepository follows = mock(FollowRepository.class);
    private final SealRepository seals = mock(SealRepository.class);
    private final SealBondRepository bonds = mock(SealBondRepository.class);
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final HypeQueryService hype = mock(HypeQueryService.class);
    private final InstitutionalService service = new InstitutionalService(users, brands, celebrities, follows, seals, bonds,
            schemes, mock(SchemeItemRepository.class), pieces, mock(SavedItemRepository.class), mock(ReactionRepository.class),
            mock(SchemeGroupingRepository.class), mock(StyleDnaRepository.class), mock(SchemeService.class), mock(SealService.class),
            mock(AiEngine.class), mock(Guard.class), hype);

    @BeforeEach
    void acceptedRelationshipsOnly() {
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
    }

    @Test
    void feedDaMarcaTemOsMesmosCamposPublicosDoHeaderComFotoRealECapa() {
        User owner = owner("maison-user", ProfileType.MARCA);
        owner.setAvatarUrl("/media/owner-real-photo.jpg");
        BrandProfile brand = brand(owner);
        brand.setLogoUrl("/media/brand-logo.png");
        brand.setCoverUrl("/media/brand-cover.jpg");
        brand.setBio("Design autoral desde 2020.");
        brand.setStoreUrl("https://maison.example/store");
        brand.setFashionCategory("Prêt-à-porter");
        brand.setOfficialHashtag("#Maison");
        brand.setCountry("BR");
        brand.setCnpj("PRIVATE_CNPJ");
        brand.setCommercialContact("PRIVATE_COMMERCIAL_CONTACT");
        brand.setActivityProofUrl("PRIVATE_ACTIVITY_PROOF");
        brand.setVerificationNotes("PRIVATE_REVIEW_NOTES");
        brand.setReviewChecklist("PRIVATE_CHECKLIST");
        prepare(owner);
        when(brands.findByOwnerId(owner.getId())).thenReturn(Optional.of(brand));
        when(brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(brand));
        Map<String, Object> groupHype = Map.of("sufficient", true, "value", 81.0);
        when(hype.groups(null, HypeQueryService.RankGroup.BRAND, List.of("maison"), 7))
                .thenReturn(Map.of("items", Map.of("maison", groupHype)));

        Map<String, Object> card = cards(service.brandFeed(null, null, "RECENTES"), "brands").getFirst();
        Map<String, Object> header = header(service.profile(null, owner.getId().toString()));

        assertPublicParity(card, header);
        assertThat(card).containsEntry("username", "maison-user")
                .containsEntry("userAvatarUrl", "/media/owner-real-photo.jpg")
                .containsEntry("logoUrl", "/media/brand-logo.png")
                .containsEntry("coverUrl", "/media/brand-cover.jpg")
                .containsEntry("bio", "Design autoral desde 2020.")
                .containsEntry("storeUrl", "https://maison.example/store")
                .containsEntry("category", "Prêt-à-porter")
                .containsEntry("officialHashtag", "#Maison")
                .containsEntry("country", "BR")
                .containsEntry("status", "Validada")
                .containsEntry("kind", "MARCA")
                .containsEntry("verified", true)
                .containsEntry("privateAccount", false)
                .containsEntry("visibility", "PUBLIC")
                .containsEntry("hype", groupHype);
        assertCounters(card);
        assertThat(Json.write(card)).doesNotContain("PRIVATE_");
        assertThat(card).doesNotContainKeys("metrics", "reviewBanner", "autoApproval", "coverLabel", "viewerFollows");
        verify(seals, never()).findByOwnerIdAndStatusOrderByCreatedAtDesc(any(), any());
    }

    @Test
    void feedDaCelebridadeTemAreasETodosOsContadoresDoHeaderComFotoOficialComoFallback() {
        User owner = owner("artist-user", ProfileType.CELEBRIDADE);
        owner.setAvatarUrl(null);
        owner.setCountry("PT");
        owner.setPrivateAccount(true);
        owner.setProfileVisibility(Visibility.PRIVATE);
        CelebrityProfile celebrity = celebrity(owner);
        celebrity.setAvatarUrl("/media/official-artist-photo.jpg");
        celebrity.setCoverUrl("/media/artist-cover.jpg");
        celebrity.setBio("Cantora e compositora.");
        celebrity.setAreasJson(Json.write(List.of("Música", "Cinema")));
        celebrity.setStyleSignatureJson(Json.write(Map.of("archetype", "DRAMATIC")));
        celebrity.setRealName("PRIVATE_REAL_NAME");
        celebrity.setRepresentationContact("PRIVATE_AGENT");
        celebrity.setIdentityProofUrl("PRIVATE_DOCUMENT");
        celebrity.setVerificationUrl("https://private-proof.example");
        celebrity.setVerificationNotes("PRIVATE_REVIEW_NOTES");
        prepare(owner);
        when(celebrities.findByOwnerId(owner.getId())).thenReturn(Optional.of(celebrity));
        when(celebrities.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(celebrity));

        Map<String, Object> card = cards(service.celebrityFeed(null, null, "RECENTES"), "celebrities").getFirst();
        Map<String, Object> header = header(service.profile(null, owner.getId().toString()));

        assertPublicParity(card, header);
        assertThat(card).containsEntry("username", "artist-user")
                .containsEntry("userAvatarUrl", null)
                .containsEntry("avatarUrl", "/media/official-artist-photo.jpg")
                .containsEntry("coverUrl", "/media/artist-cover.jpg")
                .containsEntry("bio", "Cantora e compositora.")
                .containsEntry("areas", List.of("Música", "Cinema"))
                .containsEntry("country", "PT")
                .containsEntry("status", "Verificada")
                .containsEntry("kind", "CELEBRIDADE")
                .containsEntry("verified", true)
                .containsEntry("privateAccount", true)
                .containsEntry("visibility", "PRIVATE")
                .containsEntry("storeUrl", null);
        assertCounters(card);
        assertThat(Json.write(card)).doesNotContain("PRIVATE_", "private-proof.example");
        assertThat(card).doesNotContainKeys("metrics", "reviewBanner", "autoApproval", "autoApprovalLocked", "viewerFollows");
    }

    @Test
    void visibilidadeParaSeguidoresNaoEhConvertidaEmPublicaPeloBooleanoLegado() {
        User owner = owner("followers-only", ProfileType.MARCA);
        owner.setProfileVisibility(Visibility.FOLLOWERS);
        owner.setPrivateAccount(false);
        BrandProfile brand = brand(owner);

        Map<String, Object> card = service.brandCard(brand);

        assertThat(card).containsEntry("privateAccount", false).containsEntry("visibility", "FOLLOWERS");
        owner.setProfileVisibility(null);
        assertThat(service.brandCard(brand)).containsEntry("visibility", "PUBLIC");
        owner.setPrivateAccount(true);
        assertThat(service.brandCard(brand)).containsEntry("visibility", "PRIVATE");
    }

    @Test
    void perfilPendenteContinuaRestritoEAFlagVerificadaDaContaEhPreservada() {
        User owner = owner("pending-artist", ProfileType.CELEBRIDADE);
        CelebrityProfile celebrity = celebrity(owner);
        celebrity.setVerificationStatus(ApprovalStatus.PENDENTE);
        celebrity.setAreasJson("JSON legado inválido");
        prepare(owner);
        when(celebrities.findByOwnerId(owner.getId())).thenReturn(Optional.of(celebrity));

        assertThatThrownBy(() -> service.profile(null, owner.getId().toString()))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status()).isEqualTo(404));
        Map<String, Object> ownHeader = header(service.profile(CurrentUser.of(owner, null, null), owner.getId().toString()));
        assertThat(ownHeader).containsEntry("verified", false).containsEntry("status", "PENDENTE").containsEntry("areas", List.of());
        owner.setVerified(true);
        assertThat(header(service.profile(CurrentUser.of(owner, null, null), owner.getId().toString())))
                .containsEntry("verified", true).containsEntry("status", "PENDENTE");
        assertThat(cards(service.celebrityFeed(null, null, "RECENTES"), "celebrities")).isEmpty();
        verify(celebrities).findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO);
    }

    private void prepare(User owner) {
        UUID id = owner.getId();
        when(users.findById(id)).thenReturn(Optional.of(owner));
        when(follows.countByFollowingIdAndStatus(id, FollowStatus.ACEITO)).thenReturn(120L);
        when(follows.countByFollowerIdAndStatus(id, FollowStatus.ACEITO)).thenReturn(35L);
        when(pieces.countByUserIdAndAvailabilityStatusNot(id, AvailabilityStatus.ARCHIVED)).thenReturn(14L);
        when(schemes.countByUserIdAndStatusNot(id, SchemeStatus.ARCHIVED)).thenReturn(8L);
        when(seals.countByOwnerIdAndStatus(id, SealStatus.ACTIVE)).thenReturn(3L);
        when(bonds.countByTargetOwnerIdAndStatus(id, SealBondStatus.APPROVED)).thenReturn(6L);
    }

    private static User owner(String username, ProfileType kind) {
        User owner = new User();
        owner.assignId(UUID.randomUUID());
        owner.setUsername(username);
        owner.setProfileType(kind);
        owner.setStatus(AccountStatus.ACTIVE);
        owner.setPrivateAccount(false);
        owner.setProfileVisibility(Visibility.PUBLIC);
        owner.setEmail("PRIVATE_EMAIL");
        return owner;
    }

    private static BrandProfile brand(User owner) {
        BrandProfile brand = new BrandProfile();
        brand.setOwner(owner);
        brand.setBrandName("Maison");
        brand.setSlug("maison");
        brand.setApprovalStatus(ApprovalStatus.APROVADO);
        return brand;
    }

    private static CelebrityProfile celebrity(User owner) {
        CelebrityProfile celebrity = new CelebrityProfile();
        celebrity.setOwner(owner);
        celebrity.setStageName("Artist");
        celebrity.setSlug("artist");
        celebrity.setVerificationStatus(ApprovalStatus.APROVADO);
        return celebrity;
    }

    private static void assertCounters(Map<String, Object> card) {
        assertThat(card).containsEntry("followers", 120L).containsEntry("following", 35L)
                .containsEntry("pieces", 14L).containsEntry("schemes", 8L).containsEntry("activeSeals", 3L).containsEntry("bonds", 6L);
    }

    private static void assertPublicParity(Map<String, Object> card, Map<String, Object> header) {
        card.forEach((key, value) -> {
            if (!key.equals("hype") && !key.equals("affinity")) assertThat(header).as("Campo público %s", key).containsEntry(key, value);
        });
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> header(Map<String, Object> response) {
        return (Map<String, Object>) response.get("header");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> cards(Map<String, Object> response, String collection) {
        return (List<Map<String, Object>>) response.get(collection);
    }
}
