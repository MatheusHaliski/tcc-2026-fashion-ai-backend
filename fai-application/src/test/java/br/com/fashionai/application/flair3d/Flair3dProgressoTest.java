package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * A campanha de cada jogo (auditoria de 15/11/2026, mudança 9), com repositórios em memória: a primeira rodada sempre
 * aberta, a seguinte abre só com a anterior vencida, as estrelas somam por rodada e no jogo, o progresso é de cada
 * pessoa e de cada jogo, e o ponto da história (abertura, transição, fecho) segue o resultado gravado.
 */
class Flair3dProgressoTest {
    private Kit kit;
    private Flair3dNucleoService service;
    private Flair3dProgresso progresso;
    private CurrentUser ana;
    private CurrentUser bia;
    private Instant relogio = Instant.parse("2026-11-19T10:00:00Z");

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        kit.real(Flair3dCartas.class);
        service = kit.build(Flair3dNucleoService.class);
        progresso = new Flair3dProgresso(kit.dep(Flair3dMatchRepository.class));
    }

    /** Uma partida já fechada, como a entrega a grava (cada uma um minuto depois da anterior). */
    Flair3dMatch fechada(CurrentUser de, String nucleo, String rodada, int pontos, String resultado, String resposta) {
        relogio = relogio.plusSeconds(60);
        Flair3dMatch m = new Flair3dMatch();
        m.setUserId(de.id());
        m.setNucleo(nucleo);
        m.setStatus(Flair3dMatch.ENTREGUE);
        m.setSemente(7L);
        m.setEstadoJson(rodada == null ? null : Json.write(Andamento.naRodada(rodada).proximaTentativa()));
        m.setEntregaJson(Json.write(new Entrega(null, null, null, resposta)));
        m.setResultadoJson(Json.write(Resultado.of(pontos, resultado, List.of(), List.of())));
        m.setPontos(pontos);
        m.setEstrelas(Resultado.estrelas(pontos));
        m = kit.save(Flair3dMatchRepository.class, m);
        m.setUpdatedAt(relogio);
        return m;
    }

    Flair3dCampanha.Etapa etapa(Flair3dCampanha.Progresso p, String codigo) {
        return p.rodadas().stream().filter(e -> e.codigo().equals(codigo)).findFirst().orElseThrow();
    }

    ApiException erro(Runnable r) {
        return catchThrowableOfType(ApiException.class, r::run);
    }

    @Test
    void quemNuncaJogouTemSoAPrimeiraRodadaAbertaEAHistoriaNaAbertura() {
        Flair3dCampanha.Progresso p = progresso.doJogo(ana, "PASSARELA");
        assertThat(p.rodadas()).extracting(Flair3dCampanha.Etapa::codigo)
                .containsExactly("TEMA_SURPRESA", "TEMA_BRASIL", "TEMA_NOITE", "TEMA_MONOCROMATICO", "TEMA_CLASSICO");
        assertThat(p.rodadas()).extracting(Flair3dCampanha.Etapa::aberta).containsExactly(true, false, false, false, false);
        assertThat(etapa(p, "TEMA_BRASIL").abreCom()).isEqualTo("TEMA_SURPRESA");
        assertThat(p.estrelas()).isZero();
        assertThat(p.maximo()).isEqualTo(15);
        assertThat(p.vencidas()).isZero();
        assertThat(p.ultima()).isNull();
        assertThat(p.enredo()).isEqualTo(new Flair3dCampanha.Enredo("ABERTURA", "TEMA_SURPRESA"));
    }

    @Test
    void vencerAbreASeguinteSomaEstrelasEATransicaoCitaAUltimaPartida() {
        fechada(ana, "PASSARELA", "TEMA_SURPRESA", 40, "REPROVADO", null);
        Flair3dCampanha.Progresso perdeu = progresso.doJogo(ana, "PASSARELA");
        assertThat(etapa(perdeu, "TEMA_BRASIL").aberta()).isFalse();
        assertThat(perdeu.ultima().venceu()).isFalse();
        assertThat(perdeu.ultima().pontos()).isEqualTo(40);
        assertThat(perdeu.enredo()).isEqualTo(new Flair3dCampanha.Enredo("TRANSICAO", "TEMA_SURPRESA"));

        fechada(ana, "PASSARELA", "TEMA_SURPRESA", 86, "APROVADO", null);
        Flair3dCampanha.Progresso p = progresso.doJogo(ana, "PASSARELA");
        Flair3dCampanha.Etapa surpresa = etapa(p, "TEMA_SURPRESA");
        assertThat(surpresa.vencida()).isTrue();
        assertThat(surpresa.estrelas()).isEqualTo(2);
        assertThat(surpresa.pontos()).isEqualTo(86);
        assertThat(surpresa.partidas()).isEqualTo(2);
        assertThat(surpresa.vencidaEm()).isNotNull();
        assertThat(etapa(p, "TEMA_BRASIL").aberta()).isTrue();
        assertThat(etapa(p, "TEMA_NOITE").aberta()).isFalse();
        assertThat(p.estrelas()).isEqualTo(2);
        assertThat(p.vencidas()).isEqualTo(1);
        assertThat(p.ultima()).extracting("rodada", "pontos", "estrelas", "resultado", "venceu")
                .containsExactly("TEMA_SURPRESA", 86, 2, "APROVADO", true);
        assertThat(p.enredo()).isEqualTo(new Flair3dCampanha.Enredo("TRANSICAO", "TEMA_BRASIL"));

        // a pior partida depois não tira a estrela nem fecha o que já abriu; a transição passa a citar a derrota
        fechada(ana, "PASSARELA", "TEMA_BRASIL", 0, "REPROVADO", null);
        Flair3dCampanha.Progresso depois = progresso.doJogo(ana, "PASSARELA");
        assertThat(depois.estrelas()).isEqualTo(2);
        assertThat(depois.ultima().rodada()).isEqualTo("TEMA_BRASIL");
        assertThat(depois.ultima().venceu()).isFalse();
        assertThat(etapa(depois, "TEMA_NOITE").aberta()).isFalse();
    }

    @Test
    void oProgressoEDeCadaPessoaEDeCadaJogo() {
        fechada(ana, "PASSARELA", "TEMA_SURPRESA", 100, "APROVADO", null);
        assertThat(progresso.doJogo(bia, "PASSARELA").vencidas()).isZero();
        assertThat(progresso.doJogo(ana, "DRESS_FIGHTER").vencidas()).isZero();
        assertThat(progresso.doJogo(ana, "PASSARELA").estrelas()).isEqualTo(3);
    }

    @Test
    void aRodadaFechadaNaoAbrePartidaEAbreDepoisDaVitoria() {
        ApiException e = erro(() -> progresso.conferirAberta(ana, "DRESS_FIGHTER", "ARENA_VELOZ"));
        assertThat(e.status()).isEqualTo(422);
        assertThat(e.code()).isEqualTo("RODADA_BLOQUEADA");
        assertThat(e.details()).containsEntry("rodada", "ARENA_VELOZ").containsEntry("abreCom", "VENCER_2_DE_3");
        progresso.conferirAberta(ana, "DRESS_FIGHTER", "VENCER_2_DE_3");
        progresso.conferirAberta(ana, "DRESS_FIGHTER", null);

        // derrota com um round ganho (50 pontos) não abre; a vitória abre a arena seguinte, só para quem venceu
        fechada(ana, "DRESS_FIGHTER", "VENCER_2_DE_3", 50, "DERROTA", null);
        assertThat(erro(() -> progresso.conferirAberta(ana, "DRESS_FIGHTER", "ARENA_VELOZ")).code()).isEqualTo("RODADA_BLOQUEADA");
        fechada(ana, "DRESS_FIGHTER", "VENCER_2_DE_3", 100, "VITORIA", null);
        progresso.conferirAberta(ana, "DRESS_FIGHTER", "ARENA_VELOZ");
        assertThat(erro(() -> progresso.conferirAberta(ana, "DRESS_FIGHTER", "ARENA_BLINDADA")).code()).isEqualTo("RODADA_BLOQUEADA");
        assertThat(erro(() -> progresso.conferirAberta(bia, "DRESS_FIGHTER", "ARENA_VELOZ")).code()).isEqualTo("RODADA_BLOQUEADA");
    }

    @Test
    void partidaAntigaSemRodadaContaNoObjetivoMaisSimplesEDerrotaComEstrelaNaoVence() {
        fechada(ana, "BATALHA_LOOKS", null, 100, "VITORIA", null);
        assertThat(etapa(progresso.doJogo(ana, "BATALHA_LOOKS"), "MONOCROMATICO_AZUL").vencida()).isTrue();
        fechada(bia, "BATALHA_LOOKS", "BATALHA_DE_3_RODADAS", 75, "DERROTA", null);
        Flair3dCampanha.Etapa batalha = etapa(progresso.doJogo(bia, "BATALHA_LOOKS"), "BATALHA_DE_3_RODADAS");
        assertThat(batalha.vencida()).isFalse();
        assertThat(batalha.estrelas()).isEqualTo(1);
    }

    @Test
    void comTodasAsRodadasVencidasAHistoriaFecha() {
        for (String rodada : List.of("ESTRELA_POP_2000", "MODO_STYLIST", "LOOK_RELAMPAGO")) {
            assertThat(progresso.doJogo(ana, "DRESS_THE_STAR").completo()).isFalse();
            progresso.conferirAberta(ana, "DRESS_THE_STAR", rodada);
            fechada(ana, "DRESS_THE_STAR", rodada, 100, "APROVADO", null);
        }
        Flair3dCampanha.Progresso p = progresso.doJogo(ana, "DRESS_THE_STAR");
        assertThat(p.completo()).isTrue();
        assertThat(p.estrelas()).isEqualTo(9).isEqualTo(p.maximo());
        assertThat(p.enredo()).isEqualTo(new Flair3dCampanha.Enredo("FECHO", null));
    }

    @Test
    void noFashionSportsATrilhaSaoAsModalidadesTodasAbertasEEmpateNaoVence() {
        fechada(ana, "FASHION_SPORTS", null, 60, "EMPATE", "FUTEBOL");
        fechada(ana, "FASHION_SPORTS", null, 100, "VITORIA", "BASQUETE");
        Flair3dCampanha.Progresso p = progresso.doJogo(ana, "FASHION_SPORTS");
        assertThat(p.porResposta()).isTrue();
        assertThat(p.emSequencia()).isFalse();
        assertThat(p.total()).isEqualTo(6);
        assertThat(p.rodadas()).allMatch(Flair3dCampanha.Etapa::aberta);
        assertThat(etapa(p, "FUTEBOL").vencida()).isFalse();
        assertThat(etapa(p, "FUTEBOL").estrelas()).isEqualTo(1);
        assertThat(etapa(p, "BASQUETE").vencida()).isTrue();
        assertThat(p.estrelas()).isEqualTo(4);
        progresso.conferirAberta(ana, "FASHION_SPORTS", null);
    }

    @Test
    void jogoForaDaSequenciaRecebeAsMarcasComTodasAsRodadasAbertas() {
        Flair3dCampanha.Progresso p = progresso.doJogo(ana, "ROAD_TO_GLORY");
        assertThat(p.emSequencia()).isFalse();
        assertThat(p.rodadas()).isNotEmpty().allMatch(Flair3dCampanha.Etapa::aberta);
        assertThat(erro(() -> progresso.doJogo(ana, "NAO_EXISTE")).status()).isEqualTo(404);
    }

    @Test
    void aPartidaJogadaDeVerdadeMarcaARodadaEAPartidaEmAndamentoNaoConta() {
        Map<String, UUID> look = new LinkedHashMap<>();
        for (String vaga : List.of("SUP", "INF", "CAL", "ACE")) {
            FlairCardInstance c = kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(ana.id(), vaga, "style:y2k", "color:pink"));
            look.put(vaga, c.getId());
        }
        List<UUID> deck = List.copyOf(look.values());
        UUID id = (UUID) service.abrir(ana, "DRESS_THE_STAR", new Flair3dNucleoService.AbrirPartida(deck, null, "ESTRELA_POP_2000")).get("id");
        assertThat(progresso.doJogo(ana, "DRESS_THE_STAR").ultima()).isNull();

        Resultado r = service.entregar(ana, id, new Entrega(look, null, null, null));
        while (!r.fecha()) {
            r = service.acionar(ana, id, Acionamento.NENHUM);
        }
        Flair3dCampanha.Progresso p = progresso.doJogo(ana, "DRESS_THE_STAR");
        Flair3dCampanha.Etapa pop = etapa(p, "ESTRELA_POP_2000");
        assertThat(pop.pontos()).isEqualTo(r.pontos());
        assertThat(pop.estrelas()).isEqualTo(r.estrelas());
        assertThat(pop.vencida()).isEqualTo(r.estrelas() >= 1);
        assertThat(r.pontos()).isEqualTo(100);
        assertThat(etapa(p, "MODO_STYLIST").aberta()).isTrue();
    }
}
