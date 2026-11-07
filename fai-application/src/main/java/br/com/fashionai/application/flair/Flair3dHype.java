package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Evaluation;
import br.com.fashionai.application.flair.CbcRules.SlotResult;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import static br.com.fashionai.application.flair.CbcRules.intOf;

/**
 * FLAIR 3D MAKE UP — o Hype dentro da partida, puro e sem escrita: a faixa de uma carta pela nota HYP do retrato, o teto
 * ({@code mandatoryMax}: só rebaixa, nunca reprova), o bônus de jogada ({@code hype.play}) e o deslocamento da faixa de
 * partida ({@code hype.partial}).
 *
 * <p>Limiares (coerentes com o HypeScoreConfig padrão): NICHE ≥ 20, RELEVANT ≥ 40, HOT ≥ 60, TRENDING ≥ 75, VIRAL ≥ 90;
 * carta sem HYP público = LOW_SIGNAL.</p>
 */
public final class Flair3dHype {
    private Flair3dHype() {
    }

    public enum Band { LOW_SIGNAL, NICHE, RELEVANT, HOT, TRENDING, VIRAL }

    public static final double[] THRESHOLDS = {20, 40, 60, 75, 90};
    public static final List<String> PLAY_MODES = List.of("NONE", "BONUS_ABOVE_RELEVANT", "LOW_IS_GOOD", "DIMENSION", "TIEBREAK");
    public static final List<String> PARTIAL_MODES = List.of("NONE", "UP_ONLY", "UP_DOWN", "ALL_UP_IF_COMPLETE");
    public static final int DEFAULT_CAP = 3;
    public static final int DEFAULT_LOW_BONUS = 2;
    public static final int DEFAULT_PER = 25;

    public static Band bandOf(Card card) {
        Double hyp = card == null ? null : card.hype().get("HYP");
        return hyp == null ? Band.LOW_SIGNAL : bandOf(hyp);
    }

    public static Band bandOf(double score) {
        int i = 0;
        while (i < THRESHOLDS.length && score >= THRESHOLDS[i]) {
            i++;
        }
        return Band.values()[i];
    }

    /** Nome de faixa vindo do JSON ({@code null}/inválido → {@code def}). */
    public static Band parse(Object v, Band def) {
        if (v == null) {
            return def;
        }
        try {
            return Band.valueOf(String.valueOf(v).trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return def;
        }
    }

    /** O teto das obrigatórias só rebaixa: a carta VIRAL num jogo com teto TRENDING joga como TRENDING. */
    public static Band clampMax(Band band, Band max) {
        if (band == null) {
            return Band.LOW_SIGNAL;
        }
        return max != null && band.ordinal() > max.ordinal() ? max : band;
    }

    public static Band shifted(Band band, int delta) {
        int i = Math.max(0, Math.min(Band.values().length - 1, (band == null ? 0 : band.ordinal()) + delta));
        return Band.values()[i];
    }

    /**
     * Bônus de jogada de uma carta: NONE/TIEBREAK 0; BONUS_ABOVE_RELEVANT +1 por faixa acima de RELEVANT (até {@code cap},
     * padrão 3) depois do teto; LOW_IS_GOOD dá {@code bonus} (padrão 2) a LOW_SIGNAL/NICHE; DIMENSION +1 a cada {@code per}
     * pontos (padrão 25) da dimensão {@code dim}, até {@code cap}.
     */
    public static int playBonus(Card card, Map<String, Object> playRule, Band mandatoryMax) {
        Map<String, Object> rule = playRule == null ? Map.of() : playRule;
        String mode = String.valueOf(rule.getOrDefault("mode", "NONE")).toUpperCase(Locale.ROOT);
        Band band = clampMax(bandOf(card), mandatoryMax);
        return switch (mode) {
            case "BONUS_ABOVE_RELEVANT" -> Math.min(intOf(rule.get("cap"), DEFAULT_CAP), Math.max(0, band.ordinal() - Band.RELEVANT.ordinal()));
            case "LOW_IS_GOOD" -> band.ordinal() <= Band.NICHE.ordinal() ? intOf(rule.get("bonus"), DEFAULT_LOW_BONUS) : 0;
            case "DIMENSION" -> dimensionBonus(card, rule);
            default -> 0;
        };
    }

    private static int dimensionBonus(Card card, Map<String, Object> rule) {
        String dim = String.valueOf(rule.getOrDefault("dim", "HYP")).toUpperCase(Locale.ROOT);
        int per = Math.max(1, intOf(rule.get("per"), DEFAULT_PER));
        Double value = card == null ? null : card.hype().get(dim);
        int steps = value == null ? 0 : (int) Math.floor(value / per);
        return Math.min(intOf(rule.get("cap"), DEFAULT_CAP), Math.max(0, steps));
    }

    /**
     * Deslocamento da faixa de partida de uma vaga: NONE 0; UP_ONLY +1 com sintonia ≥ 2; UP_DOWN +1 com sintonia ≥ 2 e −1 com
     * carta em sintonia 0; ALL_UP_IF_COMPLETE +1 para todas quando a montagem está completa.
     */
    public static int partialShift(SlotResult r, Map<String, Object> partialRule, boolean complete) {
        Map<String, Object> rule = partialRule == null ? Map.of() : partialRule;
        String mode = String.valueOf(rule.getOrDefault("mode", "NONE")).toUpperCase(Locale.ROOT);
        boolean placed = r != null && r.cardId() != null;
        int sintonia = r == null ? 0 : r.sintonia();
        return switch (mode) {
            case "UP_ONLY" -> placed && sintonia >= 2 ? 1 : 0;
            case "UP_DOWN" -> placed && sintonia >= 2 ? 1 : placed && sintonia == 0 ? -1 : 0;
            case "ALL_UP_IF_COMPLETE" -> complete ? 1 : 0;
            default -> 0;
        };
    }

    /** "Perfeito" (R2): requisitos cumpridos e sintonia ≥ 2 por vaga obrigatória — atingível sem o ponto de tema. */
    public static boolean perfect(Evaluation ev, int requiredSlots) {
        return ev != null && ev.ok() && ev.sintonia() >= 2 * requiredSlots;
    }
}
