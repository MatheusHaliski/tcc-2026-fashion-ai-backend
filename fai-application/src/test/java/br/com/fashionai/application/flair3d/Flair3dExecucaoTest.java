package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento.Execucao;
import br.com.fashionai.application.flair3d.Acionamento.Toque;
import br.com.fashionai.application.flair3d.nucleos.PersonagemFilmeNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * A execução no percurso (a habilidade conta na nota): o look avaliado deixa a partida EM_ACAO com um botão por marca e
 * a janela de tempo; os toques certos e a tempo somam, os errados tiram pontos e drenam o recurso, e o recurso zerado
 * perde a partida. O servidor decide tudo a partir da semente e dos toques.
 */
class Flair3dExecucaoTest {
    private final Flair3dExecucao filme = new Flair3dExecucao(new PersonagemFilmeNucleo());
    /** uma peça preta: cumpre o figurino do detetive noir (o look tem nota para apresentar) */
    private final CbcRules.Card sup = card("SUP", "color:black");

    @SuppressWarnings("unchecked")
    private static List<String> botoes(Resultado r) {
        Map<String, Object> v = (Map<String, Object>) r.eventos().stream().filter(e -> e.codigo().equals("EXECUCAO_PEDIDA")).findFirst().orElseThrow().valor();
        return (List<String>) v.get("botoes");
    }

    private Resultado com(Execucao feita) {
        Contexto base = contexto(7, sup);
        return filme.pontuar(vestir(sup), base.comAndamento(Andamento.INICIO.com(new Acionamento(null, null, null, feita))));
    }

    private Execucao todos(List<String> botoes, int ms) {
        return new Execucao(List.of(new Toque(0, botoes.get(0), ms), new Toque(1, botoes.get(1), ms), new Toque(2, botoes.get(2), ms)));
    }

    @Test
    void oLookAvaliadoEsperaAExecucaoComUmBotaoPorMarca() {
        Resultado r = filme.pontuar(vestir(sup), contexto(7, sup));
        assertThat(r.status()).isEqualTo(Resultado.EM_ACAO);
        assertThat(botoes(r)).hasSize(Flair3dExecucao.MARCAS).allMatch(Flair3dExecucao.BOTOES::contains);
    }

    @Test
    void perfeitoSomaEErrarTiraPontos() {
        List<String> b = botoes(filme.pontuar(vestir(sup), contexto(7, sup)));
        Resultado base = new PersonagemFilmeNucleo().pontuar(vestir(sup), contexto(7, sup));
        Resultado perfeito = com(todos(b, 300));
        Resultado bom = com(todos(b, Flair3dExecucao.janelaMs(50) - 10));
        assertThat(perfeito.fecha()).isTrue();
        assertThat(perfeito.pontos()).isEqualTo(Math.min(100, base.pontos() + Flair3dExecucao.TETO));
        assertThat(bom.pontos()).isEqualTo(Math.min(100, base.pontos() + 3 * Flair3dExecucao.BOM));
        assertThat(perfeito.regras()).anyMatch(rg -> rg.codigo().equals("EXECUCAO") && rg.ok());
    }

    @Test
    void antecipadoOuBotaoErradoEhErro() {
        List<String> b = botoes(filme.pontuar(vestir(sup), contexto(7, sup)));
        Flair3dExecucao.Pedido p = new Flair3dExecucao.Pedido(b, 1000, "FOCO", 40, 15);
        String outro = Flair3dExecucao.BOTOES.stream().filter(x -> !x.equals(b.get(1))).findFirst().orElseThrow();
        Flair3dExecucao.Nota n = Flair3dExecucao.avaliar(p, new Execucao(List.of(new Toque(0, b.get(0), 60), new Toque(1, outro, 300), new Toque(2, b.get(2), 300))));
        assertThat(n.marcas()).containsExactly("ERROU", "ERROU", "PERFEITO");
        assertThat(n.pontos()).isEqualTo(-2 * Flair3dExecucao.ERRO + Flair3dExecucao.PERFEITO);
        assertThat(n.restante()).isEqualTo(10);
    }

    @Test
    void semToqueEmNenhumaMarcaOFocoEsgotaEAPartidaEstaPerdida() {
        Resultado r = com(new Execucao(List.of()));
        assertThat(r.resultado()).isEqualTo(Flair3dExecucao.ESGOTADO);
        assertThat(r.pontos()).isLessThanOrEqualTo(Flair3dExecucao.NOTA_DE_QUEM_ESGOTOU);
    }

    @Test
    void aJanelaCresceComAAgilidade() {
        assertThat(Flair3dExecucao.janelaMs(0)).isLessThan(Flair3dExecucao.janelaMs(100));
        assertThat(Flair3dExecucao.janelaMs(50)).isEqualTo(1000);
    }
}
