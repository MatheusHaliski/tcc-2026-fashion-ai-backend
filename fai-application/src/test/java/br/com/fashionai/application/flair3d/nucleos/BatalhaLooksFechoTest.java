package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dExecucao;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Resultado;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O bug da rodada 8g: na Batalha de 3 rodadas, quem "seguia sem executar" via "30 pontos", nenhuma estrela e "Vitória"
 * ao lado da tabela 127 × 79 (a média 42 menos os 12 da execução vazia, com o desfecho da soma sem a execução). Agora a
 * execução entra na soma contra a casa e a nota segue o desfecho.
 */
class BatalhaLooksFechoTest {
    private final Flair3dExecucao batalha = new Flair3dExecucao(new BatalhaLooksNucleo());
    private final CbcRules.Card sup = Flair3dFixtures.card("SUP", "color:blue", "occasion:formal", "material:wool");
    private final CbcRules.Card inf = Flair3dFixtures.card("INF", "color:blue", "occasion:work", "material:linen");
    private final CbcRules.Card cal = Flair3dFixtures.card("CAL", "color:blue", "occasion:social", "material:rubber");
    private final CbcRules.Card reserva = Flair3dFixtures.card("ACE", "color:red");

    /** As três rodadas entregues com o mesmo look e 30 de foco gastos na segunda (a reserva aguenta os três erros). */
    private Contexto naTerceira(long semente, Acionamento... acionamentos) {
        Entrega e = Flair3dFixtures.vestir(sup, inf, cal);
        Andamento.Etapa etapa = new Andamento.Etapa(e.cartas(), List.of());
        Andamento.UsoDeRecurso foco = new Andamento.UsoDeRecurso(reserva.id(), "FOCO", 30, "p", 0, 1);
        Andamento a = new Andamento(3, List.of(acionamentos), List.of(etapa, etapa), BatalhaLooksRodadas.BATALHA, null, List.of(foco));
        return Flair3dFixtures.contexto(semente, sup, inf, cal, reserva).comAndamento(a);
    }

    private Resultado semExecutar(long semente) {
        return batalha.pontuar(Flair3dFixtures.vestir(sup, inf, cal), naTerceira(semente, new Acionamento(null, null, null, null)));
    }

    private static Map<?, ?> soma(Resultado r) {
        return (Map<?, ?>) r.eventos().stream().filter(e -> e.codigo().equals("SOMA_DA_BATALHA")).findFirst().orElseThrow().valor();
    }

    private static int numero(Map<?, ?> m, String k) {
        return ((Number) m.get(k)).intValue();
    }

    /** A primeira semente em que a soma das rodadas (sem a execução) cumpre a condição. */
    private long semente(Predicate<Map<?, ?>> condicao) {
        for (long s = 1; s < 3000; s++) {
            Resultado pedido = batalha.pontuar(Flair3dFixtures.vestir(sup, inf, cal), naTerceira(s));
            if (Resultado.EM_ACAO.equals(pedido.status()) && condicao.test(soma(pedido))) {
                return s;
            }
        }
        throw new AssertionError("nenhuma semente");
    }

    @Test
    void seguirSemExecutarComFolgaNaSomaAindaVenceEVitoriaValeAoMenosUmaEstrela() {
        long s = semente(m -> numero(m, "voce") > numero(m, "adversario") + 3 * Flair3dExecucao.ERRO);
        Resultado fim = semExecutar(s);
        Map<?, ?> soma = soma(fim);
        assertThat(fim.resultado()).isEqualTo("VITORIA");
        assertThat(numero(soma, "execucao")).isEqualTo(-3 * Flair3dExecucao.ERRO);
        assertThat(numero(soma, "voce")).isEqualTo(numero(soma, "rodadas") - 3 * Flair3dExecucao.ERRO).isGreaterThan(numero(soma, "adversario"));
        // a nota segue o desfecho: "Vitória" nunca mais aparece com zero estrela
        assertThat(fim.pontos()).isGreaterThanOrEqualTo(BatalhaLooksFecho.NOTA_DA_VITORIA);
        assertThat(fim.estrelas()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void aExecucaoVaziaQueTiraAFolgaViraDerrotaENotaSemEstrela() {
        long s = semente(m -> numero(m, "voce") > numero(m, "adversario") && numero(m, "voce") - 3 * Flair3dExecucao.ERRO < numero(m, "adversario"));
        Resultado fim = semExecutar(s);
        assertThat(fim.resultado()).isEqualTo("DERROTA");
        assertThat(fim.pontos()).isLessThanOrEqualTo(BatalhaLooksFecho.NOTA_DA_DERROTA);
        assertThat(fim.estrelas()).isZero();
    }

    @Test
    void aExecucaoPerfeitaSomaNaComparacaoEODesfechoSegueASomaComEla() {
        for (long s = 1; s <= 30; s++) {
            Resultado pedido = batalha.pontuar(Flair3dFixtures.vestir(sup, inf, cal), naTerceira(s));
            Resultado fim = batalha.pontuar(Flair3dFixtures.vestir(sup, inf, cal), naTerceira(s, Flair3dFixtures.perfeita(pedido)));
            Map<?, ?> soma = soma(fim);
            assertThat(numero(soma, "execucao")).isEqualTo(Flair3dExecucao.TETO);
            assertThat(numero(soma, "voce")).isEqualTo(numero(soma(pedido), "voce") + Flair3dExecucao.TETO);
            boolean ganhou = numero(soma, "voce") > numero(soma, "adversario");
            if (numero(soma, "voce") != numero(soma, "adversario")) {
                assertThat(fim.resultado()).isEqualTo(ganhou ? "VITORIA" : "DERROTA");
            }
            assertThat(fim.estrelas() > 0).isEqualTo("VITORIA".equals(fim.resultado()));
        }
    }
}
