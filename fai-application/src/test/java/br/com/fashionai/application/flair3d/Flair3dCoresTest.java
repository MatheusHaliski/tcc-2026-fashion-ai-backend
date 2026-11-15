package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * A cor da peça decide a ação (docs/flair/flair-3d/CORES_E_ACOES.md): a tabela de cada jogo, os lances do segundo tempo do
 * FASHION_SPORTS disparados pela peça que entra.
 * O caso do detetive está em FashionDetectiveCasoTest.
 */
class Flair3dCoresTest {
    private static Acionamento troca(String vaga, CbcRules.Card entra) {
        return new Acionamento(null, new Acionamento.Troca(vaga, entra.id()));
    }

    /** O campo dado de cada evento LANCE, na ordem. */
    private static List<Object> lances(Resultado r, String campo) {
        return r.eventos().stream().filter(e -> e.codigo().equals("LANCE")).map(e -> (Object) ((Map<?, ?>) e.valor()).get(campo)).toList();
    }

    private static Object valor(Resultado r, String codigo) {
        return r.eventos().stream().filter(e -> e.codigo().equals(codigo)).map(Resultado.Evento::valor).findFirst().orElse(null);
    }

    @Test
    void cadaFamiliaDeCorTemUmaAcaoPorJogoEPecaSemCorMapeadaNaoTemAcao() {
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP", "color:black"))).isEqualTo("DEFESA");
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP", "color:emerald"))).isEqualTo("CHUTE");
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP", "color:mustard"))).isEqualTo("DRIBLE");
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP", "color:navy"))).isEqualTo("CORRIDA");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:green"))).isEqualTo("ABRIR");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:charcoal"))).isEqualTo("FURTIVIDADE");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:yellow"))).isEqualTo("VIDA");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:blue"))).isEqualTo("DANO");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:white"))).isEqualTo("PISTA");
        assertThat(Flair3dCores.acao(Flair3dCores.DETETIVE, card("SUP", "color:red"))).isEqualTo("MOEDA");
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, card("SUP"))).isNull();
        assertThat(Flair3dCores.acao(Flair3dCores.ESPORTE, null)).isNull();
    }

    @Test
    void todoJogoDeCartasTemUmEfeitoParaCadaUmaDasSeisCores() {
        List<String> deCartas = Flair3dNucleos.TODOS.stream().filter(n -> n.definicao().recursos().contains(Definicao.CARTAS))
                .map(Flair3dNucleo::codigo).toList();
        assertThat(deCartas).hasSize(11);
        String[] cores = {"black", "green", "yellow", "blue", "red", "white"};
        for (String nucleo : deCartas) {
            Map<String, String> tabela = Flair3dCores.tabelaDe(nucleo);
            assertThat(tabela).as(nucleo).isNotNull();
            assertThat(tabela.keySet()).as(nucleo).containsExactlyInAnyOrderElementsOf(Flair3dCores.FAMILIAS);
            assertThat(tabela.values()).as(nucleo).doesNotHaveDuplicates();
            for (int i = 0; i < cores.length; i++) {
                Efeito e = Flair3dCores.efeitoDaCor(nucleo, card("SUP", "color:" + cores[i]));
                assertThat(e.valor()).as(nucleo + " " + cores[i]).isEqualTo(i + 1);
                assertThat(e.codigo()).startsWith("FASHION_SPORTS".equals(nucleo) ? "ACAO_" : "COR_");
                assertThat(e.motivo()).isFalse();
            }
            assertThat(Flair3dCores.efeitoDaCor(nucleo, card("SUP"))).isNull();
        }
        assertThat(Flair3dCores.efeitoDaCor("PASSARELA", card("SUP", "color:navy"))).isEqualTo(new Efeito("COR_FLASHES", 4));
        assertThat(Flair3dCores.efeitoDaCor("CLUBE_CORACAO", card("SUP", "color:black"))).isNull();
    }
}
