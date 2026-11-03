package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreSnapshot;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/** HypeScore v2 — mapeamento puro do estado gravado para a resposta: dimensões, números com uma casa e pontos do histórico. */
final class HypeCards {
    private HypeCards() {
    }

    static Map<String, Object> dimensions(HypeDimensions d) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (d == null) {
            return m;
        }
        put(m, "POPULARITY", d.getPopularity());
        put(m, "ENGAGEMENT", d.getEngagement());
        put(m, "TREND", d.getTrend());
        put(m, "TREND_VELOCITY", d.getTrendVelocity());
        put(m, "ORIGINALITY", d.getOriginality());
        put(m, "RARITY", d.getRarity());
        put(m, "LONGEVITY", d.getLongevity());
        put(m, "NOVELTY", d.getNovelty());
        put(m, "INFLUENCE", d.getInfluence());
        return m;
    }

    private static void put(Map<String, Object> m, String k, BigDecimal v) {
        if (v != null) {
            m.put(k, num(v));
        }
    }

    static Double num(BigDecimal v) {
        return v == null ? null : Math.round(v.doubleValue() * 10) / 10.0;
    }

    static Map<String, Object> point(HypeScoreSnapshot s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("date", s.getSnapshotDate().toString());
        m.put("status", s.getStatus().name());
        m.put("score", num(s.getScore()));
        m.put("level", s.getLevel() == null ? null : s.getLevel().name());
        m.put("dimensions", dimensions(s.getDimensions()));
        return m;
    }
}
