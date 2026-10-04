package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeResult.HypeReason;
import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    public HypeCalculator(HypeScoreConfig config) {
        this.config = config;
    }

    /** Régua da população pública do mesmo tipo (privados nunca entram na régua — privacidade). */
    public record Baseline(double[] popularity, double[] engagement, double meanEngagementRate, double[] originality, double[] influence) {
        public static Baseline empty() {
            return new Baseline(new double[0], new double[0], DEFAULT_ENGAGEMENT_RATE, new double[0], new double[0]);
        }
    }

    // ================================================================== régua
    public Baseline baseline(List<HypeInputs> publicPopulation) {
        double[] pop = publicPopulation.stream().mapToDouble(this::rawPopularity).sorted().toArray();
        double[] rates = publicPopulation.stream().filter(this::hasEngagementData).mapToDouble(i -> interactions(i) / exposure(i)).toArray();
        double mean = rates.length == 0 ? DEFAULT_ENGAGEMENT_RATE : Arrays.stream(rates).average().orElse(DEFAULT_ENGAGEMENT_RATE);
        double[] eng = publicPopulation.stream().filter(this::hasEngagementData).mapToDouble(i -> smoothedRate(i, mean)).sorted().toArray();
        double[] orig = publicPopulation.stream().filter(i -> i.surprise() != null).mapToDouble(HypeInputs::surprise).sorted().toArray();
        double[] infl = publicPopulation.stream().filter(i -> i.influenceRaw() != null && i.influenceRaw() > 0)
                .mapToDouble(i -> Math.log1p(i.influenceRaw())).sorted().toArray();
        return new Baseline(pop, eng, mean, orig, infl);
    }

    double rawPopularity(HypeInputs in) {
        return Math.log1p(sum(in.dailyActivity(), 0, in.dailyActivity().length) + in.lifetimeInteractions() + 0.1 * in.lifetimeViews());
    }

    private double interactions(HypeInputs in) {
        return sum(in.dailyInteractions(), 0, in.dailyInteractions().length);
    }

    /** Alcance: visualizações no horizonte; quem interagiu também viu (piso = nº de interações). */
    private double exposure(HypeInputs in) {
        double views = sum(in.dailyViews(), 0, in.dailyViews().length);
        double rawInteractions = 0;
        for (Map.Entry<HypeSignalType, double[]> e : in.windows().entrySet()) {
            if (isInteraction(e.getKey())) {
                rawInteractions += e.getValue()[0] + e.getValue()[1];
            }
        }
        return Math.max(views, Math.max(rawInteractions, 1));
    }

    private boolean hasEngagementData(HypeInputs in) {
        return interactions(in) > 0 || sum(in.dailyViews(), 0, in.dailyViews().length) > 0;
    }

    /** (I + k·μ) ÷ (E + k): 2 interações em 2 visualizações não viram 100%; a média da comunidade "segura" amostras pequenas. */
    double smoothedRate(HypeInputs in, double mean) {
        double k = config.engagementPrior();
        return (interactions(in) + k * mean) / (exposure(in) + k);
    }

    static boolean isInteraction(HypeSignalType t) {
        return switch (t) {
            case LIKE_CREATED, COMMENT_CREATED, SAVE_CREATED, SHARE_CREATED, FAVORITE_CREATED, LOOK_REMIXED, PIECE_REMIXED -> true;
            default -> false;
        };
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
        if (hasEngagementData(in)) {
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
        double events = in.totalEvents() + in.lifetimeInteractions();
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
        double num = 0, den = 0;
        for (Map.Entry<Dimension, Double> e : dims.entrySet()) {
            double wgt = weights.getOrDefault(e.getKey(), 0.0);
            if (wgt > 0 && e.getValue() != null) {
                num += wgt * e.getValue();
                den += wgt;
            }
        }
        return den == 0 ? 0 : clamp(num / den);
    }

    static HypeMomentum momentum(Map<Dimension, Double> d) {
        double trend = d.getOrDefault(Dimension.TREND, 50.0);
        double velocity = d.getOrDefault(Dimension.TREND_VELOCITY, 50.0);
        double popularity = d.getOrDefault(Dimension.POPULARITY, 0.0);
        double longevity = d.getOrDefault(Dimension.LONGEVITY, 0.0);
        if (trend >= 70 && velocity >= 65 && popularity < 60) {
            return HypeMomentum.EMERGING;
        }
        if (trend >= 60) {
            return HypeMomentum.RISING;
        }
        if (longevity >= 75 && trend > 35) {
            return HypeMomentum.CLASSIC;
        }
        if (trend <= 40) {
            return HypeMomentum.COOLING;
        }
        return HypeMomentum.STABLE;
    }

    /** UP / DOWN / STABLE contra o score da base (delta em pontos dentro da faixa "estável" = STABLE). */
    public String direction(double score, Double base) {
        if (base == null) {
            return null;
        }
        double delta = score - base;
        return delta >= config.stablePoints() ? "UP" : delta <= -config.stablePoints() ? "DOWN" : "STABLE";
    }

    // ================================================================== explicabilidade
    private static final Map<HypeSignalType, String> GROWTH_CODE = Map.of(
            HypeSignalType.SAVE_CREATED, "SAVES", HypeSignalType.LIKE_CREATED, "LIKES", HypeSignalType.SHARE_CREATED, "SHARES",
            HypeSignalType.COMMENT_CREATED, "COMMENTS", HypeSignalType.PIECE_IN_LOOK, "LOOK_APPEARANCES", HypeSignalType.PIECE_USED, "USES",
            HypeSignalType.LOOK_REMIXED, "REMIXES", HypeSignalType.LOOK_WORN, "WEARS", HypeSignalType.LOOK_VIEWED, "VIEWS",
            HypeSignalType.PIECE_VIEWED, "VIEWS");

    List<HypeReason> reasons(HypeInputs in, Map<Dimension, Double> d, HypeMomentum momentum, HypeStatus status, double events) {
        List<HypeReason> out = new ArrayList<>();
        if (status == HypeStatus.INSUFFICIENT_DATA) {
            out.add(new HypeReason("INSUFFICIENT_DATA", "NEUTRAL", null, round(events, 0)));
        }
        double pop = d.getOrDefault(Dimension.POPULARITY, 0.0), trend = d.getOrDefault(Dimension.TREND, 50.0);
        if (pop >= 70 && trend < 55) {   // "muito popular, mas não crescendo" (estável ou caindo)
            out.add(new HypeReason("POPULAR_NOT_GROWING", "NEUTRAL", "TREND", trend));
        } else if (pop <= 55 && trend >= 70) {
            out.add(new HypeReason("SMALL_BUT_GROWING", "POSITIVE", "TREND", trend));
        }
        if (momentum == HypeMomentum.CLASSIC) {
            out.add(new HypeReason("CLASSIC_PROFILE", "POSITIVE", "LONGEVITY", d.get(Dimension.LONGEVITY)));
        } else if (momentum == HypeMomentum.EMERGING) {
            out.add(new HypeReason("EMERGING_PROFILE", "POSITIVE", "TREND_VELOCITY", d.get(Dimension.TREND_VELOCITY)));
        }
        // crescimento por sinal (janela atual × anterior): "43% mais saves nos últimos 7 dias"
        List<HypeReason> growth = new ArrayList<>();
        Map<String, double[]> merged = new LinkedHashMap<>();
        in.windows().forEach((sig, v) -> {
            String code = GROWTH_CODE.get(sig);
            if (code != null) {
                double[] acc = merged.computeIfAbsent(code, k -> new double[2]);
                acc[0] += v[0];
                acc[1] += v[1];
            }
        });
        merged.forEach((code, v) -> {
            if (v[0] >= 2 && v[1] == 0) {
                growth.add(new HypeReason(code + "_NEW", "POSITIVE", null, v[0]));
            } else if (v[0] >= 2 && v[0] > v[1]) {
                double pct = (v[0] - v[1]) / v[1] * 100;
                if (pct >= 20) {
                    growth.add(new HypeReason(code + "_GROWTH", "POSITIVE", null, round(pct, 0)));
                }
            } else if (v[1] >= 3 && v[0] < v[1]) {
                double pct = (v[1] - v[0]) / v[1] * 100;
                if (pct >= 30) {
                    growth.add(new HypeReason(code + "_DECLINE", "NEGATIVE", null, round(pct, 0)));
                }
            }
        });
        growth.sort(Comparator.comparing((HypeReason r) -> r.tone().equals("POSITIVE") ? 0 : 1).thenComparing(r -> -(r.value() == null ? 0 : r.value())));
        out.addAll(growth);
        if (in.cohortGrowthPercent() != null && Math.abs(in.cohortGrowthPercent()) >= 15) {
            out.add(new HypeReason(in.cohortGrowthPercent() > 0 ? "SIMILAR_GROWTH" : "SIMILAR_DECLINE", in.cohortGrowthPercent() > 0 ? "POSITIVE" : "NEGATIVE",
                    "TREND", round(Math.abs(in.cohortGrowthPercent()), 0)));
        }
        if (in.limitedEdition()) {
            out.add(new HypeReason("LIMITED_EDITION", "POSITIVE", "RARITY", null));
        }
        // dimensões fortes e fracas (sem afirmação de qualidade: "forte crescimento", "novidade reduzida")
        for (Dimension dim : Dimension.values()) {
            Double v = d.get(dim);
            if (v == null) {
                continue;
            }
            double strong = dim == Dimension.TREND_VELOCITY ? 65 : dim == Dimension.INFLUENCE ? 60 : dim == Dimension.LONGEVITY ? 75 : 70;
            if (v >= strong) {
                out.add(new HypeReason(dim.name() + "_STRONG", "POSITIVE", dim.name(), v));
            } else if (v <= 30 && dim != Dimension.RARITY && dim != Dimension.TREND_VELOCITY) {
                out.add(new HypeReason(dim.name() + "_LOW", "NEGATIVE", dim.name(), v));
            } else if (v < 55 && (dim == Dimension.ORIGINALITY || dim == Dimension.NOVELTY)) {
                out.add(new HypeReason(dim.name() + "_MODERATE", "NEUTRAL", dim.name(), v));
            }
        }
        return out.size() > 8 ? out.subList(0, 8) : out;
    }

    // ================================================================== utilitários
    /** Percentil (midrank) na população; população pequena usa a curva absoluta 100·(1−e^(−x/escala)). */
    static double normalize(double value, double[] sorted, double absoluteScale) {
        if (sorted == null || sorted.length < MIN_POPULATION) {
            return clamp(100 * (1 - Math.exp(-Math.max(0, value) / absoluteScale)));
        }
        int below = 0, equal = 0;
        for (double v : sorted) {
            if (v < value - 1e-9) {
                below++;
            } else if (Math.abs(v - value) <= 1e-9) {
                equal++;
            }
        }
        return clamp(100.0 * (below + 0.5 * equal) / sorted.length);
    }

    static double sigmoid(double x) {
        return 1 / (1 + Math.exp(-x));
    }

    static double clamp(double v) {
        return Double.isNaN(v) ? 0 : Math.max(0, Math.min(100, v));
    }

    static double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }

    static double at(double[] a, int i) {
        return a != null && i >= 0 && i < a.length ? a[i] : 0;
    }

    static double sum(double[] a, int from, int to) {
        double s = 0;
        for (int i = Math.max(0, from); a != null && i < Math.min(a.length, to); i++) {
            s += a[i];
        }
        return s;
    }
}
