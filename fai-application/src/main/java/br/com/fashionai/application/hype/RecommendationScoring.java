package br.com.fashionai.application.hype;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Recomendação multidimensional do Copilot: cada look sugerido carrega quatro números independentes — compatibilidade
 * com o DNA de estilo, Hype (média do v2 das peças), novidade da combinação e reutilização do guarda-roupa — e o MODO
 * escolhido pela pessoa decide o peso de cada um. O Hype nunca passa de 20% do peso: é contexto, não critério único
 * (o FashionAI não vira "use o que está popular").
 */
public final class RecommendationScoring {
    private RecommendationScoring() {
    }

    /** SAFE prioriza o DNA; DISCOVERY mistura o familiar com o novo; EXPERIMENTAL aceita mais distância do histórico. */
    public enum Mode {
        SAFE, DISCOVERY, EXPERIMENTAL;

        public static Mode parse(String raw) {
            if (raw == null || raw.isBlank()) {
                return null;
            }
            return switch (raw.trim().toUpperCase(Locale.ROOT)) {
                case "SAFE", "SEGURO" -> SAFE;
                case "DISCOVERY", "DESCOBERTA" -> DISCOVERY;
                case "EXPERIMENTAL", "EXPERIMENTACAO", "EXPERIMENTAÇÃO" -> EXPERIMENTAL;
                default -> null;
            };
        }
    }

    /** Pesos [compatibilidade, hype, novidade, reutilização] por modo. */
    static final Map<Mode, double[]> WEIGHTS = Map.of(
            Mode.SAFE, new double[]{0.60, 0.10, 0.10, 0.20},
            Mode.DISCOVERY, new double[]{0.35, 0.20, 0.25, 0.20},
            Mode.EXPERIMENTAL, new double[]{0.15, 0.20, 0.45, 0.20});

    /** Valores 0–100; nulo = sem base (ex.: sem DNA definido, peças sem Hype calculado). */
    public record Scores(Integer compatibility, Integer hype, Integer novelty, Integer reuse) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("compatibility", compatibility);
            m.put("hype", hype);
            m.put("novelty", novelty);
            m.put("reuse", reuse);
            return m;
        }
    }

    /** Valor de ordenação do look no modo escolhido (dimensão ausente = neutra, 50). */
    public static double rankValue(Mode mode, Scores s) {
        double[] w = WEIGHTS.get(mode == null ? Mode.SAFE : mode);
        double[] v = {orNeutral(s.compatibility()), orNeutral(s.hype()), orNeutral(s.novelty()), orNeutral(s.reuse())};
        double num = 0, den = 0;
        for (int i = 0; i < w.length; i++) {
            num += w[i] * v[i];
            den += w[i];
        }
        return num / den;
    }

    private static double orNeutral(Integer v) {
        return v == null ? 50 : v;
    }

    /** Chave do par de peças (ordem não importa). */
    public static String pair(UUID a, UUID b) {
        return a.compareTo(b) < 0 ? a + "+" + b : b + "+" + a;
    }

    /** Novidade: fração dos pares de peças que a pessoa ainda NÃO combinou em nenhum look salvo. */
    public static Integer novelty(List<UUID> pieces, Set<String> seenPairs) {
        if (pieces == null || pieces.size() < 2) {
            return null;
        }
        List<String> pairs = new ArrayList<>();
        for (int i = 0; i < pieces.size(); i++) {
            for (int j = i + 1; j < pieces.size(); j++) {
                pairs.add(pair(pieces.get(i), pieces.get(j)));
            }
        }
        long fresh = pairs.stream().filter(p -> !seenPairs.contains(p)).count();
        return (int) Math.round(100.0 * fresh / pairs.size());
    }

    /** Reutilização: quanto o look traz de volta peças paradas (60+ dias sem uso = 100 por peça). */
    public static Integer reuse(List<Long> idleDays) {
        if (idleDays == null || idleDays.isEmpty()) {
            return null;
        }
        return (int) Math.round(100 * idleDays.stream().mapToDouble(d -> Math.min(1.0, Math.max(0, d) / 60.0)).average().orElse(0));
    }
}
