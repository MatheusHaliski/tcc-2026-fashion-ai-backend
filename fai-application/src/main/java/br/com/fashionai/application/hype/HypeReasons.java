package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeResult.HypeReason;
import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.hype.HypeMath.round;

/**
 * HypeScore v2 — explicabilidade: os motivos do resultado (dados insuficientes, perfil, crescimento por sinal, coorte,
 * edição limitada e dimensões fortes/fracas), no máximo 8, sem afirmação de qualidade.
 */
final class HypeReasons {
    private HypeReasons() {
    }

    private static final Map<HypeSignalType, String> GROWTH_CODE = Map.of(
            HypeSignalType.SAVE_CREATED, "SAVES", HypeSignalType.LIKE_CREATED, "LIKES", HypeSignalType.SHARE_CREATED, "SHARES",
            HypeSignalType.COMMENT_CREATED, "COMMENTS", HypeSignalType.PIECE_IN_LOOK, "LOOK_APPEARANCES", HypeSignalType.PIECE_USED, "USES",
            HypeSignalType.LOOK_REMIXED, "REMIXES", HypeSignalType.LOOK_WORN, "WEARS", HypeSignalType.LOOK_VIEWED, "VIEWS",
            HypeSignalType.PIECE_VIEWED, "VIEWS");

    static List<HypeReason> reasons(HypeInputs in, Map<Dimension, Double> d, HypeMomentum momentum, HypeStatus status, double events) {
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
}
