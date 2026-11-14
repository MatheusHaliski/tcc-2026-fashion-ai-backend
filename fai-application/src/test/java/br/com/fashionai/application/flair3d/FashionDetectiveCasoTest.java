package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveNucleo;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * O caso do FASHION_DETECTIVE (docs/flair/flair-3d/CORES_E_ACOES.md): 6 salões, um look por salão, os medidores das cores
 * no desafio automático, a carta de pista de cada salão, o mercado depois do salão 3 e as estalecas do caso.
 */
class FashionDetectiveCasoTest {
    private final FashionDetectiveNucleo n = new FashionDetectiveNucleo();
    private final List<CbcRules.Card> deck = new ArrayList<>();
    private Andamento andamento = new Andamento(0, List.of());
    private Entrega ultima;

    private CbcRules.Card carta(String posicao, String... etiquetas) {
        CbcRules.Card c = card(posicao, etiquetas);
        deck.add(c);
        return c;
    }

    private Contexto contexto() {
        return Flair3dFixtures.contexto(1L, deck.toArray(CbcRules.Card[]::new)).comAndamento(andamento);
    }

    /** Entrega o look do salão da vez, como o serviço faz (a entrega anterior vira etapa). */
    private Resultado salao(CbcRules.Card... look) {
        andamento = andamento.proximaTentativa(ultima);
        ultima = vestir(look);
        return n.pontuar(ultima, contexto());
    }

    private Resultado mercado(Acionamento a) {
        andamento = andamento.com(a);
        return n.pontuar(ultima, contexto());
    }

    private static Object valor(Resultado r, String codigo) {
        return r.eventos().stream().filter(e -> e.codigo().equals(codigo)).map(Resultado.Evento::valor).reduce((x, y) -> y).orElse(null);
    }

    @Test
    void salaoUmPedeGalaDesafioEAPistaDaBlusaBrancaNoArmario() {
        CbcRules.Card branca = carta("SUP", "color:white", "occasion:formal", "material:leather");
        CbcRules.Card verde = carta("INF", "color:olive", "occasion:party", "material:wool");
        Resultado r = salao(branca, verde);
        assertThat(r.status()).isEqualTo("ABERTA");
        assertThat(r.resultado()).isEqualTo("FAVORAVEL");
        assertThat(r.regras()).extracting(Resultado.RegraResultado::ok).containsExactly(true, true, true);
        assertThat(valor(r, "SALAO")).isEqualTo(Map.of("salao", 1, "codigo", "ENTRADA_DA_GALA"));
        assertThat(valor(r, "PONTOS_DO_SALAO")).isEqualTo(100);
        assertThat(valor(r, "PISTAS")).isEqualTo(1);
        assertThat(valor(r, "ESTALECAS")).isEqualTo(400);
        assertThat(valor(r, "PROXIMO_SALAO")).isEqualTo(Map.of("salao", 2, "codigo", "SALAO_PRINCIPAL"));
    }

    @Test
    void semPecaVerdeOArmarioNaoAbreESemABlusaBrancaNaoHaPista() {
        CbcRules.Card branca = carta("SUP", "color:white", "occasion:formal", "material:leather");
        CbcRules.Card festa = carta("INF", "occasion:party", "material:wool");
        Resultado fechado = salao(branca, festa);
        assertThat(valor(fechado, "PISTA")).isEqualTo(false);
        assertThat(valor(fechado, "PONTOS_DO_SALAO")).isEqualTo(80);
        assertThat(valor(fechado, "ESTALECAS")).isEqualTo(150);
    }

    @Test
    void medidoresDasCoresDecidemOConfrontoAutomatico() {
        CbcRules.Card fraca = carta("SUP", "ovr:10");
        assertThat(valor(n.previa(vestir(fraca), contexto()), "DEFESA")).isEqualTo(1);
        assertThat(salao(fraca).resultado()).isEqualTo("DESFAVORAVEL");
        CbcRules.Card preta = carta("SUP", "ovr:10", "color:black");
        CbcRules.Card grafite = carta("INF", "ovr:10", "color:charcoal");
        Resultado furtivo = salao(preta, grafite);
        assertThat(valor(furtivo, "FURTIVIDADE")).isEqualTo(40L);
        assertThat(furtivo.resultado()).isEqualTo("PARCIAL");
        CbcRules.Card amarela = carta("CAL", "ovr:10", "color:yellow");
        CbcRules.Card azul = carta("INF", "ovr:10", "color:blue");
        CbcRules.Card marinho = carta("SUP", "ovr:10", "color:navy");
        Resultado forte = salao(amarela, azul, marinho);
        assertThat(valor(forte, "VIDA")).isEqualTo(20L);
        assertThat(valor(forte, "DANO")).isEqualTo(40L);
        assertThat(forte.status()).isEqualTo("EM_ACAO");
        assertThat(mercado(Acionamento.NENHUM).regras().get(1).ok()).isTrue();
    }

