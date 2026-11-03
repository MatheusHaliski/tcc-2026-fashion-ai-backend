package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ShowcaseService.Kind;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static br.com.fashionai.application.service.ShowcaseService.W_ITEMS;
import static br.com.fashionai.application.service.ShowcaseService.W_LIKES;

/**
 * Insights de eras/coleções: ranking de POPULARIDADE (curtidas e volume de itens), plateia, holofotes e fogos, com o
 * HypeScore v2 de cada agrupamento à parte (maior e médio, com faixa) e o de maior Hype médio.
 */
final class ShowcaseInsights {
    private final ShowcaseGroupings base;
    private final ShowcaseHype hypes;
    private final HypeScoreConfig hypeConfig;

    ShowcaseInsights(ShowcaseGroupings base, ShowcaseHype hypes, HypeScoreConfig hypeConfig) {
        this.base = base;
        this.hypes = hypes;
        this.hypeConfig = hypeConfig;
    }

    /**
     * Hype v2 de uma era/coleção: {@code {top, avg, level, items}} sobre os looks e peças com Hype disponível (público
     * para quem visita; pessoal para o dono). {@code level} é a faixa da média. Sem item com Hype = tudo nulo ("—").
     */
    static Map<String, Object> groupHype(List<HypeScoreCurrent> rows, boolean self, HypeScoreConfig cfg) {
        List<Double> scores = rows.stream().map(c -> SearchHype.scoreFor(c, self)).filter(Objects::nonNull).toList();
        Map<String, Object> h = new LinkedHashMap<>();
        Double avg = scores.isEmpty() ? null : SearchHype.round1(scores.stream().mapToDouble(Double::doubleValue).average().orElse(0));
        h.put("top", scores.isEmpty() ? null : SearchHype.round1(scores.stream().mapToDouble(Double::doubleValue).max().orElse(0)));
        h.put("avg", avg);
        h.put("level", avg == null ? null : (cfg == null ? HypeScoreConfig.defaults() : cfg).level(avg).name());
        h.put("items", scores.size());
        return h;
    }

    /**
     * Insights de eras/coleções. A pontuação (ranking, plateia, fogos) é de POPULARIDADE: 0,75·curtidas + 0,25·itens,
     * cada termo dividido pelo maior valor do próprio perfil — o HypeScore não entra (popularidade ≠ Hype). O Hype v2 vem
     * à parte em {@code hype} (maior e médio, com faixa); {@code mostHype} é a era/coleção de maior Hype médio.
     * A plateia do palco (ou o público em volta da mini loja) é proporcional à pontuação: o 1º lugar lota.
     */
    Map<String, Object> insights(CurrentUser viewer, String slug, Kind kind) {
        User u = base.owner(slug, kind);
        List<Scheme> ss = base.visibleSchemes(viewer, u);
        List<WardrobeItem> ps = base.visiblePieces(viewer, u);
        boolean self = ShowcaseGroupings.self(viewer, u);
        Map<UUID, HypeScoreCurrent> schemeHype = hypes.of(HypeEntityType.SCHEME, ss.stream().map(Scheme::getId).toList());
        Map<UUID, HypeScoreCurrent> pieceHype = hypes.of(HypeEntityType.PIECE, ps.stream().map(WardrobeItem::getId).toList());
        List<Map<String, Object>> rows = new ArrayList<>();
        double maxLikes = 0, maxItems = 0;
        for (SchemeGrouping g : base.groupingsOf(u, kind)) {
            List<Scheme> gs = ss.stream().filter(s -> g.getId().equals(s.getGroupingId())).toList();
            List<WardrobeItem> gp = ps.stream().filter(w -> g.getId().equals(w.getGroupingId())).toList();
            long likes = gs.stream().mapToLong(Scheme::getLikeCount).sum() + gp.stream().mapToLong(WardrobeItem::getLikesCount).sum();
            List<HypeScoreCurrent> groupRows = new ArrayList<>();
            gs.forEach(s -> groupRows.add(schemeHype.get(s.getId())));
            gp.forEach(w -> groupRows.add(pieceHype.get(w.getId())));
            Map<String, Object> r = base.groupingCard(g, ss, ps, schemeHype, self);
            r.put("likes", likes);
            r.put("hype", groupHype(groupRows, self, hypeConfig));
            r.put("items", gs.size() + gp.size());
            r.put("comments", gs.stream().mapToLong(Scheme::getCommentCount).sum());
            r.put("shares", gs.stream().mapToLong(Scheme::getShareCount).sum());
            r.put("topScheme", gs.stream().filter(s -> SearchHype.scoreFor(schemeHype.get(s.getId()), self) != null)
                    .max(Comparator.comparing((Scheme s) -> SearchHype.scoreFor(schemeHype.get(s.getId()), self)))
                    .map(s -> Map.of("id", s.getId(), "title", s.getTitle())).orElse(null));
            maxLikes = Math.max(maxLikes, likes);
            maxItems = Math.max(maxItems, gs.size() + gp.size());
            rows.add(r);
        }
        for (Map<String, Object> r : rows) {
            double score = W_LIKES * norm(((Number) r.get("likes")).doubleValue(), maxLikes)
                    + W_ITEMS * norm(((Number) r.get("items")).doubleValue(), maxItems);
            r.put("score", Math.round(score * 1000) / 10.0);
        }
        rows.sort(Comparator.comparingDouble((Map<String, Object> r) -> ((Number) r.get("score")).doubleValue()).reversed());
        double top = rows.isEmpty() ? 0 : ((Number) rows.get(0).get("score")).doubleValue();
        int capacity = kind == Kind.ERAS ? 120 : 80;
        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> r = rows.get(i);
            double s = ((Number) r.get("score")).doubleValue();
            double fraction = top <= 0 ? 0 : s / top;
            r.put("rank", i + 1);
            r.put("audienceFraction", Math.round(fraction * 100) / 100.0);
            r.put("audience", (int) Math.round(fraction * capacity));
            r.put("capacity", capacity);
            r.put("fireworks", kind == Kind.COLLECTIONS ? Math.max(0, 4 - i) * (fraction >= 0.25 ? 1 : 0) : 0);
            r.put("spotlights", Math.max(1, 4 - i));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kind", kind.name());
        out.put("owner", Views.user(u));
        out.put("ranking", rows);
        out.put("mostLiked", rows.stream().max(Comparator.comparingLong(r -> ((Number) r.get("likes")).longValue())).map(r -> r.get("label")).orElse(null));
        // maior Hype MÉDIO v2 (sem Hype em nenhuma = nulo, "—"); popularidade fica no mostLiked e na pontuação
        out.put("mostHype", rows.stream().filter(r -> avgHype(r) != null)
                .max(Comparator.comparing((Map<String, Object> r) -> avgHype(r)).thenComparing(r -> String.valueOf(r.get("label")), Comparator.reverseOrder()))
                .map(r -> r.get("label")).orElse(null));
        out.put("algorithmVersion", hypeConfig == null ? null : hypeConfig.algorithmVersion());
        out.put("method", Msg.t("showcase.pontuacao_popularidade", (kind == Kind.ERAS ? "eras" : Msg.t("showcase.colecoes")), capacity));
        return out;
    }

    private static Double avgHype(Map<String, Object> row) {
        return row.get("hype") instanceof Map<?, ?> h && h.get("avg") instanceof Number n ? n.doubleValue() : null;
    }

    private static double norm(double v, double max) {
        return max <= 0 ? 0 : v / max;
    }
}
