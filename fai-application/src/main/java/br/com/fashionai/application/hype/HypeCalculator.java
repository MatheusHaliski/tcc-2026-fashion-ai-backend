package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.hype.HypeMath.at;
import static br.com.fashionai.application.hype.HypeMath.clamp;
import static br.com.fashionai.application.hype.HypeMath.round;
import static br.com.fashionai.application.hype.HypeMath.sigmoid;
import static br.com.fashionai.application.hype.HypeReasons.reasons;

/**
 * HypeScore v2 — cálculo puro: HypeScore(entidade, tempo) = média ponderada de dimensões normalizadas (0–100), cada uma
 * medindo uma coisa diferente. Nunca soma métricas brutas: contagens viram taxas (engajamento normalizado pelo alcance),
 * razões entre janelas (trend), aceleração (velocidade) ou posição na população pública (popularidade, originalidade).
 *
 * <ul>
 *   <li><b>Popularidade</b> — alcance e uso acumulados (log), em percentil da população pública.</li>
 *   <li><b>Engajamento</b> — interações ÷ alcance, com suavização bayesiana (k impressões "emprestadas" da média), em percentil.</li>
 *   <li><b>Trend</b> — janela atual × anterior com decaimento exp(−λ·idade); 10 mil interações antigas e 2 nesta semana = trend baixo.</li>
 *   <li><b>Velocidade</b> — aceleração do crescimento semana a semana (+4% → +11% → +28% = emergente).</li>
 *   <li><b>Novidade</b> — recência da entidade OU retorno recente à atenção (não é qualidade).</li>
 *   <li><b>Longevidade</b> — semanas com atividade ao longo da vida (sentido oposto ao decaimento: clássicos sobem).</li>
 *   <li><b>Raridade</b> — frequência do modelo entre os guarda-roupas/catálogo (nunca "poucas interações").</li>
 *   <li><b>Originalidade</b> — quão incomum é a combinação de atributos (indicador computacional, não verdade estética).</li>
 *   <li><b>Influência</b> (looks) — remixes e looks derivados; só entra quando existe.</li>
 * </ul>
 */
public class HypeCalculator {
    /** Abaixo disso a população não sustenta percentil: usa a curva absoluta de saturação. */
    static final int MIN_POPULATION = 5;
    static final double DEFAULT_ENGAGEMENT_RATE = 0.3;
    private static final double TREND_SLOPE = 2.5;
    private static final double VELOCITY_SLOPE = 5.0;
    private static final int REVIVAL_IDLE_DAYS = 21;

    private final HypeScoreConfig config;
    /** Medidas brutas da entrada (popularidade acumulada, interações, alcance, taxa suavizada). */
    private final HypeRawMeasures measures;

    public HypeCalculator(HypeScoreConfig config) {
        this.config = config;
        this.measures = new HypeRawMeasures(config);
    }

    /** Régua da população pública do mesmo tipo (privados nunca entram na régua — privacidade). */
    public record Baseline(double[] popularity, double[] engagement, double meanEngagementRate, double[] originality, double[] influence) {
        public static Baseline empty() {
            return new Baseline(new double[0], new double[0], DEFAULT_ENGAGEMENT_RATE, new double[0], new double[0]);
        }
    }

    // ================================================================== régua
    public Baseline baseline(List<HypeInputs> publicPopulation) {
        double[] pop = publicPopulation.stream().mapToDouble(measures::rawPopularity).sorted().toArray();
        double[] rates = publicPopulation.stream().filter(measures::hasEngagementData).mapToDouble(i -> measures.interactions(i) / measures.exposure(i)).toArray();
        double mean = rates.length == 0 ? DEFAULT_ENGAGEMENT_RATE : Arrays.stream(rates).average().orElse(DEFAULT_ENGAGEMENT_RATE);
        double[] eng = publicPopulation.stream().filter(measures::hasEngagementData).mapToDouble(i -> smoothedRate(i, mean)).sorted().toArray();
        double[] orig = publicPopulation.stream().filter(i -> i.surprise() != null).mapToDouble(HypeInputs::surprise).sorted().toArray();
        double[] infl = publicPopulation.stream().filter(i -> i.influenceRaw() != null && i.influenceRaw() > 0)
                .mapToDouble(i -> Math.log1p(i.influenceRaw())).sorted().toArray();
        return new Baseline(pop, eng, mean, orig, infl);
    }

