package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.enums.HypeMomentum;

import java.util.Map;

import static br.com.fashionai.application.hype.HypeMath.clamp;

/** HypeScore v2 — das dimensões ao resultado: a média ponderada (o score) e o momento (emergente, em alta, clássico…). */
final class HypeAggregation {
    private HypeAggregation() {
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
}
