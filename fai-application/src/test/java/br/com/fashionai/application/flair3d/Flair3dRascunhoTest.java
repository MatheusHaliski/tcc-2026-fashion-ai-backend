package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * Salvamento (auditoria de 15/11/2026): o look em montagem fica no servidor e volta com a partida; a retomada diz o que
 * está guardado e quando; e nos dez jogos auditados quem sai no meio da preparação volta à mesma partida, com o mesmo
 * deck, a mesma rodada e as mesmas peças nas vagas.
 */
class Flair3dRascunhoTest {
    private Kit kit;
    private Flair3dNucleoService service;
    private Flair3dRetomada retomada;
    private Flair3dRascunho rascunho;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        kit.real(Flair3dCartas.class);
        service = kit.build(Flair3dNucleoService.class);
        retomada = new Flair3dRetomada(kit.dep(Flair3dMatchRepository.class), service);
        rascunho = new Flair3dRascunho(kit.dep(Flair3dMatchRepository.class), service);
    }

    FlairCardInstance carta(String posicao, String... etiquetas) {
        return kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(ana.id(), posicao, etiquetas));
    }

    UUID abrir(String nucleo, String rodada, FlairCardInstance... deck) {
        List<UUID> ids = java.util.Arrays.stream(deck).map(FlairCardInstance::getId).toList();
        return (UUID) service.abrir(ana, nucleo, new Flair3dNucleoService.AbrirPartida(ids, null, rodada)).get("id");
    }

    ApiException erro(Runnable r) {
        return catchThrowableOfType(ApiException.class, r::run);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> mapa(Object o) {
        return (Map<String, Object>) o;
    }

    @Test
    void oLookEmMontagemVoltaComAPartidaEATelaSabeOQueFoiSalvo() {
        FlairCardInstance sup = carta("SUP");
        FlairCardInstance inf = carta("INF");
        FlairCardInstance cal = carta("CAL");
        UUID id = abrir("PASSARELA", "TEMA_SURPRESA", sup, inf, cal);
        Map<String, Object> antes = retomada.emAndamento(ana, "PASSARELA").orElseThrow();
        assertThat(antes.get("rascunho")).isNull();
        assertThat(mapa(antes.get("salvo"))).containsEntry("deck", 3).containsEntry("look", 0).containsEntry("rascunho", 0);

        Entrega look = new Entrega(Map.of("SUP", sup.getId(), "CAL", cal.getId()), null, null, null);
        Map<String, Object> salvo = rascunho.guardar(ana, id, look);
        assertThat(salvo).containsEntry("pecas", 2).containsKey("salvoEm");

        Map<String, Object> r = retomada.emAndamento(ana, "PASSARELA").orElseThrow();
        assertThat(((Entrega) r.get("rascunho")).cartas()).isEqualTo(look.cartas());
        assertThat(mapa(r.get("salvo"))).containsEntry("deck", 3).containsEntry("rascunho", 2).containsEntry("etapas", 0).containsEntry("passos", 0);
        assertThat(r.get("atualizadaEm")).isNotNull();
        assertThat(mapa(r.get("partida"))).containsEntry("id", id).containsEntry("rodada", "TEMA_SURPRESA");
        // guardar o rascunho não conta tentativa nem fecha a partida
        Flair3dMatch m = kit.dep(Flair3dMatchRepository.class).findById(id).orElseThrow();
        assertThat(m.getStatus()).isEqualTo(Flair3dMatch.ABERTA);
        assertThat(Andamento.ler(m.getEstadoJson()).tentativas()).isZero();
        assertThat(m.getEntregaJson()).isNull();

        // look vazio apaga o rascunho
        rascunho.guardar(ana, id, new Entrega(null, null, null, null));
        assertThat(retomada.emAndamento(ana, "PASSARELA").orElseThrow().get("rascunho")).isNull();
    }

    @Test
    void soODonoGuardaSoComCartaDoDeckESoComAPartidaAberta() {
        FlairCardInstance sup = carta("SUP");
        FlairCardInstance cal = carta("CAL");
        FlairCardInstance fora = carta("INF");
        UUID id = abrir("PASSARELA", "TEMA_SURPRESA", sup, carta("INF"), cal);
        Entrega look = new Entrega(Map.of("SUP", sup.getId()), null, null, null);
        assertThat(erro(() -> rascunho.guardar(bia, id, look)).status()).isEqualTo(403);
        assertThat(erro(() -> rascunho.guardar(ana, UUID.randomUUID(), look)).status()).isEqualTo(404);
        assertThat(erro(() -> rascunho.guardar(ana, id, new Entrega(Map.of("INF", fora.getId()), null, null, null))).status()).isEqualTo(422);

        rascunho.guardar(ana, id, look);
        Resultado r = service.entregar(ana, id, look);
        // a entrega descarta o rascunho: o servidor já tem o look entregue
        Flair3dMatch m = kit.dep(Flair3dMatchRepository.class).findById(id).orElseThrow();
        assertThat(Andamento.ler(m.getEstadoJson()).rascunho()).isNull();
        while (!r.fecha()) {
            assertThat(erro(() -> rascunho.guardar(ana, id, look)).status()).isEqualTo(409);
            r = service.acionar(ana, id, Acionamento.NENHUM);
        }
        assertThat(erro(() -> rascunho.guardar(ana, id, look)).status()).isEqualTo(409);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PASSARELA", "DRESS_FIGHTER", "DRESS_THE_STAR", "PERSONAGEM_FILME", "FASHION_DETECTIVE", "BOUTIQUE_3D",
            "LABIRINTO", "AROUND_THE_WORLD", "FASHION_SPORTS", "BATALHA_LOOKS"})
    void nosDezJogosQuemSaiNaPreparacaoVoltaAMesmaPartidaComAsPecasNasVagas(String nucleo) {
        FlairCardInstance sup = carta("SUP", "color:blue");
        FlairCardInstance inf = carta("INF", "color:blue");
        FlairCardInstance cal = carta("CAL", "color:blue");
        FlairCardInstance ace = carta("ACE", "color:blue");
        String primeira = Flair3dNucleoService.nucleo(nucleo).definicao().rodadas().get(0).codigo();
        UUID id = abrir(nucleo, primeira, sup, inf, cal, ace);
        Entrega look = new Entrega(Map.of("SUP", sup.getId(), "INF", inf.getId()), null, null, null);
        rascunho.guardar(ana, id, look);

        Map<String, Object> r = retomada.emAndamento(ana, nucleo).orElseThrow();
        assertThat(mapa(r.get("partida"))).containsEntry("id", id).containsEntry("rodada", primeira).containsEntry("status", "ABERTA")
                .containsEntry("deck", List.of(sup.getId(), inf.getId(), cal.getId(), ace.getId()));
        assertThat(((Entrega) r.get("rascunho")).cartas()).isEqualTo(look.cartas());
        assertThat(mapa(r.get("salvo"))).containsEntry("deck", 4).containsEntry("rascunho", 2);
        assertThat(retomada.emAndamento(bia, nucleo)).isEmpty();

        // depois da entrega a retomada volta no ponto em que a partida ficou, com o look entregue (ou não volta: fechou)
        Resultado entregue = service.entregar(ana, id, new Entrega(Map.of("SUP", sup.getId(), "INF", inf.getId(), "CAL", cal.getId()), null, null, null));
        if (entregue.fecha()) {
            assertThat(retomada.emAndamento(ana, nucleo)).isEmpty();
        } else {
            Map<String, Object> depois = retomada.emAndamento(ana, nucleo).orElseThrow();
            assertThat(mapa(depois.get("partida"))).containsEntry("id", id).containsEntry("status", entregue.status());
            assertThat(mapa(depois.get("vestidas"))).hasSize(3);
            assertThat(mapa(depois.get("salvo"))).containsEntry("look", 3);
            assertThat(depois.get("rascunho")).isNull();
        }
    }
}
