package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento.Execucao;
import br.com.fashionai.application.flair3d.Acionamento.Toque;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Nota;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Pedido;
import br.com.fashionai.application.flair3d.Flair3dFaseDeUso.Risco;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Rodada zonas (27/11/2026): o lance do gênero (pênalti, virada, pit stop, ameaça), as cartas do guarda-roupa como ação
 * (a cor aciona, o Hype é a torcida, a Especial é a Metamorfose com recarga) e a dificuldade que sobe com a rodada. Tudo
 * no servidor, da semente e dos toques.
 */
class Flair3dFaseDeUsoLancesTest {
    private static final List<String> SEGUROS = List.of("VESTIR", "TIRAR", "DESFILAR", "TROCAR_ABA", "VESTIR");
    private static final List<String> OUSADOS = List.of("TIRAR", "DESFILAR", "TROCAR_ABA", "VESTIR", "TIRAR");
    private static final List<Integer> JANELAS = List.of(1000, 1000, 1000, 1000, 1000);
    private static final List<Integer> CURTAS = List.of(600, 600, 600, 600, 600);

    /** O pit stop na marca 2, com a pista molhada: o pneu de chuva (a segunda opção) está no botão do lance ousado. */
    private static final Flair3dMomentoChave PIT = new Flair3dMomentoChave(2, "PIT_STOP", "PISTA_MOLHADA", List.of("MACIO", "CHUVA"), "TROCAR_ABA");

    private static Pedido pedido(Flair3dMomentoChave chave) {
        Risco r = new Risco(OUSADOS, Flair3dFaseDeUso.CUSTO, 600, Flair3dFaseDeUso.PRAZO_MS, JANELAS, CURTAS, chave, Set.of("Amarelo"), 0, "PILOTO_FAVORITO");
        return new Pedido(SEGUROS, 1000, "ENERGIA", 60, 15, r);
    }

    private static CbcRules.Card carta(String tier, String cor, double hype) {
        return new CbcRules.Card(UUID.randomUUID(), "SUP", tier, 70, null, "PIECE", Set.of(), Set.of(cor), Set.of(), Set.of(),
                Map.of("HYP", hype), null, null);
    }

