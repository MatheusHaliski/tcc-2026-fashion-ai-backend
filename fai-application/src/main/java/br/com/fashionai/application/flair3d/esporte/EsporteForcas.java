package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dCores;
import br.com.fashionai.application.flair3d.Flair3dPecas;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

/**
 * De onde vem a força de cada jogada do FASHION_SPORTS. O time tem os atributos do uniforme (velocidade, técnica,
 * resistência, defesa e físico); a carta jogada soma o poder dela à ação que a cor dela dispara. Nada aqui olha pele,
 * corpo ou rosto: só material, tipo de peça, nível, OVR e Hype da carta.
 *
 * <ul>
 * <li><b>Físico</b> (novo, pedido da dona em 15/11/2026): um décimo do OVR de cada peça, mais {@link #FIRME} quando o
 * material é firme (couro, jeans, lona, veludo cotelê, nylon, borracha).</li>
 * <li><b>Poder da carta</b>: um décimo do OVR, mais o bônus do nível (Bronze 0, Prata 3, Ouro 6, Especial 10), mais o que a
 * peça soma ao atributo da ação (tênis na corrida, couro na defesa...), mais {@link #HYPE} com Hype 80 ou mais.</li>
 * <li><b>Cansaço</b>: a cada jogada o time perde uma fração da força de base, menor quanto maior a resistência do
 * uniforme; o adversário cansa num ritmo fixo.</li>
 * </ul>
 */
public final class EsporteForcas {
    public static final String PASSE = "PASSE";
    public static final String CORRIDA = "CORRIDA";
    public static final String DRIBLE = "DRIBLE";
    public static final String CHUTE = "CHUTE";
    public static final String DEFESA = "DEFESA";
    public static final String GOLEIRO = "GOLEIRO";
    /** A carta sem cor de ação: um toque curto e seguro, que segura a bola sem avançar. */
    public static final String TOQUE = "TOQUE";
    public static final int FIRME = 7;
    public static final int HYPE = 3;
    public static final int HYPE_ALTO = 80;
    public static final Set<String> FIRMES = Set.of("leather", "denim", "canvas", "corduroy", "nylon", "faux_leather", "rubber");
    public static final Map<String, Integer> NIVEL = Map.of("BRONZE", 0, "PRATA", 3, "OURO", 6, "ESPECIAL", 10);
    public static final double CANSACO_DO_RIVAL = 0.012;

    /** Os atributos do time (o uniforme inteiro). */
    public record Time(int velocidade, int tecnica, int resistencia, int defesa, int fisico) {
        /** A força de base do time na ação. */
        public double base(String acao) {
            return switch (acao) {
                case PASSE -> tecnica;
                case CORRIDA -> velocidade;
                case DRIBLE -> (velocidade + tecnica) / 2.0;
                case CHUTE -> (tecnica + fisico) / 2.0;
                case DEFESA -> (defesa + fisico) / 2.0;
                case GOLEIRO -> defesa;
                default -> tecnica / 2.0;
            };
        }

        /** Fração da força de base que o time perde a cada jogada: de 0,4% (resistência 45 ou mais) a 2,2%. */
        public double cansaco() {
            return Math.max(0.004, Math.min(0.022, 0.022 - resistencia * 0.0004));
        }

        /** Quanto da força de base resta na jogada de índice dado (a partir de 0). */
        public double folego(int jogada) {
            return Math.max(0.5, 1 - jogada * cansaco());
        }
    }

    private EsporteForcas() {
    }

    public static int fisico(CbcRules.Card c) {
        return c.ovr() / 10 + (Flair3dPecas.temMaterial(c, FIRMES) ? FIRME : 0);
    }

    public static Time time(Collection<CbcRules.Card> uniforme) {
        Flair3dAtributos a = Flair3dAtributos.soma(uniforme);
        return new Time(a.velocidade(), a.tecnica(), a.resistencia(), a.defesa(), uniforme.stream().mapToInt(EsporteForcas::fisico).sum());
    }

    /** A ação que a cor da carta dispara (preto defende, verde finaliza, amarelo dribla, azul corre, vermelho passa, branco é o goleiro); sem cor de ação, o toque. */
    public static String acao(CbcRules.Card c) {
        String daCor = Flair3dCores.acao(Flair3dCores.ESPORTE, c);
        return daCor == null ? TOQUE : daCor;
    }

    /** O que a peça soma ao atributo da ação, além do décimo do OVR que toda peça tem. */
    static int afinidade(CbcRules.Card c, String acao) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(c);
        int base = c.ovr() / 10;
        return switch (acao) {
            case PASSE -> a.tecnica() - base;
            case CORRIDA -> a.velocidade() - base;
            case DRIBLE -> (a.velocidade() + a.tecnica()) / 2 - base;
            case CHUTE -> (a.tecnica() + fisico(c)) / 2 - base;
            case DEFESA -> (a.defesa() + fisico(c)) / 2 - base;
            case GOLEIRO -> a.defesa() - base;
            default -> 0;
        };
    }

    /** O poder da carta na ação dela. */
    public static int poder(CbcRules.Card c, String acao) {
        Double hype = c.hype().get("HYP");
        return c.ovr() / 10 + NIVEL.getOrDefault(String.valueOf(c.tier()), 0) + Math.max(0, afinidade(c, acao))
                + (hype != null && hype >= HYPE_ALTO ? HYPE : 0);
    }

    /** O poder da carta na ação que a cor dela dispara (o selo da carta na mão). */
    public static int poder(CbcRules.Card c) {
        return poder(c, acao(c));
    }
}
