package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Correspondências do Lens: peças próprias (MY_CLOSET) e da comunidade (COMMUNITY) parecidas com uma peça lida, pela
 * {@link LensSimilarity}, e a lista de {@link LensService#matches}. Também converte detecção e peça em
 * {@link LensSimilarity.Features} e a peça-alvo em {@link Views.PieceView}.
 */
final class LensMatcher {
    /** Cores que não são uma cor (estampa, multicolor): não entram no ΔE. */
    private static final Set<String> NOT_A_HUE = Set.of("multicolor", "print");

    private final LensConfig config;
    private final WardrobeService wardrobe;

    LensMatcher(LensConfig config, WardrobeService wardrobe) {
        this.config = config;
        this.wardrobe = wardrobe;
    }

    /** Junta as correspondências dos alvos (cada peça com a melhor semelhança), top 12 pela semelhança. */
    LensViews.Matches matches(CurrentUser user, LensRequestContext ctx, LensSimilarity.Scope scope, List<LensDetection> targets) {
        Map<UUID, LensSimilarity.Ranked<WardrobeItem>> best = new LinkedHashMap<>();
        for (LensDetection d : targets) {
            List<LensSimilarity.Ranked<WardrobeItem>> ranked = scope == LensSimilarity.Scope.COMMUNITY
                    ? communityMatches(ctx, d) : closetMatches(ctx, d);
            for (LensSimilarity.Ranked<WardrobeItem> r : ranked) {
                best.merge(r.target().getId(), r, (a, b) -> a.score().similarity() >= b.score().similarity() ? a : b);
            }
        }
        List<LensViews.MatchView> items = best.values().stream()
                .sorted(Comparator.comparingInt((LensSimilarity.Ranked<WardrobeItem> r) -> r.score().similarity()).reversed())
                .limit(LensConfig.TOP_N)
                .map(r -> new LensViews.MatchView(scope.name(), "PIECE", r.target().getId(), r.score().similarity(),
                        new LensViews.Components(r.score().visual(), r.score().attributes(), r.score().color()),
                        r.score().reasons(), pieceView(user, r.target())))
                .toList();
        return new LensViews.Matches(items);
    }

    Views.PieceView pieceView(CurrentUser user, WardrobeItem w) {
        return Views.piece(w, wardrobe.viewerState(user, w), null);
    }

    /** Peças próprias parecidas (piso 55, top 12), da mesma categoria quando a peça detectada tem categoria. */
    List<LensSimilarity.Ranked<WardrobeItem>> closetMatches(LensRequestContext ctx, LensDetection d) {
        LensSimilarity.Features f = features(d);
        List<WardrobeItem> candidates = ctx.closet().stream()
                .filter(w -> d.getCategory() == null || d.getCategory().equals(w.getCategory())).toList();
        return LensSimilarity.rank(f, candidates, w -> features(ctx, w), config.floor(LensSimilarity.Scope.MY_CLOSET), LensConfig.TOP_N);
    }

    /**
     * Comunidade: só peças com {@code hype_scores.public_eligible} (as mesmas regras do ranking), nunca do próprio dono,
     * e conferidas de novo na leitura (visibilidade efetiva, bloqueio, moderação aprovada, não arquivada). Piso 65.
     */
    private List<LensSimilarity.Ranked<WardrobeItem>> communityMatches(LensRequestContext ctx, LensDetection d) {
        LensSimilarity.Features f = features(d);
        List<WardrobeItem> candidates = ctx.community(d.getCategory());
        return LensSimilarity.rank(f, candidates, w -> features(null, w), config.floor(LensSimilarity.Scope.COMMUNITY), LensConfig.TOP_N);
    }

    static LensSimilarity.Features features(LensDetection d) {
        List<LensViews.ColorShare> colors = LensDetectionFields.colors(d);
        String main = colors.isEmpty() ? null : colors.get(0).name();
        return new LensSimilarity.Features(d.getCategory(), d.getSubcategory(), d.getMaterial(), d.getPattern(),
                Json.csv(d.getStyleTags()), hexOf(main), LensDetectionFields.embedding(d.getEmbeddingJson()));
    }

    /** Peça do app como alvo: estampa vira padrão "printed"; embedding só quando o guarda-roupa já tem (backfill). */
    static LensSimilarity.Features features(LensRequestContext ctx, WardrobeItem w) {
        String pattern = "print".equals(w.getColor()) ? "printed" : null;
        return new LensSimilarity.Features(w.getCategory(), w.getSubcategory(), w.getMaterial(), pattern,
                Json.csv(w.getStyleTags()), hexOf(w.getColor()), ctx == null ? null : ctx.embeddingOf(w.getId()));
    }

    static String hexOf(String color) {
        return color == null || NOT_A_HUE.contains(color) ? null : Taxonomy.COLORS.get(color);
    }
}
