package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.PassarelaNucleo;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * A jogada de cena (cartas como ação, não só para vestir): o look avaliado deixa a partida EM_ACAO com o pedido de cor
 * da cena; a carta do deck fora do look dispara a ação da cor dela, e a cor pedida soma 10. O servidor decide tudo.
 */
class Flair3dJogadaDeCenaTest {
    private static final Map<String, String> COR = Map.of("Preto", "black", "Verde", "green", "Amarelo", "yellow", "Azul", "blue",
            "Vermelho", "red", "Branco", "white");
    private final Flair3dJogadaDeCena passarela = new Flair3dJogadaDeCena(new PassarelaNucleo());
    private final CbcRules.Card sup = card("SUP", "brand:Farm");

    private static String pedida(Resultado r) {
        return (String) ((Map<?, ?>) r.eventos().stream().filter(e -> e.codigo().equals("PEDIDO_DE_CENA")).findFirst().orElseThrow().valor()).get("familia");
    }

    @Test
    void oLookAvaliadoEsperaAJogadaComOPedidoDaCena() {
        Resultado r = passarela.pontuar(vestir(sup), contexto(5, sup));
        assertThat(r.status()).isEqualTo("EM_ACAO");
        assertThat(Flair3dCores.FAMILIAS).contains(pedida(r));
    }

    @Test
    void aCartaDaCorPedidaSomaDezEDisparaAAcaoDaCor() {
        String familia = pedida(passarela.pontuar(vestir(sup), contexto(5, sup)));
        CbcRules.Card certa = card("ACE", "color:" + COR.get(familia));
        CbcRules.Card outra = card("ACE", "color:" + COR.get(familia.equals("Preto") ? "Branco" : "Preto"));
        Contexto base = contexto(5, sup, certa, outra);
        Resultado semJogada = passarela.pontuar(vestir(sup), base.comAndamento(Andamento.INICIO.com(Acionamento.NENHUM)));
        Resultado acertou = passarela.pontuar(vestir(sup), base.comAndamento(Andamento.INICIO.com(new Acionamento(certa.id(), null))));
        Resultado errou = passarela.pontuar(vestir(sup), base.comAndamento(Andamento.INICIO.com(new Acionamento(outra.id(), null))));
        assertThat(semJogada.fecha()).isTrue();
        assertThat(acertou.pontos()).isEqualTo(Math.min(100, semJogada.pontos() + Flair3dJogadaDeCena.BONUS));
        assertThat(errou.pontos()).isEqualTo(semJogada.pontos());
        assertThat(acertou.eventos()).anyMatch(e -> e.codigo().equals("JOGADA_DE_CENA") && Boolean.TRUE.equals(((Map<?, ?>) e.valor()).get("acertou")));
        assertThat(acertou.regras()).anyMatch(rg -> rg.codigo().equals("JOGADA_DE_CENA") && rg.ok());
        assertThat(errou.eventos()).anyMatch(e -> e.codigo().equals("JOGADA_DE_CENA") && ((Map<?, ?>) e.valor()).get("acao") != null);
    }

    @Test
    void aCartaDoLookNaoEhJogadaDeCena() {
        Contexto c = contexto(5, sup).comAndamento(Andamento.INICIO.com(new Acionamento(sup.id(), null)));
        assertThat(catchThrowableOfType(() -> passarela.pontuar(vestir(sup), c), ApiException.class).code()).isEqualTo("CARTA_NO_LOOK");
    }
}
