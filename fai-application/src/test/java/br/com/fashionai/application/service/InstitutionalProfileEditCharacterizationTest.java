package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.AreaArtisticaRepository;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CategoriaMarcaRepository;
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
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caracterização da edição institucional (PATCH /api/me/brand-profile e /api/me/celebrity-profile), escrita antes de
 * extrair a edição do InstitutionalService (exercícios 09 e 10): quem edita é o dono da sessão, campo omitido fica como
 * está, a resposta é o card público e quem não tem o perfil recebe 403.
 */
class InstitutionalProfileEditCharacterizationTest {
    final InstitutionalEditKit kit = new InstitutionalEditKit();

    @Test
    void marcaEditaSoOsCamposEnviadosEARespostaEhOCardPublico() {
        User owner = kit.owner("maison", ProfileType.MARCA);
        BrandProfile brand = kit.brand(owner);
        brand.setBio("Bio antiga");
        brand.setStoreUrl("https://antiga.example");
        brand.setFashionCategory("Prêt-à-porter");

        Map<String, String> fields = new HashMap<>();
        fields.put("bio", "  <b>Design</b> autoral  ");
        fields.put("logoUrl", "/media/logo.png");
        fields.put("coverUrl", "/media/capa.jpg");
        Map<String, Object> card = kit.service.updateBrand(kit.as(owner), fields);

        assertThat(brand.getBio()).isEqualTo("Design autoral");
        assertThat(brand.getStoreUrl()).as("campo omitido fica como está").isEqualTo("https://antiga.example");
        assertThat(brand.getFashionCategory()).isEqualTo("Prêt-à-porter");
        assertThat(card).containsEntry("name", "Maison").containsEntry("slug", "maison").containsEntry("bio", "Design autoral")
                .containsEntry("logoUrl", "/media/logo.png").containsEntry("coverUrl", "/media/capa.jpg")
                .containsEntry("category", "Prêt-à-porter").containsEntry("storeUrl", "https://antiga.example")
                .containsEntry("kind", "MARCA").containsEntry("material", "TEXTIL_DOURADO");
        verify(kit.brands).save(brand);
    }