    /** Toques seguros a {@code ms} em todas as marcas; no momento-chave, o botão dado; e a carta de cada marca, se houver. */
    private static Execucao jogando(int ms, String noChave, Map<Integer, UUID> cartas) {
        List<Toque> toques = new ArrayList<>();
        for (int i = 0; i < SEGUROS.size(); i++) {
            toques.add(new Toque(i, i == 2 && noChave != null ? noChave : SEGUROS.get(i), ms, cartas.get(i)));
        }
        return new Execucao(toques);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> jogada(List<?> jogadas, int marca) {
        return (Map<String, Object>) jogadas.get(marca);
    }

    private static Map<UUID, CbcRules.Card> mao(CbcRules.Card... cartas) {
        Map<UUID, CbcRules.Card> out = new HashMap<>();
        for (CbcRules.Card c : cartas) {
            out.put(c.id(), c);
        }
        return out;
    }

    @Test
    void oPneuCertoNoPitStopValeEAbreAJanelaDasMarcasSeguintesEOErradoFecha() {
        // 560 ms: BOM na janela de 1000; o pneu certo a abre para 1150 (560 vira PERFEITO); o errado a fecha para 850
        Nota certo = Flair3dFaseDeUso.avaliar(pedido(PIT), jogando(560, "TROCAR_ABA", Map.of()), Map.of());
        assertThat(certo.marcas()).containsExactly("BOM", "BOM", Flair3dMomentoChave.NOTA, "PERFEITO", "PERFEITO");
        assertThat(certo.detalhe()).containsEntry("chaveCerta", true);
        Nota errado = Flair3dFaseDeUso.avaliar(pedido(PIT), jogando(560, "DESFILAR", Map.of()), Map.of());
        assertThat(errado.marcas()).containsExactly("BOM", "BOM", "ERROU", "BOM", "BOM");
        assertThat(errado.detalhe()).containsEntry("chaveCerta", false);
        assertThat(certo.pontos()).isGreaterThan(errado.pontos());
        assertThat(errado.restante()).isEqualTo(60 - 15);
    }

    @Test
    void aCorDaCartaAcionaOLanceDoJogoEmbaloFolegoEscudo() {
        CbcRules.Card vermelha = carta("BRONZE", "red", 10);
        CbcRules.Card azul = carta("BRONZE", "blue", 10);
        CbcRules.Card preta = carta("BRONZE", "black", 10);
        // a vermelha é o TURBO (+2), a azul a ADERENCIA (janela 30% maior: 1200 ms vira BOM), a preta o FREIO (segura o erro)
        Nota n = Flair3dFaseDeUso.avaliar(pedido(null), tardeNaMarca1(Map.of(0, vermelha.id(), 1, azul.id(), 3, preta.id())), mao(vermelha, azul, preta));
        assertThat(n.marcas()).containsExactly("PERFEITO", "BOM", "PERFEITO", Flair3dFaseDeUsoNota.DEFENDIDO, "PERFEITO");
        assertThat(n.pontos()).isEqualTo(2 + 2 + 1 + 2 + 0 + 2);
        assertThat(n.restante()).isEqualTo(60);
        List<?> jogadas = (List<?>) n.detalhe().get("cartas");
        assertThat(jogada(jogadas, 0)).containsEntry("lance", "TURBO").containsEntry("efeito", "EMBALO");
        assertThat(jogada(jogadas, 1)).containsEntry("lance", "ADERENCIA");
        assertThat(jogada(jogadas, 3)).containsEntry("lance", "FREIO");
        assertThat(jogadas.get(2)).isNull();
    }

    /** A marca 1 a 1200 ms (fora da janela de 1000) e a marca 3 com outro botão; o resto perfeito. */
    private static Execucao tardeNaMarca1(Map<Integer, UUID> cartas) {
        List<Toque> toques = new ArrayList<>();
        for (int i = 0; i < SEGUROS.size(); i++) {
            String botao = i == 3 ? "TIRAR" : SEGUROS.get(i);
            toques.add(new Toque(i, botao, i == 1 ? 1200 : 300, cartas.get(i)));
        }
        return new Execucao(toques);
    }

    @Test
    void aCartaDaCorDoUniformeSomaMaisUmEACartaDeOutraPessoaNaoValeNada() {
        CbcRules.Card amarela = carta("BRONZE", "yellow", 10);
        CbcRules.Card alheia = carta("BRONZE", "red", 10);
        Nota n = Flair3dFaseDeUso.avaliar(pedido(null), jogando(300, null, Map.of(0, amarela.id(), 1, alheia.id())), mao(amarela));
        // VACUO (embalo +2) da cor do uniforme (+1); a carta que não é da pessoa não entra no mapa e não conta
        assertThat(n.pontos()).isEqualTo(5 * Flair3dFaseDeUso.SEGURO_PERFEITO + Flair3dCartaDeUso.EMBALO + Flair3dCartaDeUso.COR_DO_UNIFORME);
        assertThat(jogada((List<?>) n.detalhe().get("cartas"), 0)).containsEntry("doUniforme", true);
        assertThat(((List<?>) n.detalhe().get("cartas")).get(1)).isNull();
    }

    @Test
    void cadaCartaValeUmaVezEAteTresPorFase() {
        CbcRules.Card a = carta("BRONZE", "red", 10);
        CbcRules.Card b = carta("BRONZE", "red", 10);
        CbcRules.Card c = carta("BRONZE", "red", 10);
        CbcRules.Card d = carta("BRONZE", "red", 10);
        Nota repetida = Flair3dFaseDeUso.avaliar(pedido(null), jogando(300, null, Map.of(0, a.id(), 1, a.id())), mao(a));
        assertThat((List<?>) repetida.detalhe().get("cartas")).filteredOn(x -> x != null).hasSize(1);
        Nota quatro = Flair3dFaseDeUso.avaliar(pedido(null), jogando(300, null, Map.of(0, a.id(), 1, b.id(), 3, c.id(), 4, d.id())), mao(a, b, c, d));
        assertThat((List<?>) quatro.detalhe().get("cartas")).filteredOn(x -> x != null).hasSize(Flair3dCartaDeUso.MAXIMO);
    }

    @Test
    void aEspecialEhAMetamorfoseQueVoltaDepoisDaRecarga() {
        CbcRules.Card especial = carta("ESPECIAL", "white", 10);
        // usada na 0, ainda carregando na 2, volta na 3
        Map<Integer, UUID> usos = Map.of(0, especial.id(), 2, especial.id(), 3, especial.id());
        Nota n = Flair3dFaseDeUso.avaliar(pedido(null), jogando(300, null, usos), mao(especial));
        List<?> jogadas = (List<?>) n.detalhe().get("cartas");
        assertThat(jogada(jogadas, 0)).containsEntry("efeito", Flair3dCartaDeUso.METAMORFOSE);
        assertThat(jogadas.get(2)).isNull();
        assertThat(jogada(jogadas, 3)).containsEntry("efeito", Flair3dCartaDeUso.METAMORFOSE);
    }

    @Test
    void aTorcidaEmpurraPelaFaixaDeHypeDaCartaSemEscreverOHype() {
        CbcRules.Card viral = carta("BRONZE", "red", 95);
        Map<String, Double> antes = new LinkedHashMap<>(viral.hype());
        // 1200 ms: fora da janela de 1000, dentro da de 1250 que a torcida VIRAL abre
        List<Toque> toques = new ArrayList<>();
        for (int i = 0; i < SEGUROS.size(); i++) {
            toques.add(new Toque(i, SEGUROS.get(i), i == 0 ? 1200 : 300, i == 0 ? viral.id() : null));
        }
        Nota n = Flair3dFaseDeUso.avaliar(pedido(null), new Execucao(toques), mao(viral));
        assertThat(n.marcas().get(0)).isEqualTo("BOM");
        assertThat(n.detalhe()).containsEntry("torcida", "VIRAL");
        assertThat(viral.hype()).isEqualTo(antes);
    }

    @Test
    void aDificuldadeSobeComARodadaEComAMarca() {
        Contexto ctx = new Contexto(Map.of(), null, null).comSemente(5);
        Risco base = Flair3dFaseDeUso.riscoDe("PILOTO_FAVORITO", SEGUROS, 1000, ctx, null);
        Risco terceira = Flair3dFaseDeUso.riscoDe("PILOTO_FAVORITO", SEGUROS, 1000, ctx.naRodada("TENIS_DOS_SONHOS"), null);
        assertThat(base.nivel()).isZero();
        assertThat(terceira.nivel()).isEqualTo(2);
        assertThat(base.janelas()).containsExactly(1000, 960, 920, 880, 840);
        assertThat(terceira.janelas().get(0)).isEqualTo(760);
        assertThat(terceira.prazoMs()).isLessThan(base.prazoMs());
        assertThat(base.chave()).isNotNull();
        assertThat(base.chave().opcoes()).containsExactly("MACIO", "CHUVA");
        assertThat(List.of(SEGUROS.get(2), base.ousados().get(2))).contains(base.chave().certa());
    }
}
