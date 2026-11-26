package br.com.fashionai.application.physicalstore;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Identidade de quem vende na loja física (era WardrobeCreatorService.identity, do criador de guarda-roupas do Meu
 * Quarto): marca ou celebridade com perfil mostram o nome, o logo e o slug do perfil; sem perfil, o nome e a foto da conta.
 */
class SellerIdentityTest {
    private final BrandProfileRepository brands = mock(BrandProfileRepository.class);
    private final CelebrityProfileRepository celebrities = mock(CelebrityProfileRepository.class);
    private final SellerIdentity sellers = new SellerIdentity(brands, celebrities);

    private static User user(ProfileType type) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setProfileType(type);
        u.setDisplayName("Conta");
        u.setAvatarUrl("/media/conta.png");
        return u;
    }

    @Test
    void marcaComPerfilUsaNomeLogoESlugDaMarca() {
        User u = user(ProfileType.MARCA);
        BrandProfile b = new BrandProfile();
        b.setBrandName("Atelier Lume");
        b.setLogoUrl("/media/lume.png");
        b.setSlug("atelier-lume");
        when(brands.findByOwnerId(u.getId())).thenReturn(Optional.of(b));

        Map<String, Object> id = sellers.identity(u);

        assertThat(id).containsEntry("name", "Atelier Lume").containsEntry("logoUrl", "/media/lume.png")
                .containsEntry("slug", "atelier-lume").containsEntry("kind", ProfileType.MARCA).containsKey("user");
    }

    @Test
    void celebridadeUsaONomeArtisticoESemPerfilFicaAConta() {
        User star = user(ProfileType.CELEBRIDADE);
        CelebrityProfile c = new CelebrityProfile();
        c.setStageName("Estrela");
        c.setSlug("estrela");
        when(celebrities.findByOwnerId(star.getId())).thenReturn(Optional.of(c));
        assertThat(sellers.identity(star)).containsEntry("name", "Estrela").containsEntry("logoUrl", "/media/conta.png").containsEntry("slug", "estrela");

        User semPerfil = user(ProfileType.MARCA);
        when(brands.findByOwnerId(any())).thenReturn(Optional.empty());
        assertThat(sellers.identity(semPerfil)).containsEntry("name", "Conta").containsEntry("logoUrl", "/media/conta.png").containsEntry("slug", null);
    }
}
