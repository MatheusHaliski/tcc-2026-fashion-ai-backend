package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveAcusacao;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * A investigação do caso "A Coleção Maré" jogada passo a passo (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md):
 * cartas pela cor, portas, ajuda sem carta verde, bolso fora do cone, enigma com dica, acusação e determinismo.
 */
@SuppressWarnings("unchecked")
class DetetivePartidaTest {
    private final List<CbcRules.Card> look = List.of(Flair3dFixtures.card("SUP", "color:white", "occasion:formal"),
            Flair3dFixtures.card("INF", "color:black"), Flair3dFixtures.card("CAL", "color:black"));
    private final Contexto contexto;
    private final List<Acionamento> passos = new ArrayList<>();

    DetetivePartidaTest() {
        List<CbcRules.Card> todas = new ArrayList<>(look);
        for (String cor : List.of("emerald", "emerald", "emerald", "black", "black", "blue", "white", "yellow", "red")) {
            todas.add(Flair3dFixtures.card("ACE", "color:" + cor));
        }
        contexto = Flair3dFixtures.contexto(11, todas.toArray(CbcRules.Card[]::new));
    }

    private DetetivePartida agora() {
        return new DetetivePartida(contexto, look.stream().map(CbcRules.Card::id).toList()).jogar(passos);
    }

    private Map<String, Object> fazer(String alvo) {
        passos.add(new Acionamento(null, null, alvo));
        return agora().retrato();
    }

    /** Anda pelo caminho até o último ponto; se um vigia manda a pessoa de volta, espera um passo e recomeça. */
    private void chegar(String... caminho) {
        for (int tentativa = 0; tentativa < 30; tentativa++) {
            String alvo = caminho[caminho.length - 1];
            if (alvo.equals(agora().retrato().get("ponto"))) {
                return;
            }
            String aqui = (String) agora().retrato().get("ponto");
            int i = java.util.Arrays.asList(caminho).indexOf(aqui);
            String proximo = caminho[i + 1];
            try {
                fazer("IR:" + proximo);
            } catch (ApiException ex) {
                passos.remove(passos.size() - 1);
                fazer("ESPERAR");
            }
        }
        throw new AssertionError("não chegou a " + caminho[caminho.length - 1]);
    }

