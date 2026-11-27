package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.Flair3dHype.Band;
import br.com.fashionai.application.flair3d.Acionamento.Execucao;
import br.com.fashionai.application.flair3d.Acionamento.Toque;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dExecucao;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * As regras da Aura na partida (rodada 8g), as mesmas de lib/flair/nucleos/aura-na-partida.ts: a plateia pela faixa
 * média de Hype, o Splash uma faixa acima, o trunfo pela faixa da carta, a janela do Electro, o Comum que perdoa o dreno
 * do primeiro erro e a Metamorfose da carta Especial, com recarga. Só leitura: nenhuma regra escreve Hype.
 */
class Flair3dAuraRegrasTest {
    /** Uma carta com o Hype público dado (nulo = sem Hype). */
    static CbcRules.Card comHype(String posicao, Integer hyp, String... etiquetas) {
        CbcRules.Card c = Flair3dFixtures.card(posicao, etiquetas);
        return new CbcRules.Card(c.id(), c.position(), c.tier(), c.ovr(), c.brand(), c.originType(), c.styles(), c.colors(), c.occasions(),
                c.materials(), hyp == null ? Map.of() : Map.of("HYP", hyp.doubleValue()), null, null, c.category(), c.subcategory());
    }

    static Contexto contexto(Map<UUID, String> auras, CbcRules.Card... cartas) {
        return Flair3dFixtures.contexto(7, cartas).comAuras(auras);
    }

    @Test
    void aPlateiaLeAFaixaMediaENuncaTiraPonto() {
        CbcRules.Card viral = comHype("SUP", 95);
        CbcRules.Card hot = comHype("INF", 65);
        CbcRules.Card semHype = comHype("CAL", null);
        Contexto ctx = contexto(Map.of(), viral, hot, semHype);
        // (5 + 3 + 0) / 3 = 2: Relevante, 1 ponto
        assertThat(Flair3dAuraRegras.faixaDaPlateia(List.of(viral, hot, semHype), ctx)).isEqualTo(Band.RELEVANT);
        assertThat(Flair3dAuraRegras.plateia(List.of(viral, hot, semHype), ctx)).isEqualTo(1);
        assertThat(Flair3dAuraRegras.plateia(List.of(viral), ctx)).isEqualTo(Flair3dAuraRegras.PLATEIA_TETO);
        assertThat(Flair3dAuraRegras.plateia(List.of(semHype), ctx)).isZero();
        assertThat(Flair3dAuraRegras.plateia(List.of(), ctx)).isZero();
    }

    @Test
    void oSplashFazAPlateiaLerUmaFaixaAcima() {
        CbcRules.Card hot = comHype("SUP", 65);
        CbcRules.Card splash = comHype("INF", 65);
        Contexto sem = contexto(Map.of(), hot, splash);
        Contexto com = contexto(Map.of(splash.id(), Flair3dAuraRegras.SPLASH), hot, splash);
        assertThat(Flair3dAuraRegras.plateia(List.of(hot, splash), sem)).isEqualTo(2);
        assertThat(Flair3dAuraRegras.plateia(List.of(hot, splash), com)).isEqualTo(4);
    }

    @Test
    void oTrunfoPedeHypeRelevanteEValeDe2a5() {
        assertThat(Flair3dAuraRegras.podeSerTrunfo(comHype("SUP", 39))).isFalse();
        assertThat(Flair3dAuraRegras.podeSerTrunfo(comHype("SUP", null))).isFalse();
        assertThat(List.of(40, 60, 75, 90).stream().map(h -> Flair3dAuraRegras.trunfo(comHype("SUP", h))).toList()).containsExactly(2, 3, 4, 5);
    }

