package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.SlotResult;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * FLAIR 3D MAKE UP — erros do jogador numa vaga preenchida, puro. Cada erro tira pontos do placar FLAIR 3D MAKE UP da partida (o placar
 * nunca fica negativo) e a cena mostra a falha no objeto da vaga:
 * <ul>
 *   <li>{@code REFUSED} −2: a vaga recusa a carta (filtro de nível, marca, cor…); a entrega fica bloqueada;</li>
 *   <li>{@code MISPLACED} −1: carta fora da posição da vaga; ela também não aciona Metamorfose nem Impersonation;</li>
 *   <li>{@code NO_SINTONIA} −1: carta sem nenhuma sintonia (posição, vizinha em harmonia ou tema);</li>
 *   <li>{@code OVEREXPOSED} −1: Hype da carta acima do máximo obrigatório do jogo (a faixa já é cortada no máximo).</li>
 * </ul>
 * Nada sai da carteira (FAI Points e coins): pela regra ética do FLAIR o erro custa placar, faixa de Hype da partida,
 * bônus de montagem perfeita e a recompensa especial, nunca saldo.
 */
public final class Flair3dPenalties {
    private Flair3dPenalties() {
    }

    public enum Code {
        REFUSED(2), MISPLACED(1), NO_SINTONIA(1), OVEREXPOSED(1);

        private final int points;

        Code(int points) {
            this.points = points;
        }

        public int points() {
            return points;
        }
    }

    public record Penalty(Code code, int points) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", code.name());
            m.put("points", points);
            return m;
        }
    }

    /** Erros da vaga preenchida; vaga vazia não tem erro (só não pontua). */
    public static List<Penalty> of(SlotResult r, Flair3dHype.Band cardBand, Flair3dHype.Band mandatoryMax) {
        List<Penalty> out = new ArrayList<>();
        if (r == null || r.cardId() == null) {
            return out;
        }
        if (!r.accepted()) {
            out.add(penalty(Code.REFUSED));
        }
        if (!r.positionOk()) {
            out.add(penalty(Code.MISPLACED));
        }
        if (r.sintonia() == 0) {
            out.add(penalty(Code.NO_SINTONIA));
        }
        if (cardBand != null && mandatoryMax != null && cardBand.ordinal() > mandatoryMax.ordinal()) {
            out.add(penalty(Code.OVEREXPOSED));
        }
        return out;
    }

    public static int total(List<Penalty> penalties) {
        return penalties == null ? 0 : penalties.stream().mapToInt(Penalty::points).sum();
    }

    /** Placar FLAIR 3D MAKE UP com os erros descontados, nunca abaixo de zero. */
    public static int score(int sintonia, int hypeTotal, int effectTotal, int penaltyTotal) {
        return Math.max(0, sintonia + hypeTotal + effectTotal - penaltyTotal);
    }

    private static Penalty penalty(Code code) {
        return new Penalty(code, code.points());
    }
}
