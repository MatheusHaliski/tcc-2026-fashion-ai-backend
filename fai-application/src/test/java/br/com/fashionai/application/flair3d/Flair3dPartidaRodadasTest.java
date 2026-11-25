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

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * FLAIR 3D — a rodada no serviço (repositórios em memória): a partida guarda a rodada escolhida, devolve o que o jogo
 * revela ao entrar, recusa rodada que o jogo não tem, confere as zonas e as opções da rodada, anda em etapas com a
 * partida ABERTA e nunca gasta o sorteio na prévia.
 */
class Flair3dPartidaRodadasTest {
    private Kit kit;
    private Flair3dNucleoService service;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        kit.real(Flair3dCartas.class);
        service = kit.build(Flair3dNucleoService.class);
    }

    FlairCardInstance carta(String posicao, String... etiquetas) {
        return kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(ana.id(), posicao, etiquetas));
    }

    Map<String, Object> abrir(String nucleo, String rodada, FlairCardInstance... deck) {
        List<UUID> ids = Arrays.stream(deck).map(FlairCardInstance::getId).toList();
        return service.abrir(ana, nucleo, new Flair3dNucleoService.AbrirPartida(ids, null, rodada));
    }

    static Entrega vestir(String resposta, FlairCardInstance... cartas) {
        Map<String, UUID> m = new LinkedHashMap<>();
        for (FlairCardInstance c : cartas) {
            m.put(c.getPosition(), c.getId());
        }
        return new Entrega(m, null, null, resposta);
    }

    Flair3dMatch partida(UUID id) {
        return kit.dep(Flair3dMatchRepository.class).findById(id).orElseThrow();
    }

    ApiException erro(Runnable r) {
        return catchThrowableOfType(ApiException.class, r::run);
    }

    @Test
    void partidaGuardaARodadaRevelaOTemaERecusaRodadaQueOJogoNaoTem() {
        FlairCardInstance sup = carta("SUP", "style:classic", "occasion:party");
        FlairCardInstance inf = carta("INF");
        FlairCardInstance cal = carta("CAL");
        ApiException invalida = erro(() -> abrir("PASSARELA", "TEMA_QUE_NAO_EXISTE", sup, inf, cal));
        assertThat(invalida.status()).isEqualTo(422);
        assertThat(invalida.code()).isEqualTo("RODADA_INVALIDA");

        Map<String, Object> aberta = abrir("PASSARELA", "TEMA_SURPRESA", sup, inf, cal);
        UUID id = (UUID) aberta.get("id");
        assertThat(aberta.get("rodada")).isEqualTo("TEMA_SURPRESA");
        @SuppressWarnings("unchecked")
        String tema = (String) ((Map<String, Object>) aberta.get("abertura")).get("tema");
        assertThat(tema).startsWith("TEMA_");
        assertThat(Andamento.ler(partida(id).getEstadoJson()).rodada()).isEqualTo("TEMA_SURPRESA");

        Resultado previa1 = service.previa(ana, id, vestir(null, sup, inf, cal));
        Resultado previa2 = service.previa(ana, id, vestir(null, sup, inf, cal));
        assertThat(previa2).isEqualTo(previa1);
        // a prévia não revela a sala do tema: no máximo o que o look soma (regra peça-recurso; tema sorteado sem ponto, nada)
        assertThat(previa1.eventos()).extracting(Resultado.Evento::codigo).isSubsetOf("LOOK_ATRIBUTOS", "RECURSO_DO_JOGO", "PERFIL_DO_LOOK");
        assertThat(Andamento.ler(partida(id).getEstadoJson()).tentativas()).isZero();
        service.entregar(ana, id, vestir(null, sup, inf, cal));
        Resultado r = service.acionar(ana, id, Flair3dFixtures.perfeita(service.acionar(ana, id, Acionamento.NENHUM)));
        // a nota da prévia mais a execução perfeita no percurso
        assertThat(r.pontos()).isEqualTo(Math.min(100, previa1.pontos() + Flair3dExecucao.TETO));
        assertThat(r.eventos().get(0)).isEqualTo(new Resultado.Evento("TEMA", tema));
        assertThat(r.status()).isEqualTo("ENTREGUE");

        Map<String, Object> semRodada = abrir("PASSARELA", null, sup, inf, cal);
        assertThat(semRodada.get("rodada")).isNull();
        assertThat(partida((UUID) semRodada.get("id")).getEstadoJson()).isNull();
    }

    @Test
    void selosValemParaARodadaDaPartidaESoODonoConsultaAPartida() {
        FlairCardInstance sup = carta("SUP", "style:classic");
        FlairCardInstance inf = carta("INF");
        FlairCardInstance cal = carta("CAL");
        List<UUID> ids = List.of(sup.getId());
        Map<String, Object> naTelaDoDeck = service.efeitos(ana, "PASSARELA", new Flair3dNucleoService.PedidoEfeitos(ids, "TEMA_SURPRESA", null));
        assertThat(naTelaDoDeck.toString()).contains("TEMA_SURPRESA");
        UUID id = (UUID) abrir("PASSARELA", "TEMA_CLASSICO", sup, inf, cal).get("id");
        Map<String, Object> naPartida = service.efeitos(ana, "PASSARELA", new Flair3dNucleoService.PedidoEfeitos(ids, null, id));
        assertThat(naPartida.toString()).contains("NO_TEMA");
        assertThat(erro(() -> service.efeitos(bia, "PASSARELA", new Flair3dNucleoService.PedidoEfeitos(List.of(), null, id))).status()).isEqualTo(404);
        assertThat(service.efeitos(ana, "PASSARELA", new Flair3dNucleoService.PedidoEfeitos(ids)).toString()).contains("MARCA_NAO_BR");
    }

    @Test
    void rodadaEmEtapasSegueAbertaAteAUltimaEAPreviaNaoAvanca() {
        FlairCardInstance sup = carta("SUP", "occasion:work", "color:blue", "style:classic");
        FlairCardInstance inf = carta("INF", "occasion:work");
        Map<String, Object> aberta = abrir("BOUTIQUE_3D", "PERSONAL_STYLIST", sup, inf);
        UUID id = (UUID) aberta.get("id");
        @SuppressWarnings("unchecked")
        Map<String, Object> etapa = (Map<String, Object>) ((Map<String, Object>) aberta.get("abertura")).get("etapa");
        assertThat(etapa).containsEntry("etapa", 1).containsEntry("total", 3);
        Resultado previa = service.previa(ana, id, vestir(null, sup, inf));
        assertThat(previa.status()).isEqualTo("ABERTA");
        Resultado primeira = service.entregar(ana, id, vestir(null, sup, inf));
        assertThat(primeira.status()).isEqualTo("ABERTA");
        assertThat(primeira.regras()).isEqualTo(previa.regras());
        assertThat(partida(id).getStatus()).isEqualTo("ABERTA");
        service.previa(ana, id, vestir(null, sup));
        assertThat(Andamento.ler(partida(id).getEstadoJson()).anteriores()).isEmpty();
        Resultado segunda = service.entregar(ana, id, vestir(null, sup, inf));
        assertThat(segunda.status()).isEqualTo("ABERTA");
        assertThat(Andamento.ler(partida(id).getEstadoJson()).anteriores()).hasSize(1);
        assertThat(service.entregar(ana, id, vestir(null, sup, inf)).status()).isEqualTo("EM_ACAO");
        Resultado fim = service.acionar(ana, id, Flair3dFixtures.perfeita(service.acionar(ana, id, Acionamento.NENHUM)));
        assertThat(fim.status()).isEqualTo("ENTREGUE");
        // as três regras da etapa, a da execução no percurso e as duas da regra peça-recurso
        assertThat(fim.regras()).hasSize(6);
        assertThat(fim.regras()).extracting(Resultado.RegraResultado::codigo).endsWith("EXECUCAO", "LOOK_ATRIBUTOS", "RECURSO_DO_JOGO");
        assertThat(partida(id).getPontos()).isEqualTo(fim.pontos());
        assertThat(erro(() -> service.entregar(ana, id, vestir(null, sup))).status()).isEqualTo(409);
    }

    @Test
    void respostaDeCadaEtapaFicaGuardadaEAsZonasDaRodadaSaoAsQueValem() {
        FlairCardInstance festa = carta("SUP", "occasion:party");
        FlairCardInstance festa2 = carta("INF", "occasion:party");
        FlairCardInstance trabalho = carta("CAL", "occasion:work");
        UUID id = (UUID) abrir("LABIRINTO", "TRES_PORTAS", festa, festa2, trabalho).get("id");
        Resultado sala1 = service.entregar(ana, id, vestir("PORTA_MEDIA", festa, festa2));
        assertThat(sala1.resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        service.entregar(ana, id, vestir("PORTA_FACIL", trabalho));
        assertThat(Andamento.ler(partida(id).getEstadoJson()).anteriores()).extracting(Andamento.Etapa::resposta).containsExactly("PORTA_MEDIA");

        UUID tenis = (UUID) service.abrir(ana, "PILOTO_FAVORITO", new Flair3dNucleoService.AbrirPartida(List.of(), null, "TENIS_DOS_SONHOS")).get("id");
        Entrega doTenis = Flair3dFixtures.zonas(null, "CABEDAL=#1E4FBF/ESPELHADO", "SOLA=#F5F4F0", "CADARCO=#F5F4F0");
        assertThat(service.acionar(ana, tenis, Flair3dFixtures.perfeita(service.entregar(ana, tenis, doTenis))).pontos()).isEqualTo(100);
        UUID capacete = (UUID) service.abrir(ana, "PILOTO_FAVORITO", new Flair3dNucleoService.AbrirPartida(List.of(), null)).get("id");
        assertThat(erro(() -> service.entregar(ana, capacete, doTenis)).code()).isEqualTo("ENTREGA_INVALIDA");
    }
}
