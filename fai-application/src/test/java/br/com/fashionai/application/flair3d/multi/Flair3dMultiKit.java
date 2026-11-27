package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/** Monta os serviços do multiplayer com repositórios em memória, pessoas, cartas e conexões (testes do FLAIR 3D multi). */
final class Flair3dMultiKit {
    final Kit kit = new Kit();
    final Flair3dConviteService convites;
    final Flair3dSalaTurnos turnos;
    final Flair3dSalaAssincrona assincrona;
    final Flair3dSalaLeitura leitura;
    final Flair3dSalaCaixa caixa;
    final Flair3dAdversarios adversarios;

    Flair3dMultiKit() {
        kit.real(Flair3dCartas.class);
        kit.real(Flair3dNucleoService.class);
        kit.real(Flair3dConvidavel.class);
        kit.real(Flair3dSalaAcesso.class);
        kit.real(Flair3dSalaVista.class);
        kit.real(Flair3dSalaAvisos.class);
        kit.real(Flair3dSalaPlacar.class);
        kit.real(Flair3dAdversarioPerfil.class);
        assincrona = kit.real(Flair3dSalaAssincrona.class);
        convites = kit.build(Flair3dConviteService.class);
        turnos = kit.build(Flair3dSalaTurnos.class);
        leitura = kit.build(Flair3dSalaLeitura.class);
        caixa = kit.build(Flair3dSalaCaixa.class);
        adversarios = kit.build(Flair3dAdversarios.class);
    }

    User pessoa(String username) {
        return kit.save(UserRepository.class, Kit.user(username));
    }

    CurrentUser como(User u) {
        return Kit.as(u);
    }

    FlairCardInstance carta(CurrentUser dono, String posicao, String... etiquetas) {
        return kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(dono.id(), posicao, etiquetas));
    }

    static List<UUID> ids(FlairCardInstance... cartas) {
        return Arrays.stream(cartas).map(FlairCardInstance::getId).toList();
    }

    void segue(User quem, User quemE, FollowStatus status) {
        Follow f = new Follow();
        f.setFollower(quem);
        f.setFollowing(quemE);
        f.setStatus(status);
        kit.save(FollowRepository.class, f);
    }

    static int status(Runnable r) {
        try {
            r.run();
        } catch (ApiException e) {
            return e.status();
        }
        return 0;
    }

    static String codigo(Runnable r) {
        try {
            r.run();
        } catch (ApiException e) {
            return e.code();
        }
        return null;
    }
}
