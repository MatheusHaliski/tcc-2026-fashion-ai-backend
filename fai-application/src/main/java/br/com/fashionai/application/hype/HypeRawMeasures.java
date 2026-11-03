package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.enums.HypeSignalType;

import java.util.Map;

import static br.com.fashionai.application.hype.HypeMath.sum;

/**
 * HypeScore v2 — medidas brutas de UMA entrada, antes da normalização: popularidade acumulada (log), interações,
 * alcance e a taxa de engajamento suavizada. Usadas tanto na régua da população quanto no cálculo da entidade.
 */
final class HypeRawMeasures {
    private final HypeScoreConfig config;

    HypeRawMeasures(HypeScoreConfig config) {
        this.config = config;
    }

    double rawPopularity(HypeInputs in) {
        return Math.log1p(sum(in.dailyActivity(), 0, in.dailyActivity().length) + in.lifetimeInteractions() + 0.1 * in.lifetimeViews());
    }

    double interactions(HypeInputs in) {
        return sum(in.dailyInteractions(), 0, in.dailyInteractions().length);
    }

    /** Alcance: visualizações no horizonte; quem interagiu também viu (piso = nº de interações). */
    double exposure(HypeInputs in) {
        double views = sum(in.dailyViews(), 0, in.dailyViews().length);
        double rawInteractions = 0;
        for (Map.Entry<HypeSignalType, double[]> e : in.windows().entrySet()) {
            if (isInteraction(e.getKey())) {
                rawInteractions += e.getValue()[0] + e.getValue()[1];
            }
        }
        return Math.max(views, Math.max(rawInteractions, 1));
    }

    boolean hasEngagementData(HypeInputs in) {
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
}