    double rawPopularity(HypeInputs in) {
        return measures.rawPopularity(in);
    }

    /** (I + k·μ) ÷ (E + k): ver {@link HypeRawMeasures#smoothedRate}. */
    double smoothedRate(HypeInputs in, double mean) {
        return measures.smoothedRate(in, mean);
    }

    static boolean isInteraction(HypeSignalType t) {
        return HypeRawMeasures.isInteraction(t);
    }

    // ================================================================== cálculo
    public HypeResult compute(HypeInputs in, Baseline base) {
        Map<Dimension, Double> dims = new EnumMap<>(Dimension.class);
        Map<String, Object> signals = new LinkedHashMap<>();
        int w = config.windowDays();
        double alpha = config.growthSmoothing();
        double lambda = config.decayLambda();

        // popularidade
        dims.put(Dimension.POPULARITY, normalize(rawPopularity(in), base.popularity(), 3.0));

        // engajamento (normalizado pelo alcance)
        if (measures.hasEngagementData(in)) {
            double rate = smoothedRate(in, base.meanEngagementRate());
            signals.put("engagementRate", round(rate, 4));
            dims.put(Dimension.ENGAGEMENT, normalize(rate, base.engagement(), 0.5));
        }

        // trend: janela atual × anterior, mesmas curvas de decaimento nas duas
        double cur = 0, prev = 0, rawCur = 0, rawPrev = 0;
        for (int d = 0; d < w; d++) {
            cur += at(in.dailyActivity(), d) * Math.exp(-lambda * d);
            prev += at(in.dailyActivity(), d + w) * Math.exp(-lambda * d);
            rawCur += at(in.dailyActivity(), d);
            rawPrev += at(in.dailyActivity(), d + w);
        }
        double growth = Math.log((cur + alpha) / (prev + alpha));
        double conf = Math.min(1, (rawCur + rawPrev) / 8.0);
        Double cohortTrend = in.cohortGrowthPercent() == null ? null
                : 100 * sigmoid(TREND_SLOPE * Math.log(Math.max(0.05, 1 + in.cohortGrowthPercent() / 100.0)));
        if (rawCur + rawPrev > 0 || cohortTrend != null) {
            double own = 100 * sigmoid(TREND_SLOPE * growth);
            double trend = cohortTrend != null ? conf * own + (1 - conf) * cohortTrend : 50 + conf * (own - 50);
            dims.put(Dimension.TREND, clamp(trend));
            signals.put("windowCurrent", round(rawCur, 2));
            signals.put("windowPrevious", round(rawPrev, 2));
            signals.put("growthPercent", round(((rawCur + alpha) / (rawPrev + alpha) - 1) * 100, 1));
        }
        if (in.cohortGrowthPercent() != null) {
            signals.put("similarGrowthPercent", round(in.cohortGrowthPercent(), 1));
        }

        // velocidade: aceleração do crescimento semanal (semanas 0..3)
        double[] weeks = new double[4];
        for (int k = 0; k < weeks.length; k++) {
            weeks[k] = sum(in.dailyActivity(), k * w, (k + 1) * w);
        }
        double weeksTotal = Arrays.stream(weeks).sum();
        if (weeksTotal > 0) {
            double g0 = Math.log((weeks[0] + alpha) / (weeks[1] + alpha));
            double g1 = Math.log((weeks[1] + alpha) / (weeks[2] + alpha));
            double g2 = Math.log((weeks[2] + alpha) / (weeks[3] + alpha));
            double accel = g0 - (g1 + g2) / 2;
            double v = 100 * sigmoid(VELOCITY_SLOPE * accel);
            dims.put(Dimension.TREND_VELOCITY, clamp(50 + Math.min(1, weeksTotal / 12.0) * (v - 50)));
            signals.put("weekly", weeks);
        }

        // novidade: recém-chegada OU de volta à atenção depois de um período parado
        double fresh = 100 * Math.pow(0.5, Math.max(0, in.ageDays()) / config.noveltyHalfLifeDays());
        double revival = 0;
        if (rawCur > 0 && in.ageDays() > w + REVIVAL_IDLE_DAYS && sum(in.dailyActivity(), w, w + REVIVAL_IDLE_DAYS) == 0) {
            revival = 75 * Math.min(1, rawCur / 3.0);
            signals.put("revival", true);
        }
        dims.put(Dimension.NOVELTY, clamp(Math.max(fresh, revival)));

        // longevidade: semanas ativas ao longo da vida (dentro do horizonte), só depois de 8 semanas de vida
        double horizonActivity = sum(in.dailyActivity(), 0, in.dailyActivity().length);
        if (horizonActivity > 0 || in.lifetimeInteractions() > 0) {
            int lifeWeeks = Math.max(1, (int) Math.ceil(Math.max(1, in.ageDays()) / (double) w));
            int span = Math.min(lifeWeeks, config.horizonWeeks());
            int active = 0;
            for (int k = 0; k < span; k++) {
                if (sum(in.dailyActivity(), k * w, (k + 1) * w) >= 0.5) {
                    active++;
                }
            }
            double ageFactor = Math.min(1, in.ageDays() / 56.0);
            dims.put(Dimension.LONGEVITY, clamp(100.0 * active / span * ageFactor));
            signals.put("activeWeeks", active);
        }

        // raridade: frequência do modelo (catálogo/coorte), nunca interações; edição limitada tem piso
        if (in.cohortPresence() != null) {
            double rarity = 100 * (1 - Math.pow(Math.min(1, Math.max(0, in.cohortPresence())), 0.35));
            dims.put(Dimension.RARITY, clamp(in.limitedEdition() ? Math.max(rarity, 85) : rarity));
            signals.put("cohortPresence", round(in.cohortPresence(), 4));
        } else if (in.limitedEdition()) {
            dims.put(Dimension.RARITY, 85.0);
        }

        // originalidade (indicador computacional)
        if (in.surprise() != null) {
            dims.put(Dimension.ORIGINALITY, normalize(in.surprise(), base.originality(), 6.0));
        }

        // influência (looks): só quando existe
        if (in.type() == HypeEntityType.SCHEME && in.influenceRaw() != null && in.influenceRaw() > 0) {
            dims.put(Dimension.INFLUENCE, normalize(Math.log1p(in.influenceRaw()), base.influence(), 1.5));
            signals.put("influence", in.influenceRaw());
        }

        dims.replaceAll((k, v) -> round(v, 1));
        double events = in.totalEvents();
        signals.put("events", round(events, 1));
        boolean sufficient = events >= config.minSignalEvents();
        Double score = sufficient ? round(weighted(dims, config.weights(in.type())), 1) : null;
        HypeLevel level = score == null ? null : config.level(score);
        HypeMomentum momentum = sufficient ? momentum(dims) : null;
        HypeStatus status = sufficient ? HypeStatus.AVAILABLE : HypeStatus.INSUFFICIENT_DATA;
        return new HypeResult(status, score, level, dims, momentum, reasons(in, dims, momentum, status, events), signals);
    }

    /** Média ponderada só das dimensões presentes (renormaliza pela soma dos pesos usados). */
    static double weighted(Map<Dimension, Double> dims, Map<Dimension, Double> weights) {
        return HypeAggregation.weighted(dims, weights);
    }

    static HypeMomentum momentum(Map<Dimension, Double> d) {
        return HypeAggregation.momentum(d);
    }

    /** UP / DOWN / STABLE contra o score da base (delta em pontos dentro da faixa "estável" = STABLE). */
    public String direction(double score, Double base) {
        if (base == null) {
            return null;
        }
        double delta = score - base;
        return delta >= config.stablePoints() ? "UP" : delta <= -config.stablePoints() ? "DOWN" : "STABLE";
    }

    // ================================================================== utilitários
    /** Percentil (midrank) na população; população pequena usa a curva absoluta 100·(1−e^(−x/escala)). */
    static double normalize(double value, double[] sorted, double absoluteScale) {
        return HypeMath.normalize(value, sorted, absoluteScale);
    }

    static double sum(double[] a, int from, int to) {
        return HypeMath.sum(a, from, to);
    }
}
