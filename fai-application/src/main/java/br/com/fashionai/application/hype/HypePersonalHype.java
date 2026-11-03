package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeCards.num;
import static br.com.fashionai.application.hype.HypeQueryService.FORGOTTEN_DAYS;
import static br.com.fashionai.application.hype.HypeQueryService.idleDays;
import static br.com.fashionai.application.hype.HypeRankFilters.round1;

/** HypeScore v2 — painel pessoal (Perfil → Insights, Histórico → Hype): destaques, redescobertas, quem subiu/caiu e séries. */
final class HypePersonalHype {
    private final HypeReadCore core;

    HypePersonalHype(HypeReadCore core) {
        this.core = core;
    }

    // ================================================================== painel pessoal (Perfil → Insights, Histórico → Hype)
    record Owned(List<WardrobeItem> pieces, List<Scheme> schemes, Map<UUID, HypeScoreCurrent> pieceHype, Map<UUID, HypeScoreCurrent> schemeHype) {
    }

    Owned owned(UUID userId) {
        List<WardrobeItem> ps = core.pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        List<Scheme> ss = core.schemes.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(s -> s.getStatus() != br.com.fashionai.domain.model.enums.SchemeStatus.ARCHIVED).toList();
        Map<UUID, HypeScoreCurrent> ph = core.current.findByOwnerIdAndEntityTypeAndAlgorithmVersion(userId, HypeEntityType.PIECE, core.config.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
        Map<UUID, HypeScoreCurrent> sh = core.current.findByOwnerIdAndEntityTypeAndAlgorithmVersion(userId, HypeEntityType.SCHEME, core.config.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
        return new Owned(ps, ss, ph, sh);
    }

    /**
     * Dashboard do guarda-roupa: Hype médio (e a variação), peça em destaque, maior crescimento, clássica, rara, esquecida,
     * look com maior Hype e look mais remixado. Nunca compara com outras pessoas.
     */
    Map<String, Object> wardrobe(CurrentUser user) {
        Owned o = owned(user.id());
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        Instant now = Instant.now();
        Map<UUID, WardrobeItem> pById = o.pieces().stream().collect(Collectors.toMap(WardrobeItem::getId, Function.identity()));
        Map<UUID, Scheme> sById = o.schemes().stream().collect(Collectors.toMap(Scheme::getId, Function.identity()));
        List<HypeScoreCurrent> pAvail = o.pieceHype().values().stream().filter(c -> c.getStatus() == HypeStatus.AVAILABLE && pById.containsKey(c.getEntityId())).toList();
        List<HypeScoreCurrent> sAvail = o.schemeHype().values().stream().filter(c -> c.getStatus() == HypeStatus.AVAILABLE && sById.containsKey(c.getEntityId())).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("deltaWindowDays", core.config.deltaWindowDays());
        out.put("pieces", o.pieces().size());
        out.put("piecesWithHype", pAvail.size());
        out.put("looks", o.schemes().size());
        out.put("averageHype", pAvail.isEmpty() ? null : round1(pAvail.stream().mapToDouble(c -> c.getScore().doubleValue()).average().orElse(0)));
        List<HypeScoreCurrent> withDelta = pAvail.stream().filter(c -> c.getDeltaPoints() != null).toList();
        out.put("averageDeltaPoints", withDelta.isEmpty() ? null : round1(withDelta.stream().mapToDouble(c -> c.getDeltaPoints().doubleValue()).average().orElse(0)));
        out.put("calculatedAt", pAvail.stream().map(HypeScoreCurrent::getCalculatedAt).max(Comparator.naturalOrder()).map(Instant::toString).orElse(null));

        Map<String, Object> highlights = new LinkedHashMap<>();
        pAvail.stream().max(Comparator.comparing(HypeScoreCurrent::getScore))
                .ifPresent(c -> highlights.put("topPiece", pieceCard(user, pById.get(c.getEntityId()), c, now, "score", num(c.getScore()))));
        pAvail.stream().filter(c -> c.getDeltaPoints() != null && c.getDeltaPoints().signum() > 0).max(Comparator.comparing(HypeScoreCurrent::getDeltaPoints))
                .or(() -> pAvail.stream().filter(c -> c.getDimensions().getTrend() != null && c.getDimensions().getTrend().doubleValue() >= 60)
                        .max(Comparator.comparing(c -> c.getDimensions().getTrend())))
                .ifPresent(c -> highlights.put("biggestGrowth", pieceCard(user, pById.get(c.getEntityId()), c, now, "deltaPoints", num(c.getDeltaPoints()))));
        pAvail.stream().filter(c -> c.getMomentum() == HypeMomentum.CLASSIC || (c.getDimensions().getLongevity() != null && c.getDimensions().getLongevity().doubleValue() >= 60))
                .max(Comparator.comparing(c -> c.getDimensions().getLongevity() == null ? BigDecimal.ZERO : c.getDimensions().getLongevity()))
                .ifPresent(c -> highlights.put("classic", pieceCard(user, pById.get(c.getEntityId()), c, now, "longevity", num(c.getDimensions().getLongevity()))));
        o.pieceHype().values().stream().filter(c -> pById.containsKey(c.getEntityId()) && c.getDimensions().getRarity() != null && c.getDimensions().getRarity().doubleValue() >= 50)
                .max(Comparator.comparing(c -> c.getDimensions().getRarity()))
                .ifPresent(c -> highlights.put("rare", pieceCard(user, pById.get(c.getEntityId()), c, now, "rarity", num(c.getDimensions().getRarity()))));
        o.pieces().stream().filter(w -> w.isDisponivel() && idleDays(w, today) >= FORGOTTEN_DAYS).max(Comparator.comparingLong(w -> idleDays(w, today)))
                .ifPresent(w -> highlights.put("forgotten", pieceCard(user, w, o.pieceHype().get(w.getId()), now, "idleDays", (double) idleDays(w, today))));
        sAvail.stream().max(Comparator.comparing(HypeScoreCurrent::getScore))
                .ifPresent(c -> highlights.put("topLook", lookCard(user, sById.get(c.getEntityId()), c, now, "score", num(c.getScore()))));
        o.schemes().stream().filter(s -> s.getRemixCount() > 0).max(Comparator.comparingLong(Scheme::getRemixCount))
                .ifPresent(s -> highlights.put("mostRemixed", lookCard(user, s, o.schemeHype().get(s.getId()), now, "remixes", (double) s.getRemixCount())));
        out.put("highlights", highlights);
        out.put("rediscoveries", rediscoveries(user, o, today, now, 3));
        return out;
    }

    /**
     * Redescoberta: peça parada há {@value HypeQueryService#FORGOTTEN_DAYS}+ dias cujas semelhantes cresceram (ou cujo trend voltou a
     * subir). Conecta Hype à reutilização do guarda-roupa: "127 dias sem uso, mas peças semelhantes cresceram 31%".
     */
    List<Map<String, Object>> rediscoveries(CurrentUser user, Owned o, LocalDate today, Instant now, int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (WardrobeItem w : o.pieces()) {
            long idle = idleDays(w, today);
            HypeScoreCurrent c = o.pieceHype().get(w.getId());
            if (!w.isDisponivel() || idle < FORGOTTEN_DAYS || c == null) {
                continue;
            }
            Map<String, Object> sig = Json.map(c.getSignalsJson());
            Double similar = sig != null && sig.get("similarGrowthPercent") instanceof Number n ? n.doubleValue() : null;
            double trend = c.getDimensions().getTrend() == null ? 0 : c.getDimensions().getTrend().doubleValue();
            if ((similar != null && similar >= 15) || trend >= 60) {
                Map<String, Object> m = pieceCard(user, w, c, now, "idleDays", (double) idle);
                m.put("idleDays", idle);
                m.put("similarGrowthPercent", similar == null ? null : Math.round(similar));
                m.put("trend", Math.round(trend));
                out.add(m);
            }
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> -(m.get("similarGrowthPercent") instanceof Number n ? n.doubleValue() : 0)));
        return out.size() > limit ? out.subList(0, limit) : out;
    }

    /** Histórico → Hype: evolução do Hype médio, quem subiu, quem caiu, novas tendências, redescobertas e looks emergentes. */
    Map<String, Object> movers(CurrentUser user, int days) {
        Owned o = owned(user.id());
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        Instant now = Instant.now();
        int span = Math.max(14, Math.min(core.config.historyMaxDays(), days));
        Map<UUID, WardrobeItem> pById = o.pieces().stream().collect(Collectors.toMap(WardrobeItem::getId, Function.identity()));
        Map<UUID, Scheme> sById = o.schemes().stream().collect(Collectors.toMap(Scheme::getId, Function.identity()));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("deltaWindowDays", core.config.deltaWindowDays());
        out.put("days", span);
        out.put("series", Map.of("pieces", averageSeries(HypeEntityType.PIECE, pById.keySet(), today.minusDays(span - 1L)),
                "looks", averageSeries(HypeEntityType.SCHEME, sById.keySet(), today.minusDays(span - 1L))));

        List<Map<String, Object>> moved = new ArrayList<>();
        o.pieceHype().values().stream().filter(c -> isMoving(c) && pById.containsKey(c.getEntityId()))
                .forEach(c -> moved.add(pieceCard(user, pById.get(c.getEntityId()), c, now, "deltaPoints", num(c.getDeltaPoints()))));
        o.schemeHype().values().stream().filter(c -> isMoving(c) && sById.containsKey(c.getEntityId()))
                .forEach(c -> moved.add(lookCard(user, sById.get(c.getEntityId()), c, now, "deltaPoints", num(c.getDeltaPoints()))));
        out.put("risers", moved.stream().filter(m -> value(m) > 0).sorted(Comparator.comparingDouble(m -> -value(m))).limit(5).toList());
        out.put("fallers", moved.stream().filter(m -> value(m) < 0).sorted(Comparator.comparingDouble(HypePersonalHype::value)).limit(5).toList());
        out.put("rediscoveries", rediscoveries(user, o, today, now, 6));
        out.put("emergingLooks", o.schemeHype().values().stream().filter(c -> sById.containsKey(c.getEntityId())
                        && (c.getMomentum() == HypeMomentum.EMERGING || c.getMomentum() == HypeMomentum.RISING))
                .sorted(Comparator.comparing((HypeScoreCurrent c) -> c.getDimensions().getTrend() == null ? BigDecimal.ZERO : c.getDimensions().getTrend()).reversed())
                .limit(4).map(c -> lookCard(user, sById.get(c.getEntityId()), c, now, "trend", num(c.getDimensions().getTrend()))).toList());
        // novas tendências: o que emerge na rede (só público), por categoria — contexto, não recomendação
        out.put("newTrends", core.current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, core.config.algorithmVersion(), HypeStatus.AVAILABLE)
                .stream().filter(c -> c.getMomentum() == HypeMomentum.EMERGING && c.getCategory() != null)
                .collect(Collectors.groupingBy(HypeScoreCurrent::getCategory, TreeMap::new, Collectors.counting()))
                .entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(6)
                .map(e -> Map.<String, Object>of("category", e.getKey(), "emerging", e.getValue())).toList());
        return out;
    }

