package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * HypeScore v2 — configuração central (pesos, janelas, decaimento, faixas, integridade). Nenhuma fórmula ou peso fica
 * nos componentes ou nos serviços: mudar um valor aqui que altere o resultado exige trocar {@link #algorithmVersion()}
 * (HYPE_V2 → HYPE_V3), para o histórico não misturar séries calculadas com regras diferentes.
 *
 * <p>Os pesos iniciais NÃO são definitivos: são o ponto de partida documentado em HYPESCORE_ARCHITECTURE.md §4 e podem
 * ser ajustados por propriedade ({@code fashionai.hype.weights.piece=popularity=0.20,engagement=0.18,...}).</p>
 */
@Component
public class HypeScoreConfig {
    /** Dimensões do HypeScore v2, na ordem de exibição. */
    public enum Dimension {
        POPULARITY, ENGAGEMENT, TREND, TREND_VELOCITY, ORIGINALITY, RARITY, LONGEVITY, NOVELTY, INFLUENCE
    }

    public static final String DEFAULT_VERSION = "HYPE_V2";
    static final String DEFAULT_PIECE_WEIGHTS = "popularity=0.20,engagement=0.18,trend=0.18,trend_velocity=0.12,originality=0.10,rarity=0.08,longevity=0.08,novelty=0.06";
    /** look: mesmos pesos base + influência (remixes e looks derivados); a média renormaliza pela soma dos pesos presentes */
    static final String DEFAULT_LOOK_WEIGHTS = DEFAULT_PIECE_WEIGHTS + ",influence=0.08";
    /**
     * Peso de cada sinal na "atividade" (trend, velocidade, longevidade) e nas interações (engajamento). Ações de mais
     * esforço valem mais (mesma lógica do v1: L=1, C=3, S=5, R=8, aqui suavizada); visualização quase não pesa.
     */
    static final String DEFAULT_SIGNAL_WEIGHTS = "LIKE_CREATED=1,COMMENT_CREATED=2,SAVE_CREATED=2,SHARE_CREATED=3,FAVORITE_CREATED=1.5,"
            + "LOOK_REMIXED=4,PIECE_REMIXED=3,LOOK_VIEWED=0.1,PIECE_VIEWED=0.1,PIECE_USED=1,PIECE_IN_LOOK=1.5,LOOK_WORN=1";

    private final String algorithmVersion;
    private final Map<Dimension, Double> pieceWeights;
    private final Map<Dimension, Double> lookWeights;
    private final Map<HypeSignalType, Double> signalWeights;
    private final int windowDays;
    private final int horizonWeeks;
    private final double decayHalfLifeDays;
    private final double noveltyHalfLifeDays;
    private final double minSignalEvents;
    private final double growthSmoothing;
    private final double engagementPrior;
    private final int[] levelThresholds;
    private final double stablePoints;
    private final int deltaWindowDays;
    private final int staleAfterHours;
    private final int newAccountDays;
    private final double newAccountWeight;
    private final int historyMaxDays;

    public HypeScoreConfig(@Value("${fashionai.hype.algorithm-version:" + DEFAULT_VERSION + "}") String algorithmVersion,
                           @Value("${fashionai.hype.weights.piece:" + DEFAULT_PIECE_WEIGHTS + "}") String pieceWeights,
                           @Value("${fashionai.hype.weights.look:" + DEFAULT_LOOK_WEIGHTS + "}") String lookWeights,
                           @Value("${fashionai.hype.weights.signals:" + DEFAULT_SIGNAL_WEIGHTS + "}") String signalWeights,
                           @Value("${fashionai.hype.window-days:7}") int windowDays,
                           @Value("${fashionai.hype.horizon-weeks:12}") int horizonWeeks,
                           @Value("${fashionai.hype.decay-half-life-days:7}") double decayHalfLifeDays,
                           @Value("${fashionai.hype.novelty-half-life-days:30}") double noveltyHalfLifeDays,
                           @Value("${fashionai.hype.min-signal-events:3}") double minSignalEvents,
                           @Value("${fashionai.hype.growth-smoothing:3}") double growthSmoothing,
                           @Value("${fashionai.hype.engagement-prior:20}") double engagementPrior,
                           @Value("${fashionai.hype.level-thresholds:20,40,60,75,90}") String levelThresholds,
                           @Value("${fashionai.hype.stable-points:2}") double stablePoints,
                           @Value("${fashionai.hype.delta-window-days:7}") int deltaWindowDays,
                           @Value("${fashionai.hype.stale-after-hours:24}") int staleAfterHours,
                           @Value("${fashionai.hype.integrity.new-account-days:7}") int newAccountDays,
                           @Value("${fashionai.hype.integrity.new-account-weight:0.5}") double newAccountWeight,
                           @Value("${fashionai.hype.history-max-days:365}") int historyMaxDays) {
        this.algorithmVersion = algorithmVersion;
        this.pieceWeights = dimensions(pieceWeights);
        this.lookWeights = dimensions(lookWeights);
        this.signalWeights = signals(signalWeights);
        this.windowDays = Math.max(1, windowDays);
        this.horizonWeeks = Math.max(4, horizonWeeks);
        this.decayHalfLifeDays = Math.max(0.5, decayHalfLifeDays);
        this.noveltyHalfLifeDays = Math.max(1, noveltyHalfLifeDays);
        this.minSignalEvents = Math.max(1, minSignalEvents);
        this.growthSmoothing = Math.max(0.5, growthSmoothing);
        this.engagementPrior = Math.max(1, engagementPrior);
        this.levelThresholds = thresholds(levelThresholds);
        this.stablePoints = Math.max(0, stablePoints);
        this.deltaWindowDays = Math.max(1, deltaWindowDays);
        this.staleAfterHours = Math.max(1, staleAfterHours);
        this.newAccountDays = Math.max(0, newAccountDays);
        this.newAccountWeight = Math.min(1, Math.max(0, newAccountWeight));
        this.historyMaxDays = Math.max(30, historyMaxDays);
    }

    /** Valores padrão (testes e documentação). */
    public static HypeScoreConfig defaults() {
        return new HypeScoreConfig(DEFAULT_VERSION, DEFAULT_PIECE_WEIGHTS, DEFAULT_LOOK_WEIGHTS, DEFAULT_SIGNAL_WEIGHTS, 7, 12, 7, 30, 3, 3, 20,
                "20,40,60,75,90", 2, 7, 24, 7, 0.5, 365);
    }

    static Map<Dimension, Double> dimensions(String spec) {
        Map<Dimension, Double> out = new EnumMap<>(Dimension.class);
        for (Map.Entry<String, Double> e : pairs(spec).entrySet()) {
            try {
                out.put(Dimension.valueOf(e.getKey().toUpperCase(Locale.ROOT)), e.getValue());
            } catch (IllegalArgumentException ignored) {
                // dimensão desconhecida na propriedade: ignorada (não derruba o boot)
            }
        }
        return Collections.unmodifiableMap(out);
    }

    static Map<HypeSignalType, Double> signals(String spec) {
        Map<HypeSignalType, Double> out = new EnumMap<>(HypeSignalType.class);
        for (Map.Entry<String, Double> e : pairs(spec).entrySet()) {
            try {
                out.put(HypeSignalType.valueOf(e.getKey().toUpperCase(Locale.ROOT)), e.getValue());
            } catch (IllegalArgumentException ignored) {
                // sinal desconhecido: ignorado
            }
        }
        return Collections.unmodifiableMap(out);
    }

    private static Map<String, Double> pairs(String spec) {
        Map<String, Double> out = new LinkedHashMap<>();
        if (spec == null) {
            return out;
        }
        for (String part : spec.split(",")) {
            String[] kv = part.trim().split("=");
            if (kv.length == 2) {
                try {
                    out.put(kv[0].trim(), Math.max(0, Double.parseDouble(kv[1].trim())));
                } catch (NumberFormatException ignored) {
                    // valor inválido: ignorado
                }
            }
        }
        return out;
    }

    private static int[] thresholds(String spec) {
        int[] fallback = {20, 40, 60, 75, 90};
        if (spec == null) {
            return fallback;
        }
        String[] parts = spec.split(",");
        if (parts.length != fallback.length) {
            return fallback;
        }
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            try {
                out[i] = Integer.parseInt(parts[i].trim());
            } catch (NumberFormatException e) {
                return fallback;
            }
            if (i > 0 && out[i] <= out[i - 1]) {
                return fallback;
            }
        }
        return out;
    }

    /** Classificação semântica do score (0–19 LOW_SIGNAL · 20–39 NICHE · 40–59 RELEVANT · 60–74 HOT · 75–89 TRENDING · 90–100 VIRAL). */
    public HypeLevel level(double score) {
        HypeLevel[] levels = HypeLevel.values();
        int s = (int) Math.round(score);   // a faixa segue o número exibido (inteiro arredondado)
        for (int i = levelThresholds.length - 1; i >= 0; i--) {
            if (s >= levelThresholds[i]) {
                return levels[i + 1];
            }
        }
        return levels[0];
    }

    public Map<Dimension, Double> weights(HypeEntityType type) {
        return type == HypeEntityType.SCHEME ? lookWeights : pieceWeights;
    }

    public double signalWeight(HypeSignalType type) {
        return signalWeights.getOrDefault(type, 0.0);
    }

    /** λ do decaimento exponencial (recentWeight = exp(−λ · idade em dias)). */
    public double decayLambda() {
        return Math.log(2) / decayHalfLifeDays;
    }

    public String algorithmVersion() {
        return algorithmVersion;
    }

    public int windowDays() {
        return windowDays;
    }

    public int horizonWeeks() {
        return horizonWeeks;
    }

    public int horizonDays() {
        return horizonWeeks * windowDays;
    }

    public double noveltyHalfLifeDays() {
        return noveltyHalfLifeDays;
    }

    public double minSignalEvents() {
        return minSignalEvents;
    }

    public double growthSmoothing() {
        return growthSmoothing;
    }

    public double engagementPrior() {
        return engagementPrior;
    }

    public int[] levelThresholds() {
        return levelThresholds.clone();
    }

    public double stablePoints() {
        return stablePoints;
    }

    public int deltaWindowDays() {
        return deltaWindowDays;
    }

    public int staleAfterHours() {
        return staleAfterHours;
    }

    public int newAccountDays() {
        return newAccountDays;
    }

    public double newAccountWeight() {
        return newAccountWeight;
    }

    public int historyMaxDays() {
        return historyMaxDays;
    }

    /** Descrição pública da configuração ativa (GET /api/hype/method). */
    public Map<String, Object> describe() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("algorithmVersion", algorithmVersion);
        m.put("weights", Map.of("PIECE", named(pieceWeights), "SCHEME", named(lookWeights)));
        Map<String, Double> sig = new LinkedHashMap<>();
        signalWeights.forEach((k, v) -> sig.put(k.name(), v));
        m.put("signalWeights", sig);
        m.put("windowDays", windowDays);
        m.put("horizonWeeks", horizonWeeks);
        m.put("decayHalfLifeDays", decayHalfLifeDays);
        m.put("noveltyHalfLifeDays", noveltyHalfLifeDays);
        m.put("minSignalEvents", minSignalEvents);
        m.put("levelThresholds", levelThresholds.clone());
        m.put("deltaWindowDays", deltaWindowDays);
        m.put("staleAfterHours", staleAfterHours);
        return m;
    }

    private static Map<String, Double> named(Map<Dimension, Double> w) {
        Map<String, Double> out = new LinkedHashMap<>();
        w.forEach((k, v) -> out.put(k.name(), v));
        return out;
    }
}
