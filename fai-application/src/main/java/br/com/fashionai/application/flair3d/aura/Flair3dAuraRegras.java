package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.Flair3dHype;
import br.com.fashionai.application.flair.Flair3dHype.Band;
import br.com.fashionai.application.flair3d.Contexto;

import java.util.Collection;
import java.util.Set;

/**
 * A Aura muda a partida (rodada 8g; docs/aura/CIRCUITO_AURA.md: os jogos LEEM o Hype e a Aura, nunca escrevem). Regras
 * puras, as mesmas de {@code lib/flair/nucleos/aura-na-partida.ts}:
 *
 * <ul>
 *   <li><b>Plateia (júri) pela faixa de Hype</b>: a média inteira das faixas das peças que pontuam (sinal baixo 0 ...
 *       viral 5) dá {@link #PLATEIA} pontos: 0, 0, 1, 2, 4 ou 6. Nunca tira ponto: carta sem Hype público só não anima.</li>
 *   <li><b>Splash</b> (peça com Aura Splash vestida): o brilho respinga e a plateia lê uma faixa acima.</li>
 *   <li><b>Trunfo do Hype</b> (uma vez por partida, uma carta do deck com Hype Relevante ou mais): o destaque na foto
 *       final soma {@link #TRUNFO} (2 a 5). Na Batalha soma na rodada em que foi chamado e ganha o voto no empate.</li>
 *   <li><b>Electro</b>: cada peça Electro vestida abre a janela da execução {@value #ELECTRO_MS} ms (até
 *       {@value #ELECTRO_TETO_MS}).</li>
 *   <li><b>Comum</b>: pé no chão — o primeiro erro da execução não drena o recurso-vida (os pontos caem igual).</li>
 *   <li><b>Metamorfose</b> (só na carta Especial com Aura Metamorfose): poder com recarga. Na execução, a marca errada
 *       vira "bom", e o poder recarrega por {@value #RECARGA_MARCAS} marcas; na Batalha, a carta vale na regra de
 *       qualquer desafio, e recarrega por {@value #RECARGA_RODADAS} rodada.</li>
 * </ul>
 */
public final class Flair3dAuraRegras {
    public static final String COMMON = "COMMON";
    public static final String ELECTRO = "ELECTRO";
    public static final String SPLASH = "SPLASH";
    public static final String HYPE = "HYPE";
    public static final String METAMORPHOSE = "METAMORPHOSE";
    public static final Set<String> FAMILIAS = Set.of(COMMON, ELECTRO, SPLASH, HYPE, METAMORPHOSE);

    /** Pontos da plateia pela faixa média (índice = ordinal da faixa). */
    static final int[] PLATEIA = {0, 0, 1, 2, 4, 6};
    /** Pontos do destaque do trunfo pela faixa da carta chamada. */
    static final int[] TRUNFO = {0, 0, 2, 3, 4, 5};
    public static final int PLATEIA_TETO = 6;
    public static final int ELECTRO_MS = 150;
    public static final int ELECTRO_TETO_MS = 300;
    public static final int RECARGA_MARCAS = 2;
    public static final int RECARGA_RODADAS = 1;

    /** Os jogos de cartas em que a Aura muda a partida nesta rodada (os de zonas ficam com outra rodada). */
    public static final Set<String> JOGOS = Set.of("PASSARELA", "DRESS_THE_STAR", "PERSONAGEM_FILME", "BOUTIQUE_3D", "BATALHA_LOOKS");

    private Flair3dAuraRegras() {
    }

    public static boolean noJogo(String codigo) {
        return JOGOS.contains(codigo);
    }

    /** A faixa média inteira das peças (sinal baixo sem peça), uma acima quando há Splash vestida. */
    public static Band faixaDaPlateia(Collection<CbcRules.Card> look, Contexto contexto) {
        if (look.isEmpty()) {
            return Band.LOW_SIGNAL;
        }
        int soma = look.stream().mapToInt(c -> Flair3dHype.bandOf(c).ordinal()).sum();
        return Flair3dHype.shifted(Band.values()[soma / look.size()], quantas(look, contexto, SPLASH) > 0 ? 1 : 0);
    }

    public static int plateia(Collection<CbcRules.Card> look, Contexto contexto) {
        return PLATEIA[faixaDaPlateia(look, contexto).ordinal()];
    }

    /** O trunfo só pode ser chamado com Hype Relevante ou mais (o card privado não tem Hype público). */
    public static boolean podeSerTrunfo(CbcRules.Card carta) {
        return Flair3dHype.bandOf(carta).ordinal() >= Band.RELEVANT.ordinal();
    }

    public static int trunfo(CbcRules.Card carta) {
        return carta == null ? 0 : TRUNFO[Flair3dHype.bandOf(carta).ordinal()];
    }

    public static int quantas(Collection<CbcRules.Card> look, Contexto contexto, String familia) {
        return (int) look.stream().filter(c -> familia.equals(contexto.aura(c))).count();
    }

    public static int electroMs(Collection<CbcRules.Card> look, Contexto contexto) {
        return Math.min(ELECTRO_TETO_MS, ELECTRO_MS * quantas(look, contexto, ELECTRO));
    }

    /** A carta Especial com Aura Metamorfose: a única com o poder. */
    public static boolean metamorfose(CbcRules.Card carta, Contexto contexto) {
        return carta != null && "ESPECIAL".equals(carta.tier()) && METAMORPHOSE.equals(contexto.aura(carta));
    }

    public static boolean temMetamorfose(Collection<CbcRules.Card> look, Contexto contexto) {
        return look.stream().anyMatch(c -> metamorfose(c, contexto));
    }
}