    /** Subiu/caiu = direção calculada (fora da faixa "estável"), não o sinal do delta: −1,9 pts é estável, não queda. */
    static boolean isMoving(HypeScoreCurrent c) {
        return c.getDeltaPoints() != null && ("UP".equals(c.getDirection()) || "DOWN".equals(c.getDirection()));
    }

    static double value(Map<String, Object> m) {
        return m.get("value") instanceof Number n ? n.doubleValue() : 0;
    }

    List<Map<String, Object>> averageSeries(HypeEntityType type, Set<UUID> ids, LocalDate since) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<LocalDate, double[]> acc = new TreeMap<>();
        for (HypeScoreSnapshot s : core.snapshots.findByEntityTypeAndEntityIdInAndAlgorithmVersionAndSnapshotDateGreaterThanEqual(type, ids, core.config.algorithmVersion(), since)) {
            if (s.getScore() != null) {
                double[] a = acc.computeIfAbsent(s.getSnapshotDate(), k -> new double[2]);
                a[0] += s.getScore().doubleValue();
                a[1]++;
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        acc.forEach((d, a) -> out.add(Map.of("date", d.toString(), "average", round1(a[0] / a[1]), "n", (int) a[1])));
        return out;
    }

    Map<String, Object> pieceCard(CurrentUser viewer, WardrobeItem w, HypeScoreCurrent c, Instant now, String metric, Double value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", HypeEntityType.PIECE.name());
        m.put("id", w.getId().toString());
        m.put("metric", metric);
        m.put("value", value);
        m.put("hype", core.summary(c, now));
        m.put("piece", Views.piece(w, core.wardrobe.viewerState(viewer, w), null));
        return m;
    }

    Map<String, Object> lookCard(CurrentUser viewer, Scheme s, HypeScoreCurrent c, Instant now, String metric, Double value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", HypeEntityType.SCHEME.name());
        m.put("id", s.getId().toString());
        m.put("metric", metric);
        m.put("value", value);
        m.put("hype", core.summary(c, now));
        m.put("scheme", core.schemeService.view(viewer, s, core.schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
        return m;
    }
}
