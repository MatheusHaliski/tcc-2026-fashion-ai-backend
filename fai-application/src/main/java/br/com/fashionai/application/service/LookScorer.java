package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Pontuação multidimensional de looks sugeridos ({@link RecommendationScoring}) — a MESMA régua para o Copilot e o
 * Autopiloto ("um motor, três portas"): compatibilidade com o DNA, Hype (média do v2 das peças), novidade da combinação,
 * reutilização (peças paradas), uso comprovado e sustentabilidade. O Hype é só uma das seis dimensões (≤ 20% do peso em
 * qualquer modo); dimensão sem base fica nula (neutra na ordenação).
 */
final class LookScorer {
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final StyleDnaRepository dnas;
    private final HypeQueryService hype;

    LookScorer(WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems, StyleDnaRepository dnas, HypeQueryService hype) {
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dnas = dnas;
        this.hype = hype;
    }

    /** O que vale para todos os looks de uma rodada: DNA de quem pede, pares já combinados em looks salvos e o dia. */
    record Context(UUID userId, StyleCompatibility.Profile dna, Set<String> seenPairs, LocalDate today) {
    }

    Context context(UUID userId) {
        StyleCompatibility.Profile dna = dnas.findByUserId(userId).map(HypeQueryService::profileOf).orElse(null);
        Set<String> seen = new HashSet<>();
        List<Scheme> mine = schemes.findByUserIdOrderByCreatedAtDesc(userId);
        if (mine != null && !mine.isEmpty()) {
            schemeItems.findBySchemeIdIn(mine.stream().map(Scheme::getId).toList()).stream()
                    .collect(Collectors.groupingBy(si -> si.getScheme().getId(), Collectors.mapping(si -> si.getWardrobeItem().getId(), Collectors.toList())))
                    .values().forEach(ids -> {
                        for (int a = 0; a < ids.size(); a++) {
                            for (int b = a + 1; b < ids.size(); b++) {
                                seen.add(RecommendationScoring.pair(ids.get(a), ids.get(b)));
                            }
                        }
                    });
        }
        return new Context(userId, dna, seen, LocalDate.now(FaiPointsService.ZONE));
    }

    /** Hype v2 atual de todas as peças dos looks, numa consulta. */
    Map<UUID, HypeScoreCurrent> hypeOf(Collection<UUID> pieceIds) {
        return pieceIds == null || pieceIds.isEmpty() ? Map.of() : hype.currentOf(HypeEntityType.PIECE, new LinkedHashSet<>(pieceIds));
    }

    /**
     * Seis números de um look. {@code ids} = peças pedidas (novidade conta pares entre elas); {@code look} = as peças
     * carregadas (as demais dimensões).
     */
    static RecommendationScoring.Scores scores(Context ctx, List<UUID> ids, List<WardrobeItem> look, Map<UUID, HypeScoreCurrent> hypeById) {
        List<Double> hypes = ids.stream().distinct().map(hypeById::get).filter(Objects::nonNull).filter(c -> c.getScore() != null)
                .map(c -> c.getScore().doubleValue()).toList();
        Integer compat = null;
        if (ctx.dna() != null && !look.isEmpty()) {
            Set<String> styles = new LinkedHashSet<>(), colors = new LinkedHashSet<>(), occasions = new LinkedHashSet<>();
            look.forEach(w -> {
                styles.addAll(Json.csv(w.getStyleTags()));
                colors.addAll(HypeQueryService.colorsOf(w));
                occasions.addAll(Json.csv(w.getOccasionTags()));
            });
            Map<String, Object> c = StyleCompatibility.score(ctx.dna(), StyleCompatibility.profile(styles, colors, occasions));
            compat = c == null ? null : ((Number) c.get("score")).intValue();
        }
        List<Integer> wears = look.stream().map(WardrobeItem::getWearCount).toList();
        long owned = look.stream().filter(w -> w.getUser() != null && ctx.userId().equals(w.getUser().getId())).count();
        return new RecommendationScoring.Scores(compat,
                hypes.isEmpty() ? null : (int) Math.round(hypes.stream().mapToDouble(Double::doubleValue).average().orElse(0)),
                RecommendationScoring.novelty(ids, ctx.seenPairs()),
                RecommendationScoring.reuse(look.stream().map(w -> HypeQueryService.idleDays(w, ctx.today())).toList()),
                RecommendationScoring.usage(wears),
                RecommendationScoring.sustainability(wears, owned, look.size()));
    }

    /** Pontua looks já montados (peças carregadas), na ordem recebida. */
    List<RecommendationScoring.Scores> scoreLooks(UUID userId, List<List<WardrobeItem>> looks) {
        if (looks.isEmpty()) {
            return List.of();
        }
        Context ctx = context(userId);
        Map<UUID, HypeScoreCurrent> h = hypeOf(looks.stream().flatMap(List::stream).map(WardrobeItem::getId).toList());
        return looks.stream().map(l -> scores(ctx, l.stream().map(WardrobeItem::getId).toList(), l, h)).toList();
    }

    /**
     * Cards do Copilot ({@code pieceIds}): acrescenta {@code scores} a cada um e, com um modo escolhido, reordena pelo
     * peso do modo. Sem modo, mantém a ordem do motor e só mostra os números.
     */
    List<Map<String, Object>> scoreCards(CurrentUser user, List<Map<String, Object>> cards, RecommendationScoring.Mode mode) {
        if (cards.isEmpty()) {
            return cards;
        }
        Context ctx = context(user.id());
        List<UUID> all = new ArrayList<>();
        for (Map<String, Object> card : cards) {
            all.addAll(idsOf(card));
        }
        Map<UUID, WardrobeItem> byId = all.isEmpty() ? Map.of() : pieces.findByIdIn(new LinkedHashSet<>(all)).stream()
                .collect(Collectors.toMap(WardrobeItem::getId, Function.identity(), (a, b) -> a));
        Map<UUID, HypeScoreCurrent> h = hypeOf(all);
        List<Map<String, Object>> out = new ArrayList<>();
        Map<Map<String, Object>, Double> rank = new IdentityHashMap<>();
        for (Map<String, Object> card : cards) {
            List<UUID> ids = idsOf(card);
            List<WardrobeItem> look = ids.stream().distinct().map(byId::get).filter(Objects::nonNull).toList();
            RecommendationScoring.Scores scores = scores(ctx, ids, look, h);
            Map<String, Object> m = new LinkedHashMap<>(card);
            m.put("scores", scores.toMap());
            rank.put(m, RecommendationScoring.rankValue(mode, scores));
            out.add(m);
        }
        if (mode != null) {
            out.sort(Comparator.comparingDouble((Map<String, Object> m) -> rank.get(m)).reversed());
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<UUID> idsOf(Map<String, Object> card) {
        Object raw = card.getOrDefault("pieceIds", List.of());
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<UUID> out = new ArrayList<>();
        for (Object o : list) {
            if (o instanceof UUID u) {
                out.add(u);
            } else if (o != null) {
                try {
                    out.add(UUID.fromString(String.valueOf(o)));
                } catch (IllegalArgumentException ignored) {
                    // id malformado: fora da pontuação
                }
            }
        }
        return out;
    }
}
