package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Peça usada como recurso: só o servidor decide. A carta tem de estar no deck da partida e ainda ter uso; o mesmo
 * pedido repetido não gasta de novo; partida de outra pessoa é 403 e partida fechada, 409.
 */
class Flair3dRecursoUsoTest {
    private Kit kit;
    private Flair3dNucleoService nucleos;
    private Flair3dRecursoUso uso;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        kit.real(Flair3dCartas.class);
        nucleos = kit.build(Flair3dNucleoService.class);
        uso = kit.build(Flair3dRecursoUso.class);
    }

    private FlairCardInstance carta(CurrentUser dono, String posicao, String... etiquetas) {
        return kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(dono.id(), posicao, etiquetas));
    }

    /** A Passarela pede SUP, INF e CAL no deck: a carta dada mais as que faltam. */
    private UUID abrir(FlairCardInstance principal) {
        List<FlairCardInstance> deck = new java.util.ArrayList<>(List.of(principal));
        for (String vaga : List.of("SUP", "INF", "CAL")) {
            if (!vaga.equals(principal.getPosition())) deck.add(carta(ana, vaga));
        }
        List<UUID> ids = deck.stream().map(FlairCardInstance::getId).toList();
        return (UUID) nucleos.abrir(ana, "PASSARELA", new Flair3dNucleoService.AbrirPartida(ids, null)).get("id");
    }

    private static int status(Runnable r) {
        try {
            r.run();
        } catch (ApiException e) {
            return e.status();
        }
        return 0;
    }

    @Test
    @SuppressWarnings("unchecked")
    void usarOBlazerEncheAVidaComAQuantidadeDaTabelaEUmaVezSo() {
        FlairCardInstance blazer = carta(ana, "SUP", "sub:blazer", "material:wool", "color:black", "tier:PRATA", "ovr:60");
        UUID partida = abrir(blazer);
        Map<String, Object> inicio = uso.estado(ana, partida);
        assertThat((Map<String, Integer>) inicio.get("recursos")).containsEntry("VIDA", 60).containsEntry("MOEDAS", 0);

        Map<String, Object> r = uso.usar(ana, partida, new Flair3dRecursoUso.PedidoDeUso(blazer.getId(), "toque-1"));
        Map<String, Object> u = (Map<String, Object>) r.get("uso");
        assertThat(u).containsEntry("recurso", "VIDA").containsEntry("quantidade", 25).containsEntry("antes", 60).containsEntry("depois", 85);
        assertThat((Map<String, Integer>) r.get("recursos")).containsEntry("VIDA", 85);
        assertThat((Map<String, Long>) r.get("usados")).containsEntry(blazer.getId().toString(), 1L);

        // o mesmo toque chegando de novo (rede lenta): mesma resposta, sem gastar
        assertThat(uso.usar(ana, partida, new Flair3dRecursoUso.PedidoDeUso(blazer.getId(), "toque-1"))).isEqualTo(r);
        // prata dá um uso por partida
        ApiException semUso = capturar(() -> uso.usar(ana, partida, new Flair3dRecursoUso.PedidoDeUso(blazer.getId(), "toque-2")));
        assertThat(semUso.status()).isEqualTo(422);
        assertThat(semUso.code()).isEqualTo("SEM_USOS");
        // o uso fica gravado no andamento da partida e passa para a próxima entrega
        Flair3dMatch m = kit.dep(Flair3dMatchRepository.class).findById(partida).orElseThrow();
        Andamento a = Andamento.ler(m.getEstadoJson());
        assertThat(a.usos()).hasSize(1);
        assertThat(a.proximaTentativa().usos()).hasSize(1);
    }

    @Test
    void cartaForaDoDeckDeOutraPessoaOuPartidaFechadaSaoRecusadas() {
        FlairCardInstance top = carta(ana, "SUP");
        FlairCardInstance fora = carta(ana, "INF");
        UUID partida = abrir(top);
        assertThat(capturar(() -> uso.usar(ana, partida, new Flair3dRecursoUso.PedidoDeUso(fora.getId(), "x"))).code()).isEqualTo("CARTA_FORA_DO_DECK");
        assertThat(status(() -> uso.usar(bia, partida, new Flair3dRecursoUso.PedidoDeUso(top.getId(), "y")))).isEqualTo(403);
        assertThat(status(() -> uso.usar(ana, partida, new Flair3dRecursoUso.PedidoDeUso(top.getId(), " ")))).isEqualTo(422);
        Flair3dMatch m = kit.dep(Flair3dMatchRepository.class).findById(partida).orElseThrow();
        m.setStatus(Flair3dMatch.ENTREGUE);
        assertThat(status(() -> uso.usar(ana, partida, new Flair3dRecursoUso.PedidoDeUso(top.getId(), "z")))).isEqualTo(409);
    }

    @Test
    void partidaAntigaSemUsosLeComoReservaInicial() {
        Andamento antigo = Andamento.ler("{\"tentativas\":1,\"acionamentos\":[]}");
        assertThat(antigo.usos()).isEmpty();
        assertThat(Flair3dRecursoEstado.de(antigo.usos())).isEqualTo(new java.util.EnumMap<>(Flair3dRecursoEstado.INICIAL));
        assertThat(Json.write(antigo)).contains("\"usos\":[]");
    }

    private static ApiException capturar(Runnable r) {
        try {
            r.run();
        } catch (ApiException e) {
            return e;
        }
        throw new AssertionError("esperava recusa");
    }
}
