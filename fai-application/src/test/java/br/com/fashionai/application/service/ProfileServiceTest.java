package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Perfil e conexões (RF3/RF19): o perfil por id ou @, com conteúdo só para quem pode ver; seguir (direto ou com pedido
 * em conta privada), aceitar ou recusar, deixar de seguir, ver conexões e bloquear (quem é bloqueado não acha o perfil).
 */
class ProfileServiceTest {
    private Kit kit;
    private World world;
    private ProfileService profiles;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        Guard guard = kit.dep(Guard.class);
        when(guard.canView(any(), any(), eq(Visibility.PUBLIC))).thenReturn(true);
        when(guard.deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        profiles = kit.build(ProfileService.class);
        ana = Kit.as(world.me);
        bia = Kit.as(world.rival);
        world.me.setProfileVisibility(Visibility.PUBLIC);
    }

    @Test
    void perfilPorIdOuArrobaComConteudoVisivel() {
        Map<String, Object> p = profiles.profile(bia, "@ana");
        assertThat(p).containsEntry("self", false).containsEntry("contentVisible", true).containsEntry("layout", "PESSOAL");
        assertThat((List<?>) p.get("pieces")).hasSize(12);
        assertThat(profiles.profile(ana, world.me.getId().toString(), "hype")).containsEntry("self", true);
        assertThat(profiles.profile(null, "ana")).containsEntry("relation", "NENHUMA");
        world.rival.setProfileVisibility(Visibility.FOLLOWERS);
        Map<String, Object> closed = profiles.profile(ana, "bia");
        assertThat(closed).containsEntry("contentVisible", false).containsKey("invite");
        world.friend.setProfileVisibility(Visibility.PRIVATE);
        assertThat(map(profiles.profile(ana, "caio").get("invite"))).containsKey("message");
        assertThatThrownBy(() -> profiles.profile(ana, "ninguem")).isInstanceOf(ApiException.class);
        world.friend.setStatus(AccountStatus.DELETION_SCHEDULED);
        assertThatThrownBy(() -> profiles.profile(ana, "caio")).isInstanceOf(ApiException.class);
    }

    @Test
    void perfilInstitucionalInformaSlugDiferenteDoUsername() {
        world.me.setProfileType(ProfileType.CELEBRIDADE);
        CelebrityProfile c = new CelebrityProfile();
        c.setOwner(world.me);
        c.setSlug("celebridade-oficial");
        kit.save(CelebrityProfileRepository.class, c);
        assertThat(profiles.profile(ana, "ana")).containsEntry("layout", "INSTITUCIONAL")
                .containsEntry("institutionalSlug", "celebridade-oficial");
        world.rival.setProfileType(ProfileType.MARCA);
        BrandProfile b = new BrandProfile();
        b.setOwner(world.rival);
        b.setSlug("marca-oficial");
        kit.save(BrandProfileRepository.class, b);
        assertThat(profiles.profile(ana, "bia")).containsEntry("institutionalSlug", "marca-oficial");
    }

    @Test
    void seguirComPedidoEmContaPrivada() {
        world.rival.setPrivateAccount(true);
        world.rival.setProfileVisibility(Visibility.FOLLOWERS);
        assertThat(profiles.follow(ana, world.rival.getId())).containsEntry("relation", "PENDENTE");
        List<Map<String, Object>> reqs = profiles.requests(bia);
        assertThat(reqs).hasSize(1);
        UUID id = (UUID) reqs.get(0).get("id");
        assertThat(profiles.respond(bia, id, true)).containsEntry("accepted", true);
        assertThatThrownBy(() -> profiles.respond(bia, id, true)).isInstanceOf(ApiException.class);
        assertThat(profiles.follow(ana, world.rival.getId())).containsEntry("relation", "ACEITO");   // já segue
        assertThat(profiles.unfollow(ana, world.rival.getId())).containsEntry("relation", "NENHUMA");
        profiles.follow(Kit.as(world.friend), world.rival.getId());
        UUID second = (UUID) profiles.requests(bia).get(0).get("id");
        assertThat(profiles.respond(bia, second, false)).containsEntry("accepted", false);
        assertThatThrownBy(() -> profiles.follow(ana, world.me.getId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> profiles.follow(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> profiles.respond(bia, UUID.randomUUID(), true)).isInstanceOf(ApiException.class);
    }

    @Test
    void contaPublicaSeguidaNaHoraEConexoes() {
        assertThat(profiles.follow(bia, world.me.getId())).containsEntry("relation", "ACEITO");
        Map<String, Object> c = profiles.connections(bia, world.me.getId());
        assertThat((List<?>) c.get("followers")).hasSize(1);
        assertThat(profiles.connections(ana, world.me.getId())).containsKey("following");
        world.friend.setProfileVisibility(Visibility.PRIVATE);
        assertThatThrownBy(() -> profiles.connections(ana, world.friend.getId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> profiles.connections(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThat(profiles.counters(world.me.getId(), 3)).containsEntry("published", 3L);
    }

    @Test
    void bloquearEscondeOPerfilEDesfazASeguida() {
        profiles.follow(bia, world.me.getId());
        assertThat(profiles.block(ana, world.rival.getId(), true)).containsEntry("blocked", true);
        assertThat(MemoryRepository.<Follow>rows(kit.dep(FollowRepository.class))).allMatch(f -> f.getStatus() == FollowStatus.BLOQUEADO);
        assertThatThrownBy(() -> profiles.profile(bia, "ana")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> profiles.follow(bia, world.me.getId())).isInstanceOf(ApiException.class);
        assertThat(profiles.unfollow(ana, world.rival.getId())).containsEntry("relation", "BLOQUEADO");
        assertThat(profiles.block(ana, world.rival.getId(), false)).containsEntry("blocked", false);
        assertThat(MemoryRepository.<Follow>rows(kit.dep(FollowRepository.class))).isEmpty();
        assertThatThrownBy(() -> profiles.block(ana, world.me.getId(), true)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> profiles.block(ana, UUID.randomUUID(), true)).isInstanceOf(ApiException.class);
    }
}