    /**
     * Joga a primeira carta da mão com a ação dada (ABRIR, FURTIVIDADE, DANO...); sem ela na mão, troca as outras cartas
     * (ação TROCAR, qualquer cor) até ela chegar. As cartas do teste têm ids aleatórios: a mão inicial muda a cada vez.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> comCarta(String acao, String alvo) {
        DetetiveMao mao = new DetetiveMao(contexto, look.stream().map(CbcRules.Card::id).toList());
        for (int i = 0; i < 10; i++) {
            List<UUID> naMao = ((List<String>) agora().retrato().get("mao")).stream().map(UUID::fromString).toList();
            UUID carta = naMao.stream().filter(id -> acao.equals(mao.acao(id))).findFirst().orElse(null);
            if (carta != null) {
                passos.add(new Acionamento(carta, null, alvo));
                return agora().retrato();
            }
            passos.add(new Acionamento(naMao.get(0), null, "TROCAR"));
        }
        throw new AssertionError("sem carta " + acao);
    }

    @Test
    void comecaNaEntradaComACutsceneSemAsRespostasDosEnigmasNoRetrato() {
        Map<String, Object> r = agora().retrato();
        assertThat(r).containsEntry("sala", "ENTRADA").containsEntry("vida", 3).containsEntry("cutscene", "ABERTURA:ENTRADA");
        assertThat((List<Object>) r.get("mao")).hasSize(DetetiveMao.TAMANHO);
        assertThat(Json.write(r)).doesNotContain("certa").doesNotContain("bolso\"");
    }

    @Test
    void andarSoAtePontoVizinhoEAcaoDeCorPedeACartaDaCor() {
        assertThat(catchThrowableOfType(() -> fazer("IR:portaSalao"), ApiException.class).status()).isEqualTo(422);
        passos.clear();
        fazer("IR:meio");
        fazer("IR:casacos");
        ApiException semCarta = catchThrowableOfType(() -> fazer("ABRIR:ARMARIO_DE_CASACOS"), ApiException.class);
        assertThat(semCarta.code()).isEqualTo("CARTA_DE_OUTRA_COR");
    }

    @Test
    void armarioComCartaVerdeDaAChave() {
        fazer("IR:meio");
        Map<String, Object> r = fazer("IR:casacos");
        if ("casacos".equals(r.get("ponto"))) {
            r = comCarta("ABRIR", "ABRIR:ARMARIO_DE_CASACOS");
            assertThat((List<Object>) r.get("chaves")).contains("K1");
        }
    }

    @Test
    void semCartaNenhumaAAjudaDaCasaLevaAtePassarelaEAAcusacaoSempreTermina() {
        chegar("tapete", "meio", "rua");
        fazer("PORTA:CLUBE");
        chegar("rua", "pista", "escada");
        Map<String, Object> r = fazer("AJUDA:ATELIE");
        assertThat(r).containsEntry("sala", "ATELIE").containsEntry("cutscene", "ABERTURA:ATELIE");
        chegar("escada", "meio", "portaPassarela");
        r = fazer("AJUDA:PASSARELA");
        assertThat(r).containsEntry("sala", "PASSARELA");
        assertThat(r.get("pistas").toString()).contains("P12");
        // quem corre direto para a passarela não acusa: a acusação abre com 6 pistas (ou com o tempo esgotado)
        assertThat(r).containsEntry("podeAcusar", false).containsEntry("pistasParaAcusar", 6);
        assertThat(catchThrowableOfType(() -> fazer("ACUSAR:2"), ApiException.class).status()).isEqualTo(422);
    }

    @Test
    void comSeisPistasAAcusacaoAbreEOSuspeitoErradoTemSegundaChance() {
        DetetiveEstado e = new DetetiveEstado();
        e.sala = "PASSARELA";
        for (String p : List.of("P1", "P2", "P3", "P4", "P5")) {
            e.pistas.put(p, true);
        }
        assertThat(e.podeAcusar()).isFalse();
        e.pistas.put("P12", true);
        assertThat(e.podeAcusar()).isTrue();
        DetetiveAcoes.fazer("ACUSAR", "4", e, null);
        assertThat(e.cutscene).isEqualTo("ALIBI:4");
        assertThat(e.fim).isNull();
        DetetiveAcoes.fazer("ACUSAR", "5", e, null);
        assertThat(e.fim).isEqualTo(FashionDetectiveAcusacao.Final.ERRADO_REVELA);
        // sem as pistas, só o relógio esgotado abre a acusação: nenhum caso fica sem fim
        DetetiveEstado tarde = new DetetiveEstado();
        tarde.tempo = DetetiveEstado.LIMITE_DE_TEMPO;
        assertThat(tarde.podeAcusar()).isTrue();
    }

    @Test
    void pecaUsadaComoVidaDevolveUmaMarcaDaliEmDianteSemPassarDaMaxima() {
        List<UUID> ids = look.stream().map(CbcRules.Card::id).toList();
        UUID carta = look.get(0).id();
        // vai até a porta do salão, na ronda do segurança, e fica parada até ser pega uma vez
        chegar("tapete", "meio", "portaSalao");
        for (int i = 0; i < 12 && (int) agora().retrato().get("vida") == 3; i++) {
            fazer("ESPERAR");
        }
        assertThat(agora().retrato()).containsEntry("vida", 2);
        List<Andamento.UsoDeRecurso> agoraMesmo = List.of(new Andamento.UsoDeRecurso(carta, "VIDA", 15, "u1", passos.size(), 0));
        assertThat(new DetetivePartida(contexto, ids).jogar(passos, agoraMesmo).retrato()).containsEntry("vida", 3);
        // o uso antes do primeiro passo não devolve o que ainda não se perdeu: a vida já estava cheia
        List<Andamento.UsoDeRecurso> cedo = List.of(new Andamento.UsoDeRecurso(carta, "VIDA", 15, "u1", 0, 0));
        assertThat(new DetetivePartida(contexto, ids).jogar(passos, cedo).retrato()).containsEntry("vida", 2);
    }

    @Test
    void bolsoDeRafaPorForaDoConeComCartaPretaDaAPistaSemAlarde() {
        fazer("IR:meio");
        fazer("IR:rua");
        fazer("PORTA:CLUBE");
        fazer("IR:pista");
        Map<String, Object> r = fazer("IR:cabine");
        assertThat(r).containsEntry("ponto", "cabine");
        r = comCarta("FURTIVIDADE", "BOLSO:RAFA");
        assertThat((List<Object>) r.get("avisos")).contains("BOLSO_OK:RAFA");
        assertThat(r.get("pistas").toString()).contains("P6");
    }

    @Test
    void enigmaErradoDaDicaECertoResolveASala() {
        Map<String, Object> r = fazer("ENIGMA:0");
        assertThat(r).containsEntry("dica", true);
        r = fazer("ENIGMA:1");
        assertThat((List<Object>) r.get("resolvidas")).contains("ENTRADA");
        assertThat(r).containsEntry("cutscene", "RESOLUCAO:ENTRADA");
    }

    @Test
    void osMesmosPassosDaoSempreOMesmoEstado() {
        fazer("IR:meio");
        fazer("IR:recepcao");
        fazer("IR:meio");
        assertThat(Json.write(agora().retrato())).isEqualTo(Json.write(agora().retrato()));
    }
}
