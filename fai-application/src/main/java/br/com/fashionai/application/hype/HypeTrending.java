package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeRankFilters.blank;
import static br.com.fashionai.application.hype.HypeRankFilters.norm;

/** HypeScore v2 — "Em alta" por item (Descobrir): ranking com janela, tipo, categoria, estilo e ocasião, e a página de quem vê. */
final class HypeTrending {
    private final HypeReadCore core;

    HypeTrending(HypeReadCore core) {
        this.core = core;
    }

    // ================================================================== ranking (Descobrir → Em alta)
    /**
     * Ranking com recortes obrigatórios: janela (1 = hoje, pelo trend; 7 = HypeScore atual; 30 = média dos snapshots do
     * mês), tipo, categoria, estilo e ocasião. Só entra o que é público e tem score disponível.
     */
    Map<String, Object> trending(CurrentUser viewer, HypeEntityType type, int window, String category, String style, String occasion, int limit) {
        int win = window <= 1 ? 1 : window >= 30 ? 30 : 7;
        int lim = Math.max(1, Math.min(50, limit <= 0 ? 24 : limit));
        String key = "trending:" + type + ":" + win + ":" + norm(category) + ":" + norm(style) + ":" + norm(occasion) + ":" + lim;
        Map<String, Object> ranked = core.cache.get(key, () -> rank(type, win, category, style, occasion, lim));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) ranked.getOrDefault("items", List.of());
        List<UUID> ids = rows.stream().map(r -> UUID.fromString(String.valueOf(r.get("id")))).toList();
        Map<UUID, Object> views = core.views(viewer, type, ids);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Object view = views.get(UUID.fromString(String.valueOf(r.get("id"))));
            if (view == null) {
                continue;   // bloqueio entre as contas ou mudou de visibilidade depois do cálculo
            }
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put(type == HypeEntityType.PIECE ? "piece" : "scheme", view);
            items.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("window", win);
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("items", items);
        return out;
    }

    Map<String, Object> rank(HypeEntityType type, int win, String category, String style, String occasion, int lim) {
        List<HypeScoreCurrent> pool = core.current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(type, core.config.algorithmVersion(), HypeStatus.AVAILABLE)
                .stream().filter(c -> blank(category) || category.equalsIgnoreCase(c.getCategory()))
                .filter(c -> blank(style) || Json.csv(c.getStyles()).contains(style))
                .filter(c -> blank(occasion) || Json.csv(c.getOccasions()).contains(occasion)).toList();
        ToDoubleFunction<HypeScoreCurrent> metric;
        if (win == 1) {
            metric = c -> (c.getDimensions().getTrend() == null ? 0 : c.getDimensions().getTrend().doubleValue()) * 1000 + c.getScore().doubleValue();
        } else if (win == 30) {
            Map<UUID, Double> avg = core.monthAverage(type, pool.stream().map(HypeScoreCurrent::getEntityId).collect(Collectors.toSet()));
            metric = c -> avg.getOrDefault(c.getEntityId(), c.getScore().doubleValue());
        } else {
            metric = c -> c.getScore().doubleValue();
        }
        List<HypeScoreCurrent> top = pool.stream().sorted(Comparator.comparingDouble(metric).reversed()).limit(lim).toList();
        Instant now = Instant.now();
        List<Map<String, Object>> items = new ArrayList<>();
        int rank = 1;
        for (HypeScoreCurrent c : top) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rank", rank++);
            m.put("id", c.getEntityId().toString());
            m.put("hype", core.summary(c, now));
            items.add(m);
        }
        return Map.of("items", items);
    }
}