    @Test
    void mercadoDepoisDoSalaoTresVendeCartaECompraAPecaDaPistaQueFalta() {
        CbcRules.Card gala = carta("SUP", "occasion:formal", "occasion:work", "occasion:night_out");
        CbcRules.Card festa = carta("INF", "occasion:party", "occasion:casual", "occasion:festival");
        CbcRules.Card especial = carta("ACE", "tier:ESPECIAL");
        salao(gala, festa);
        salao(gala, festa);
        Resultado noMercado = salao(gala, festa);
        assertThat(noMercado.status()).isEqualTo("EM_ACAO");
        assertThat(valor(noMercado, "MERCADO")).isEqualTo(450);

        ApiException e = catchThrowableOfType(ApiException.class, () -> n.pontuar(ultima,
                contexto().comAndamento(andamento.com(new Acionamento(gala.id(), null)))));
        assertThat(e.code()).isEqualTo("CARTA_VESTIDA");

        Resultado compras = mercado(new Acionamento(especial.id(), null));
        assertThat(compras.status()).isEqualTo("ABERTA");
        assertThat(compras.eventos()).contains(new Resultado.Evento("VENDA", Map.of("carta", especial.id(), "estalecas", 500)),
                new Resultado.Evento("COMPRA", Map.of("item", "PECA_DA_PISTA", "estalecas", 500)),
                new Resultado.Evento("COMPRA", Map.of("item", "COLETE", "estalecas", 300)),
                new Resultado.Evento("COMPRA", Map.of("item", "LANTERNA", "estalecas", 150)));
        assertThat(valor(compras, "ESTALECAS")).isEqualTo(0);

        Resultado clube = salao(gala, festa);
        assertThat(valor(clube, "SALAO")).isEqualTo(Map.of("salao", 4, "codigo", "CLUBE_UNDERGROUND"));
        assertThat(valor(clube, "PISTA")).isEqualTo(true);
        assertThat(valor(clube, "DEFESA")).isEqualTo(32);
    }

    @Test
    void casoFechaNoSextoSalaoComAMediaDosSaloesEOResultadoPelasPistas() {
        CbcRules.Card gala = carta("SUP", "occasion:formal", "occasion:work", "occasion:night_out", "material:leather", "ovr:90");
        CbcRules.Card festa = carta("INF", "occasion:party", "occasion:casual", "occasion:festival", "occasion:business",
                "material:wool", "ovr:90");
        for (int i = 1; i <= 2; i++) {
            assertThat(salao(gala, festa).status()).isEqualTo("ABERTA");
        }
        assertThat(salao(gala, festa).status()).isEqualTo("EM_ACAO");
        assertThat(mercado(Acionamento.NENHUM).status()).isEqualTo("ABERTA");
        salao(gala, festa);
        salao(gala, festa);
        Resultado fim = salao(gala, festa);
        assertThat(fim.fecha()).isTrue();
        // acesso nos 6 salões; a defesa 58 passa em 4 limites (50, 55, 50, 55) e não em 2 (60, 65): (4 × 80 + 2 × 40) / 6
        assertThat(fim.pontos()).isEqualTo(67);
        assertThat(fim.resultado()).isEqualTo("DESFAVORAVEL");
        assertThat(valor(fim, "PISTAS")).isEqualTo(0);
        assertThat(fim.regras()).extracting(Resultado.RegraResultado::codigo).containsExactly("ACESSO", "DESAFIO_DEFESA", "PISTA");
        assertThat(fim.cartas()).hasSize(2);
        assertThat(n.pontuar(ultima, contexto())).isEqualTo(fim);
        assertThat(n.efeitos(carta("SUP", "color:green"), contexto())).extracting(Efeito::codigo).containsExactly("DEFESA", "COR_ABRIR");
    }
}