    @Test
    void marcaTrocaACategoriaLegadaEmTextoEALojaPrecisaSerHttps() {
        User owner = kit.owner("maison", ProfileType.MARCA);
        BrandProfile brand = kit.brand(owner);

        kit.service.updateBrand(kit.as(owner), Map.of("fashionCategory", "  Alta <i>costura</i> ", "storeUrl", "https://maison.example"));
        assertThat(brand.getFashionCategory()).isEqualTo("Alta costura");
        assertThat(brand.getStoreUrl()).isEqualTo("https://maison.example");

        assertThatThrownBy(() -> kit.service.updateBrand(kit.as(owner), Map.of("storeUrl", "http://sem-tls.example")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("URL_INVALIDA"));
        assertThat(brand.getStoreUrl()).isEqualTo("https://maison.example");
        kit.service.updateBrand(kit.as(owner), Map.of("storeUrl", ""));
        assertThat(brand.getStoreUrl()).isEmpty();
    }

    @Test
    void quemNaoTemPerfilDeMarcaOuDeCelebridadeRecebe403ENadaEhGravado() {
        User pessoa = kit.owner("ana", ProfileType.PESSOAL);

        assertThatThrownBy(() -> kit.service.updateBrand(kit.as(pessoa), Map.of("bio", "x")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> kit.service.updateCelebrity(kit.as(pessoa), Map.of("bio", "x")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        verify(kit.guard).deny(any(), eq("brand-profile"), any());
        verify(kit.guard).deny(any(), eq("celebrity-profile"), any());
        verify(kit.brands, never()).save(any());
        verify(kit.celebrities, never()).save(any());
    }

    @Test
    void celebridadeEditaBioCapaAssinaturaEConsentimentoSemMexerNasAreasNemNaVerificacao() {
        User owner = kit.owner("artist", ProfileType.CELEBRIDADE);
        CelebrityProfile celebrity = kit.celebrity(owner);
        celebrity.setAreasJson("[\"Música\",\"Cinema\"]");
        celebrity.setVerificationStatus(ApprovalStatus.PENDENTE);

        Map<String, Object> card = kit.service.updateCelebrity(kit.as(owner), Map.of("bio", " Cantora ", "coverUrl", "/media/capa.jpg",
                "styleSignature", Map.of("styles", List.of("glam")), "sealConsentGranted", true));

        assertThat(celebrity.getBio()).isEqualTo("Cantora");
        assertThat(celebrity.getCoverUrl()).isEqualTo("/media/capa.jpg");
        assertThat(celebrity.isSealConsentGranted()).isTrue();
        assertThat(celebrity.getVerificationStatus()).isEqualTo(ApprovalStatus.PENDENTE);
        assertThat(card).containsEntry("name", "Artist").containsEntry("bio", "Cantora").containsEntry("areas", List.of("Música", "Cinema"))
                .containsEntry("styleSignature", Map.of("styles", List.of("glam"))).containsEntry("kind", "CELEBRIDADE")
                .containsEntry("status", "PENDENTE").containsEntry("storeUrl", null).containsEntry("material", "VITREO_HOLOGRAFICO");
        verify(kit.celebrities).save(celebrity);
    }

    /** Bancada: o InstitutionalService com repositórios simulados; o perfil de cada dono é achado pelo id da sessão. */
    static final class InstitutionalEditKit {
        final BrandProfileRepository brands = mock(BrandProfileRepository.class);
        final CelebrityProfileRepository celebrities = mock(CelebrityProfileRepository.class);
        final Guard guard = mock(Guard.class);
        final CategoriaMarcaRepository categorias = mock(CategoriaMarcaRepository.class);
        final AreaArtisticaRepository areas = mock(AreaArtisticaRepository.class);
        final InstitutionalService service = new InstitutionalService(mock(UserRepository.class), brands, celebrities, mock(FollowRepository.class),
                mock(SealRepository.class), mock(SealBondRepository.class), mock(SchemeRepository.class), mock(SchemeItemRepository.class),
                mock(WardrobeItemRepository.class), mock(SavedItemRepository.class), mock(ReactionRepository.class),
                mock(SchemeGroupingRepository.class), mock(StyleDnaRepository.class), mock(SchemeService.class), mock(SealService.class),
                mock(AiEngine.class), guard, mock(HypeQueryService.class));

        InstitutionalEditKit() {
            when(guard.deny(any(), any(), any())).thenAnswer(call -> ApiException.forbidden(call.getArgument(2)));
            service.setReferenceWriters(new BrandCategoryWriter(categorias), new CelebrityAreaWriter(areas));
        }

        User owner(String username, ProfileType kind) {
            User owner = new User();
            owner.assignId(UUID.randomUUID());
            owner.setUsername(username);
            owner.setProfileType(kind);
            owner.setStatus(AccountStatus.ACTIVE);
            when(brands.findByOwnerId(owner.getId())).thenReturn(Optional.empty());
            when(celebrities.findByOwnerId(owner.getId())).thenReturn(Optional.empty());
            return owner;
        }

        BrandProfile brand(User owner) {
            BrandProfile brand = new BrandProfile();
            brand.setOwner(owner);
            brand.setBrandName("Maison");
            brand.setSlug("maison");
            brand.setApprovalStatus(ApprovalStatus.APROVADO);
            when(brands.findByOwnerId(owner.getId())).thenReturn(Optional.of(brand));
            return brand;
        }

        CelebrityProfile celebrity(User owner) {
            CelebrityProfile celebrity = new CelebrityProfile();
            celebrity.setOwner(owner);
            celebrity.setStageName("Artist");
            celebrity.setSlug("artist");
            celebrity.setVerificationStatus(ApprovalStatus.APROVADO);
            when(celebrities.findByOwnerId(owner.getId())).thenReturn(Optional.of(celebrity));
            return celebrity;
        }

        CurrentUser as(User user) {
            return CurrentUser.of(user, "127.0.0.1", "test");
        }
    }
}
