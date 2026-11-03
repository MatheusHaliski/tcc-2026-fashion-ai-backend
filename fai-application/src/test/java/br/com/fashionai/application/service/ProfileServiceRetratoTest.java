package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Caracterização do R95 (sobre o ProfileService original): perfil próprio, de visitante, sem login, fechado, de quem
 * bloqueou, institucional e ordenado pelo Hype; seguir/deixar de seguir, pedidos, conexões e bloqueio — respostas e
 * chamadas de permissão, notificações e montagem dos looks.
 */
class ProfileServiceRetratoTest {
    private static final Path GOLDEN = Path.of("src/test/resources/identity/profile-service-retrato.txt");

    @Test
    void retratoDoPerfil() throws Exception {
        Kit kit = new Kit();
        World world = new World(kit);
        Guard guard = kit.dep(Guard.class);
        when(guard.canView(any(), any(), eq(Visibility.PUBLIC))).thenReturn(true);
        when(guard.deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        ProfileService profiles = kit.build(ProfileService.class);
        LevelProgressService progress = kit.dep(LevelProgressService.class);
        when(progress.progress(any())).thenReturn(Map.of("level", 3));
        profiles.setLevelProgress(progress);
        IdentityRetrato r = new IdentityRetrato();
        CurrentUser ana = Kit.as(world.me);
        CurrentUser bia = Kit.as(world.rival);
        CurrentUser caio = Kit.as(world.friend);
        Runnable calls = () -> {
            r.calls("guard", guard);
            r.calls("notifications", kit.dep(NotificationService.class));
            r.calls("schemeService", kit.dep(SchemeService.class));
            r.calls("progress", progress);
        };
        world.me.setProfileVisibility(Visibility.PUBLIC);
        r.step("profile.self", () -> profiles.profile(ana, "ana"));
        r.step("profile.visitante", () -> profiles.profile(bia, "@ana"));
        r.step("profile.anonimo", () -> profiles.profile(null, world.me.getId().toString()));
        r.step("profile.hype", () -> profiles.profile(bia, "ana", "hype_desc"));
        r.step("profile.inexistente", () -> profiles.profile(bia, "ninguem"));
        calls.run();
        world.me.setProfileVisibility(Visibility.FOLLOWERS);
        r.step("profile.seguidores", () -> profiles.profile(bia, "ana"));
        world.me.setProfileVisibility(Visibility.PRIVATE);
        r.step("profile.privado", () -> profiles.profile(bia, "ana"));
        world.friend.setStatus(AccountStatus.DELETION_SCHEDULED);
        r.step("profile.exclusaoAgendada", () -> profiles.profile(bia, "caio"));
        world.friend.setStatus(AccountStatus.ACTIVE);
        calls.run();

        User celeb = Kit.user("estrela");
        celeb.setProfileType(ProfileType.CELEBRIDADE);
        celeb.setProfileVisibility(Visibility.PUBLIC);
        kit.dep(UserRepository.class).save(celeb);
        CelebrityProfile cp = new CelebrityProfile();
        cp.setOwner(celeb);
        cp.setStageName("Estrela");
        cp.setSlug("estrela-oficial");
        kit.dep(CelebrityProfileRepository.class).save(cp);
        r.step("profile.institucional", () -> profiles.profile(bia, "estrela"));
        calls.run();

        r.step("follow.si", () -> profiles.follow(ana, world.me.getId()));
        r.step("follow.inexistente", () -> profiles.follow(ana, UUID.randomUUID()));
        world.rival.setPrivateAccount(true);
        world.rival.setProfileVisibility(Visibility.FOLLOWERS);
        r.step("follow.pedido", () -> profiles.follow(ana, world.rival.getId()));
        r.step("follow.pedidoDeNovo", () -> profiles.follow(ana, world.rival.getId()));
        r.step("follow.publico", () -> profiles.follow(caio, celeb.getId()));
        r.step("follow.jaSegue", () -> profiles.follow(caio, celeb.getId()));
        r.step("requests", () -> profiles.requests(bia));
        Follow pending = MemoryRepository.<Follow>rows(kit.dep(FollowRepository.class)).get(0);
        r.step("respond.outro", () -> profiles.respond(caio, pending.getId(), true));
        r.step("respond.aceita", () -> profiles.respond(bia, pending.getId(), true));
        r.step("respond.deNovo", () -> profiles.respond(bia, pending.getId(), false));
        r.step("respond.inexistente", () -> profiles.respond(bia, UUID.randomUUID(), false));
        r.step("profile.selfComPedidos", () -> profiles.profile(bia, "bia"));
        r.step("connections", () -> profiles.connections(caio, world.rival.getId()));
        r.step("connections.self", () -> profiles.connections(bia, world.rival.getId()));
        r.step("connections.anonimoPublico", () -> profiles.connections(null, celeb.getId()));
        r.step("connections.inexistente", () -> profiles.connections(null, UUID.randomUUID()));
        r.step("unfollow", () -> profiles.unfollow(caio, celeb.getId()));
        r.step("counters", () -> profiles.counters(world.rival.getId(), 7));
        calls.run();

        r.step("block.si", () -> profiles.block(ana, world.me.getId(), true));
        r.step("block.inexistente", () -> profiles.block(ana, UUID.randomUUID(), true));
        r.step("block", () -> profiles.block(bia, world.me.getId(), true));
        world.me.setProfileVisibility(Visibility.PUBLIC);
        r.step("profile.bloqueado", () -> profiles.profile(ana, "bia"));
        r.step("follow.bloqueado", () -> profiles.follow(ana, world.rival.getId()));
        r.step("unfollow.bloqueio", () -> profiles.unfollow(bia, world.me.getId()));
        r.step("unblock", () -> profiles.block(bia, world.me.getId(), false));
        r.step("unblock.semBloqueio", () -> profiles.block(bia, world.me.getId(), false));
        r.step("profile.desbloqueado", () -> profiles.profile(ana, "bia"));
        calls.run();
        Mockito.verifyNoMoreInteractions(kit.dep(NotificationService.class));
        assertThat(r.text()).isEqualTo(IdentityRetrato.golden(r.text(), GOLDEN));
    }
}