    @Test
    void electroAbreAJanelaAte300ms() {
        CbcRules.Card a = comHype("SUP", null);
        CbcRules.Card b = comHype("INF", null);
        CbcRules.Card c = comHype("CAL", null);
        Contexto ctx = contexto(Map.of(a.id(), "ELECTRO", b.id(), "ELECTRO", c.id(), "ELECTRO"), a, b, c);
        assertThat(Flair3dAuraNaExecucao.janela("PASSARELA", 1000, List.of(a), ctx)).isEqualTo(1150);
        assertThat(Flair3dAuraNaExecucao.janela("PASSARELA", 1000, List.of(a, b, c), ctx)).isEqualTo(1300);
        // fora dos jogos com Aura na partida, nada muda
        assertThat(Flair3dAuraNaExecucao.janela("LABIRINTO", 1000, List.of(a, b, c), ctx)).isEqualTo(1000);
    }

    @Test
    void comumPerdoaODrenoDoPrimeiroErroEMetamorfoseTransformaComRecarga() {
        CbcRules.Card comum = comHype("SUP", null);
        CbcRules.Card especial = comHype("ACE", null, "tier:ESPECIAL");
        CbcRules.Card ouro = comHype("ACE", null, "tier:OURO");
        Flair3dExecucao.Pedido pedido = new Flair3dExecucao.Pedido(List.of("VESTIR", "TIRAR", "DESFILAR"), 1000, "FOCO", 40, 15);
        Flair3dExecucao.Nota errou = Flair3dExecucao.avaliar(pedido, new Execucao(List.of()));
        assertThat(errou.restante()).isZero();

        List<Evento> eventos = new ArrayList<>();
        Contexto ctxComum = contexto(Map.of(comum.id(), "COMMON"), comum);
        Flair3dExecucao.Nota pe = Flair3dAuraNaExecucao.reavaliar("PASSARELA", pedido, errou, List.of(comum), ctxComum, eventos);
        assertThat(pe.pontos()).isEqualTo(errou.pontos());
        assertThat(pe.restante()).isEqualTo(40 - 2 * 15);
        assertThat(eventos).extracting(Evento::codigo).containsExactly(Flair3dAuraNaExecucao.CODIGO);

        Contexto ctxMeta = contexto(Map.of(especial.id(), "METAMORPHOSE", ouro.id(), "METAMORPHOSE"), especial, ouro);
        Flair3dExecucao.Nota meta = Flair3dAuraNaExecucao.reavaliar("PASSARELA", pedido, errou, List.of(especial), ctxMeta, new ArrayList<>());
        // três marcas: transforma a primeira e recarrega por duas marcas; as outras duas seguem erradas
        assertThat(meta.marcas()).containsExactly("BOM", "ERROU", "ERROU");
        assertThat(meta.pontos()).isEqualTo(Flair3dExecucao.BOM - 2 * Flair3dExecucao.ERRO);
        assertThat(Flair3dAuraNaExecucao.metamorfoses(List.of("ERROU", "ERROU", "ERROU", "ERROU", "BOM", "ERROU"), true)).containsExactly(0, 3);
        // a Metamorfose é poder da carta Especial: a de Ouro com a mesma Aura não tem
        assertThat(Flair3dAuraRegras.metamorfose(ouro, ctxMeta)).isFalse();
        assertThat(Flair3dAuraNaExecucao.reavaliar("PASSARELA", pedido, errou, List.of(ouro), ctxMeta, new ArrayList<>())).isSameAs(errou);
    }

    @Test
    void aFamiliaDaCartaVemDaArteDoCard() {
        assertThat(Flair3dAuraDaCarta.familia("{\"compositionPreset\":{\"id\":\"x\",\"family\":\"ELECTRO\"}}")).isEqualTo("ELECTRO");
        assertThat(Flair3dAuraDaCarta.familia("{\"auraMetamorphose\":\"PRISMA\",\"compositionPreset\":{\"family\":\"SPLASH\"}}")).isEqualTo("METAMORPHOSE");
        assertThat(Flair3dAuraDaCarta.familia("{\"auraMetamorphose\":\"OFF\"}")).isNull();
        assertThat(Flair3dAuraDaCarta.familia(null)).isNull();
        assertThat(Flair3dAuraDaCarta.familia("{\"compositionPreset\":{\"family\":\"OUTRA\"}}")).isNull();
    }
}
