package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.lens.LensMatcher.features;

/**
 * Plano "Recriar" com as peças da pessoa: um slot por peça detectada ({@code own}, {@code alternative} ou {@code gap}),
 * escolha pesada pelo modo do {@code RecommendationScoring}, slots fixados e os seis números do look (os do Copilot).
 */
final class LensRecreatePlanner {
    /** Slots do plano "Recriar" (chaves aceitas em {@code locked}, além do id da peça detectada). */
    static final Set<String> SLOTS = Set.of("TOP", "BOTTOM", "FULL", "SHOES", "ACCESSORY");

    private final LensScanAccess access;
    private final LensMatcher matcher;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;
    private final LensRequestContext.Sources live;

    LensRecreatePlanner(LensScanAccess access, LensMatcher matcher, HypeScoreCurrentRepository hypeScores,
                        HypeScoreConfig hypeConfig, LensRequestContext.Sources live) {
        this.access = access;
        this.matcher = matcher;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.live = live;
    }

    LensViews.RecreatePlan recreate(CurrentUser user, LensScan scan, LensService.RecreateCommand cmd) {
        RecommendationScoring.Mode mode = RecommendationScoring.Mode.SAFE;
        if (cmd != null && cmd.mode() != null && !cmd.mode().isBlank()) {
            mode = RecommendationScoring.Mode.parse(cmd.mode());
            if (mode == null) {
                throw ApiException.badRequest("MODO_INVALIDO", Msg.t("lens.modo_invalido"), Map.of("field", "mode"));
            }
        }
        List<LensDetection> ds = new ArrayList<>(access.active(scan.getId()));
        if (cmd != null && cmd.focus() != null) {
            LensDetection focus = ds.stream().filter(d -> d.getId().equals(cmd.focus())).findFirst()
                    .orElseThrow(() -> ApiException.notFound(Msg.t("lens.deteccao")));
            ds.remove(focus);
            ds.add(0, focus);
        }
        ds.removeIf(d -> LensReading.slotOf(d.getCategory()) == null);

        LensRequestContext ctx = live.open(user);
        Map<String, WardrobeItem> locked = resolveLocked(ctx, cmd == null ? null : cmd.locked());
        Map<UUID, HypeScoreCurrent> hype = hypeOf(ctx.closet().stream().map(WardrobeItem::getId).toList());
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        double simWeight = LensConfig.RECREATE_SIMILARITY_WEIGHT.getOrDefault(mode.name(), 0.6);

        Set<UUID> used = new HashSet<>();
        locked.values().forEach(w -> used.add(w.getId()));
        Set<String> lockedSlotsTaken = new HashSet<>();
        List<LensViews.SlotView> slots = new ArrayList<>();
        List<WardrobeItem> chosen = new ArrayList<>();
        for (LensDetection d : ds) {
            String slot = LensReading.slotOf(d.getCategory());
            LensSimilarity.Features f = features(d);
            List<LensSimilarity.Ranked<WardrobeItem>> sameCategory = LensSimilarity.rank(f,
                    ctx.closet().stream().filter(w -> d.getCategory().equals(w.getCategory())).toList(),
                    w -> features(ctx, w), 1, Integer.MAX_VALUE);
            WardrobeItem lockedPiece = locked.get(d.getId().toString());
            if (lockedPiece == null && !lockedSlotsTaken.contains(slot) && locked.containsKey(slot)) {
                lockedPiece = locked.get(slot);
                lockedSlotsTaken.add(slot);
            }
            if (lockedPiece != null) {
                WardrobeItem lp = lockedPiece;
                chosen.add(lp);
                List<Views.PieceView> alts = sameCategory.stream().map(LensSimilarity.Ranked::target)
                        .filter(w -> !w.getId().equals(lp.getId()) && !used.contains(w.getId()))
                        .limit(LensConfig.RECREATE_ALTERNATIVES).map(w -> matcher.pieceView(user, w)).toList();
                slots.add(new LensViews.SlotView(slot, d.getId(), "own", matcher.pieceView(user, lp), alts));
                continue;
            }
            int floor = LensConfig.FLOOR_MY_CLOSET;
            RecommendationScoring.Mode m = mode;
            Function<LensSimilarity.Ranked<WardrobeItem>, Double> pick = r -> simWeight * r.score().similarity()
                    + (1 - simWeight) * RecommendationScoring.rankValue(m, pieceScores(ctx, r.target(), hype, today));
            List<LensSimilarity.Ranked<WardrobeItem>> eligible = sameCategory.stream()
                    .filter(r -> r.score().similarity() >= floor && !used.contains(r.target().getId()))
                    .sorted(Comparator.comparingDouble(pick::apply).reversed()).toList();
            if (!eligible.isEmpty()) {
                WardrobeItem best = eligible.get(0).target();
                used.add(best.getId());
                chosen.add(best);
                boolean sameSub = d.getSubcategory() == null || d.getSubcategory().equals(best.getSubcategory());
                List<Views.PieceView> alts = new ArrayList<>();
                eligible.stream().skip(1).limit(LensConfig.RECREATE_ALTERNATIVES).forEach(r -> alts.add(matcher.pieceView(user, r.target())));
                slots.add(new LensViews.SlotView(slot, d.getId(), sameSub ? "own" : "alternative", matcher.pieceView(user, best), alts));
            } else {
                List<Views.PieceView> alts = sameCategory.stream().map(LensSimilarity.Ranked::target)
                        .filter(w -> !used.contains(w.getId())).limit(LensConfig.RECREATE_ALTERNATIVES)
                        .map(w -> matcher.pieceView(user, w)).toList();
                slots.add(new LensViews.SlotView(slot, d.getId(), "gap", null, alts));
            }
        }
        List<UUID> ids = chosen.stream().map(WardrobeItem::getId).toList();
        RecommendationScoring.Scores scores = lookScores(ctx, chosen, hype, today, slots.size());
        String href = ids.isEmpty() ? "/schemes/new"
                : "/schemes/new?pieces=" + ids.stream().map(UUID::toString).collect(Collectors.joining(","));
        return new LensViews.RecreatePlan(mode.name(), slots, ids, scores, href);
    }

