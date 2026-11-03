package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ShowcaseService.Kind;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.SchemeItemRepository;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

import static br.com.fashionai.application.service.ShowcaseService.SHOWCASE_SORTS;

/**
 * Busca da aba Eras/Coleções: looks e peças filtrados por era/coleção, texto, tipo e ano, nas ordenações HYPE, GROWTH,
 * CURTIDAS e RECENTES (P1-05), com o header da era ou coleção escolhida.
 */
final class ShowcaseGroupingItems {
    private final ShowcaseGroupings base;
    private final SchemeItemRepository schemeItems;
    private final SchemeService schemeService;
    private final ShowcaseHype hypes;

    ShowcaseGroupingItems(ShowcaseGroupings base, SchemeItemRepository schemeItems, SchemeService schemeService, ShowcaseHype hypes) {
        this.base = base;
        this.schemeItems = schemeItems;
        this.schemeService = schemeService;
        this.hypes = hypes;
    }

    /**
     * Busca da aba Eras/Coleções: esquemas e peças filtrados por era/coleção (ou todas), texto e ano; o header traz a
     * foto/arte da era ou coleção escolhida.
     */
    Map<String, Object> items(CurrentUser viewer, String slug, Kind kind, UUID groupingId, String q, String type,
                                     String sort, Integer year) {
        User u = base.owner(slug, kind);
        List<SchemeGrouping> gs = base.groupingsOf(u, kind);
        Set<UUID> ids = new LinkedHashSet<>();
        SchemeGrouping selected = null;
        for (SchemeGrouping g : gs) {
            boolean inYear = year == null || g.getPeriodFrom() != null && year >= g.getPeriodFrom()
                    && year <= (g.getPeriodTo() == null ? g.getPeriodFrom() : g.getPeriodTo());
            if ((groupingId == null || g.getId().equals(groupingId)) && inYear) {
                ids.add(g.getId());
            }
            if (g.getId().equals(groupingId)) {
                selected = g;
            }
        }
        if (groupingId != null && selected == null) {
            throw ApiException.notFound(kind == Kind.ERAS ? "Era" : Msg.t("showcase.colecao"));
        }
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        String t = type == null ? "TODOS" : type.toUpperCase(Locale.ROOT);
        boolean self = ShowcaseGroupings.self(viewer, u);
        List<Scheme> allSchemes = base.visibleSchemes(viewer, u);
        List<WardrobeItem> allPieces = base.visiblePieces(viewer, u);
        // P1-05: HypeScore v2 dos looks e peças do perfil (duas consultas), lido antes de ordenar
        Map<UUID, HypeScoreCurrent> schemeHype = hypes.of(HypeEntityType.SCHEME, allSchemes.stream().map(Scheme::getId).toList());
        Map<UUID, HypeScoreCurrent> pieceHype = hypes.of(HypeEntityType.PIECE, allPieces.stream().map(WardrobeItem::getId).toList());
        List<Scheme> ss = allSchemes.stream().filter(s -> s.getGroupingId() != null && ids.contains(s.getGroupingId()))
                .filter(s -> needle.isEmpty() || contains(s.getTitle(), needle) || contains(s.getTags(), needle) || contains(s.getStyle(), needle))
                .sorted(order(sort, s -> schemeHype.get(s.getId()), self, Scheme::getLikeCount, Scheme::getCreatedAt)).toList();
        List<WardrobeItem> ps = allPieces.stream().filter(w -> w.getGroupingId() != null && ids.contains(w.getGroupingId()))
                .filter(w -> needle.isEmpty() || contains(w.getName(), needle) || contains(w.getBrandName(), needle) || contains(w.getTags(), needle))
                .sorted(order(sort, w -> pieceHype.get(w.getId()), self, WardrobeItem::getLikesCount, WardrobeItem::getCreatedAt)).toList();
        Map<UUID, SchemeGrouping> byId = new HashMap<>();
        gs.forEach(g -> byId.put(g.getId(), g));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kind", kind.name());
        out.put("header", selected == null ? null : base.groupingCard(selected, allSchemes, allPieces, schemeHype, self));
        out.put("schemes", t.equals("PECAS") ? List.of() : ss.stream().limit(60).map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            m.put("grouping", byId.get(s.getGroupingId()).getLabel());
            return m;
        }).toList());
        out.put("pieces", t.equals("ESQUEMAS") ? List.of() : ps.stream().limit(60).map(w -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("piece", Views.piece(w, null, null));
            m.put("grouping", byId.get(w.getGroupingId()).getLabel());
            return m;
        }).toList());
        out.put("years", gs.stream().filter(g -> g.getPeriodFrom() != null).flatMap(g -> java.util.stream.IntStream
                .rangeClosed(g.getPeriodFrom(), g.getPeriodTo() == null ? g.getPeriodFrom() : g.getPeriodTo()).boxed()).distinct().sorted().toList());
        out.put("sorts", SHOWCASE_SORTS);
        return out;
    }

    private static boolean contains(String hay, String needle) {
        return hay != null && hay.toLowerCase(Locale.ROOT).contains(needle);
    }

    /**
     * P1-05 — ordem dos looks/peças de uma era ou coleção. HYPE = HypeScore v2 (público para quem visita; o dono do perfil
     * usa o pessoal), sem Hype = por último; GROWTH = variação de 7 dias em pontos e, no empate, a dimensão TREND
     * (crescimento ≠ popularidade); CURTIDAS = popularidade; RECENTES = cadastro. Desempate: mais recente.
     */
    static <T> Comparator<T> order(String sort, Function<T, HypeScoreCurrent> hype, boolean self,
                                   java.util.function.ToLongFunction<T> likes, Function<T, Instant> created) {
        String s = sort == null ? "HYPE" : sort.toUpperCase(Locale.ROOT);
        Comparator<T> recent = Comparator.comparing(created, Comparator.nullsLast(Comparator.reverseOrder()));
        Comparator<Double> desc = Comparator.nullsLast(Comparator.reverseOrder());
        return switch (s) {
            case "CURTIDAS", "LIKES" -> Comparator.comparingLong(likes).reversed().thenComparing(recent);
            case "RECENTES", "RECENT" -> recent;
            case "GROWTH", "CRESCIMENTO", "EM_CRESCIMENTO" -> Comparator.comparing((T x) -> SearchHype.growthFor(hype.apply(x), self), desc)
                    .thenComparing(x -> SearchHype.trendFor(hype.apply(x), self), desc)
                    .thenComparing(recent);
            default -> Comparator.comparing((T x) -> SearchHype.scoreFor(hype.apply(x), self), desc).thenComparing(recent);
        };
    }
}
