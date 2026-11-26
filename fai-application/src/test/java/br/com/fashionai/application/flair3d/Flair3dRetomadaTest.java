package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Continuar partida" (repositórios em memória): a partida que não fechou volta como a abertura a devolveu e no ponto
 * em que parou — a investigação no último passo, a rodada em etapas na etapa da vez, o deck já escolhido —, refeita da
 * semente e do que foi gravado. Partida fechada e partida de outra pessoa não voltam.
 */
class Flair3dRetomadaTest {
    private Kit kit;
    private Flair3dNucleoService service;
    private Flair3dRetomada retomada;
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
    }

    FlairCardInstance carta(String posicao, String... etiquetas) {
        return kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(ana.id(), posicao, etiquetas));
    }

    UUID abrir(String nucleo, String rodada, FlairCardInstance... deck) {
        List<UUID> ids = Arrays.stream(deck).map(FlairCardInstance::getId).toList();
        return (UUID) service.abrir(ana, nucleo, new Flair3dNucleoService.AbrirPartida(ids, null, rodada)).get("id");
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> partida(Map<String, Object> r) {
        return (Map<String, Object>) r.get("partida");
    }

    @Test
    void semPartidaAbertaNaoHaOQueContinuar() {
        assertThat(retomada.emAndamento(ana, "PASSARELA")).isEmpty();
    }

    @Test
    void aSessaoDeFotosDoRoadToGloryVoltaNoPedidoDaFotografaEFechaComACartaDaCor() {
        FlairCardInstance sup = carta("SUP", "occasion:work");
        FlairCardInstance cal = carta("CAL", "sub:boots", "occasion:formal");
        Map<String, FlairCardInstance> porCor = new java.util.LinkedHashMap<>();
        Map.of("Preto", "black", "Verde", "green", "Amarelo", "yellow", "Azul", "blue", "Vermelho", "red", "Branco", "white")
                .forEach((familia, cor) -> porCor.put(familia, carta("ACE", "color:" + cor)));
        UUID id = abrir("ROAD_TO_GLORY", "ENTREVISTA");
        Entrega look = Flair3dFixtures.comMaquiagem(new Entrega(Map.of("SUP", sup.getId(), "CAL", cal.getId()), null, null, null), "LABIOS", "NUDE", "FOSCO");
        assertThat(service.entregar(ana, id, look).status()).isEqualTo("EM_ACAO");

        Map<String, Object> r = retomada.emAndamento(ana, "ROAD_TO_GLORY").orElseThrow();
        assertThat(partida(r)).containsEntry("id", id).containsEntry("rodada", "ENTREVISTA").containsEntry("status", "EM_ACAO");
        Resultado espera = (Resultado) r.get("resultado");
        String pedida = (String) ((Map<?, ?>) espera.eventos().stream().filter(e -> e.codigo().equals("PEDIDO_DE_CENA")).findFirst().orElseThrow().valor()).get("familia");

        // sem deck: a carta da sessão é qualquer carta da pessoa fora do look; as 4 regras (100) e a luz (10) dão 100
        Resultado luz = service.acionar(ana, id, new Acionamento(porCor.get(pedida).getId(), null));
        // depois da luz, a execução no percurso até a foto
        assertThat(luz.status()).isEqualTo("EM_ACAO");
        Resultado fim = service.acionar(ana, id, Flair3dFixtures.perfeita(luz));
        assertThat(fim.status()).isEqualTo("ENTREGUE");
        assertThat(fim.pontos()).isEqualTo(100);
        assertThat(fim.eventos()).anyMatch(e -> e.codigo().equals("TETO"));
        assertThat(retomada.emAndamento(ana, "ROAD_TO_GLORY")).isEmpty();
    }

    @Test
    void oDeckJaEscolhidoVoltaParaAPreparacaoEAPartidaFechadaNao() {
        FlairCardInstance sup = carta("SUP", "occasion:party");
        FlairCardInstance inf = carta("INF");
        FlairCardInstance cal = carta("CAL");
        UUID id = abrir("PASSARELA", "TEMA_NOITE", sup, inf, cal);
        Map<String, Object> r = retomada.emAndamento(ana, "PASSARELA").orElseThrow();
        assertThat(partida(r)).containsEntry("id", id).containsEntry("rodada", "TEMA_NOITE").containsEntry("deck", List.of(sup.getId(), inf.getId(), cal.getId()));
        assertThat(r.get("resultado")).isNull();
        assertThat(r.get("tentativa")).isNull();
        assertThat(retomada.emAndamento(bia, "PASSARELA")).isEmpty();

        service.entregar(ana, id, new Entrega(Map.of("SUP", sup.getId()), null, null, null));
        // a jogada de cena espera a carta e depois a execução: a partida ainda volta; seguir nas duas a fecha
        assertThat(partida(retomada.emAndamento(ana, "PASSARELA").orElseThrow())).containsEntry("status", "EM_ACAO");
        service.acionar(ana, id, Acionamento.NENHUM);
        assertThat(partida(retomada.emAndamento(ana, "PASSARELA").orElseThrow())).containsEntry("status", "EM_ACAO");
        service.acionar(ana, id, Acionamento.NENHUM);
        assertThat(retomada.emAndamento(ana, "PASSARELA")).isEmpty();
    }

    @Test
    void aInvestigacaoVoltaNoUltimoPassoComOLookVestido() {
        FlairCardInstance sup = carta("SUP", "color:black");
        FlairCardInstance ace = carta("ACE", "color:emerald");
        UUID id = abrir("FASHION_DETECTIVE", "COLECAO_MARE", sup, ace);
        Entrega look = new Entrega(Map.of("SUP", sup.getId()), null, null, null);
        assertThat(service.entregar(ana, id, look).status()).isEqualTo("EM_ACAO");
        Resultado depois = service.acionar(ana, id, new Acionamento(null, null, "ESPERAR"));

        Map<String, Object> r = retomada.emAndamento(ana, "FASHION_DETECTIVE").orElseThrow();
        assertThat(partida(r)).containsEntry("id", id).containsEntry("status", "EM_ACAO").containsEntry("rodada", "COLECAO_MARE");
        assertThat(r.get("vestidas")).isEqualTo(Map.of("SUP", sup.getId()));
        assertThat(((Resultado) r.get("resultado")).eventos()).isEqualTo(depois.eventos());
        assertThat(r.get("tentativa")).isNull();
    }

    @Test
    void aRodadaEmEtapasVoltaNaEtapaDaVez() {
        FlairCardInstance sup = carta("SUP", "color:blue");
        FlairCardInstance inf = carta("INF", "color:blue");
        FlairCardInstance cal = carta("CAL");
        UUID id = abrir("BATALHA_LOOKS", "BATALHA_DE_3_RODADAS", sup, inf, cal);
        Resultado primeira = service.entregar(ana, id, new Entrega(Map.of("SUP", sup.getId(), "INF", inf.getId()), null, null, null));
        assertThat(primeira.status()).isEqualTo("ABERTA");

        Map<String, Object> r = retomada.emAndamento(ana, "BATALHA_LOOKS").orElseThrow();
        assertThat(partida(r)).containsEntry("id", id);
        assertThat(r.get("tentativa")).isEqualTo(primeira);
        assertThat(r.get("resultado")).isNull();
    }
}