    /** Slots fixados: chave = slot (TOP…) ou id da peça detectada; valor = peça do próprio guarda-roupa (senão 404). */
    private Map<String, WardrobeItem> resolveLocked(LensRequestContext ctx, Map<String, String> raw) {
        Map<String, WardrobeItem> out = new LinkedHashMap<>();
        if (raw == null) {
            return out;
        }
        Map<UUID, WardrobeItem> mine = ctx.closet().stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w, (a, b) -> a));
        for (Map.Entry<String, String> e : raw.entrySet()) {
            if (e.getKey() == null || e.getValue() == null || e.getValue().isBlank()) {
                continue;
            }
            UUID pieceId;
            try {
                pieceId = UUID.fromString(e.getValue().trim());
            } catch (IllegalArgumentException ex) {
                throw ApiException.notFound(Msg.t("common.peca"));
            }
            WardrobeItem w = mine.get(pieceId);
            if (w == null) {
                throw ApiException.notFound(Msg.t("common.peca"));
            }
            String key = e.getKey().trim();
            String upper = key.toUpperCase(Locale.ROOT);
            out.put(SLOTS.contains(upper) ? upper : key, w);
        }
        return out;
    }

    /** Seis números de uma peça sozinha (o modo decide o peso de cada um na escolha do slot). */
    private RecommendationScoring.Scores pieceScores(LensRequestContext ctx, WardrobeItem w, Map<UUID, HypeScoreCurrent> hype, LocalDate today) {
        Integer compat = null;
        StyleCompatibility.Profile dna = ctx.dna();
        if (dna != null) {
            Map<String, Object> c = StyleCompatibility.score(dna, HypeQueryService.profileOf(w));
            compat = c == null ? null : ((Number) c.get("score")).intValue();
        }
        HypeScoreCurrent h = hype.get(w.getId());
        Integer hypeScore = h == null || h.getScore() == null ? null : (int) Math.round(h.getScore().doubleValue());
        List<Integer> wears = List.of(w.getWearCount());
        return new RecommendationScoring.Scores(compat, hypeScore, null,
                RecommendationScoring.reuse(List.of(HypeQueryService.idleDays(w, today))),
                RecommendationScoring.usage(wears), RecommendationScoring.sustainability(wears, 1, 1));
    }

    /** Os seis números do look recriado, no mesmo cálculo do Copilot ({@code CopilotTools.scoreLooks}). */
    private RecommendationScoring.Scores lookScores(LensRequestContext ctx, List<WardrobeItem> look, Map<UUID, HypeScoreCurrent> hype,
                                                    LocalDate today, int slots) {
        Integer compat = null;
        StyleCompatibility.Profile dna = ctx.dna();
        if (dna != null && !look.isEmpty()) {
            Set<String> styles = new LinkedHashSet<>(), colors = new LinkedHashSet<>(), occasions = new LinkedHashSet<>();
            look.forEach(w -> {
                styles.addAll(Json.csv(w.getStyleTags()));
                colors.addAll(HypeQueryService.colorsOf(w));
                occasions.addAll(Json.csv(w.getOccasionTags()));
            });
            Map<String, Object> c = StyleCompatibility.score(dna, StyleCompatibility.profile(styles, colors, occasions));
            compat = c == null ? null : ((Number) c.get("score")).intValue();
        }
        List<Double> hypes = look.stream().map(w -> hype.get(w.getId())).filter(h -> h != null && h.getScore() != null)
                .map(h -> h.getScore().doubleValue()).toList();
        List<UUID> ids = look.stream().map(WardrobeItem::getId).toList();
        List<Integer> wears = look.stream().map(WardrobeItem::getWearCount).toList();
        return new RecommendationScoring.Scores(compat,
                hypes.isEmpty() ? null : (int) Math.round(hypes.stream().mapToDouble(Double::doubleValue).average().orElse(0)),
                RecommendationScoring.novelty(ids, ctx.seenPairs()),
                RecommendationScoring.reuse(look.stream().map(w -> HypeQueryService.idleDays(w, today)).toList()),
                RecommendationScoring.usage(wears),
                RecommendationScoring.sustainability(wears, look.size(), Math.max(slots, look.size())));
    }

    private Map<UUID, HypeScoreCurrent> hypeOf(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(HypeEntityType.PIECE, new HashSet<>(ids),
                        hypeConfig.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h, (a, b) -> a));
    }
}
