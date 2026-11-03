package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.ShowcaseService.Kind;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.ShowcaseService.COLLECTION_TYPES;
import static br.com.fashionai.application.service.ShowcaseService.ERA_TYPES;

/**
 * Eras (celebridade) e Coleções (marca) — RF22: o dono certo para a aba, as eras/coleções em ordem, os looks e peças que
 * quem vê pode abrir, e a lista com o card de cada agrupamento (capa enviada ou a do look de maior HypeScore v2).
 */
final class ShowcaseGroupings {
    private final InstitutionalService institutional;
    private final SchemeGroupingRepository groupings;
    private final SchemeRepository schemes;
    private final WardrobeItemRepository pieces;
    private final SchemeService schemeService;
    private final Guard guard;
    private final ShowcaseHype hypes;

    ShowcaseGroupings(InstitutionalService institutional, SchemeGroupingRepository groupings, SchemeRepository schemes,
                      WardrobeItemRepository pieces, SchemeService schemeService, Guard guard, ShowcaseHype hypes) {
        this.institutional = institutional;
        this.groupings = groupings;
        this.schemes = schemes;
        this.pieces = pieces;
        this.schemeService = schemeService;
        this.guard = guard;
        this.hypes = hypes;
    }

    static boolean self(CurrentUser viewer, User owner) {
        return viewer != null && owner != null && viewer.id().equals(owner.getId());
    }

    User owner(String slug, Kind kind) {
        User u = institutional.institutionalUser(slug);
        if (kind == Kind.ERAS && u.getProfileType() != ProfileType.CELEBRIDADE) {
            throw ApiException.notFound(Msg.t("showcase.eras_so_perfis_de_celebridade"));
        }
        if (kind == Kind.COLLECTIONS && u.getProfileType() != ProfileType.MARCA) {
            throw ApiException.notFound(Msg.t("showcase.colecoes_so_perfis_de_marca"));
        }
        return u;
    }

    List<SchemeGrouping> groupingsOf(User u, Kind kind) {
        Set<GroupingType> types = kind == Kind.ERAS ? ERA_TYPES : COLLECTION_TYPES;
        return groupings.findByOwnerIdOrderByCreatedAtDesc(u.getId()).stream().filter(g -> types.contains(g.getType()))
                .sorted(Comparator.comparingInt(SchemeGrouping::getSortOrder)
                        .thenComparing(g -> g.getPeriodFrom() == null ? Integer.MAX_VALUE : g.getPeriodFrom()))
                .toList();
    }

    List<Scheme> visibleSchemes(CurrentUser viewer, User u) {
        boolean self = viewer != null && viewer.id().equals(u.getId());
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(u.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> self || s.getStatus() == SchemeStatus.PUBLISHED)
                .filter(s -> schemeService.canView(viewer, s)).toList();
    }

    List<WardrobeItem> visiblePieces(CurrentUser viewer, User u) {
        return pieces.findByUserIdOrderByCreatedAtDesc(u.getId()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> guard.canView(viewer, u.getId(), SchemeService.moreRestrictive(w.getVisibility(), u.getProfileVisibility())))
                .toList();
    }

    /** Lista de eras/coleções com contagem, capa (ou a capa do esquema mais hypado) e período. */
    Map<String, Object> list(CurrentUser viewer, String slug, Kind kind) {
        User u = owner(slug, kind);
        List<Scheme> ss = visibleSchemes(viewer, u);
        List<WardrobeItem> ps = visiblePieces(viewer, u);
        Map<UUID, HypeScoreCurrent> hype = hypes.of(HypeEntityType.SCHEME, ss.stream().map(Scheme::getId).toList());
        List<Map<String, Object>> out = new ArrayList<>();
        for (SchemeGrouping g : groupingsOf(u, kind)) {
            out.add(groupingCard(g, ss, ps, hype, self(viewer, u)));
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("kind", kind.name());
        res.put("owner", Views.user(u));
        res.put("items", out);
        res.put("ungrouped", Map.of("schemes", ss.stream().filter(s -> s.getGroupingId() == null).count(),
                "pieces", ps.stream().filter(w -> w.getGroupingId() == null).count()));
        return res;
    }

    /** Card da era/coleção. Sem capa enviada, usa a capa do look de maior HypeScore v2 (público, ou pessoal para o dono). */
    Map<String, Object> groupingCard(SchemeGrouping g, List<Scheme> ss, List<WardrobeItem> ps, Map<UUID, HypeScoreCurrent> hype, boolean self) {
        List<Scheme> gs = ss.stream().filter(s -> g.getId().equals(s.getGroupingId())).toList();
        List<WardrobeItem> gp = ps.stream().filter(w -> g.getId().equals(w.getGroupingId())).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", g.getId());
        m.put("type", g.getType().name());
        m.put("label", g.getLabel());
        m.put("description", g.getDescription());
        m.put("periodFrom", g.getPeriodFrom());
        m.put("periodTo", g.getPeriodTo());
        m.put("period", period(g));
        m.put("editorial", br.com.fashionai.application.common.Json.map(g.getEditorialJson()));
        m.put("accentColor", g.getAccentColor() == null ? "#2D55C9" : g.getAccentColor());
        String cover = g.getCoverUrl();
        String coverSource = "upload";
        if (cover == null) {
            cover = gs.stream().filter(s -> s.getCoverImageUrl() != null)
                    .max(Comparator.comparing((Scheme s) -> SearchHype.scoreFor(hype.get(s.getId()), self), Comparator.nullsFirst(Comparator.naturalOrder())))
                    .map(Scheme::getCoverImageUrl).orElse(gp.stream().map(w -> w.getStudioImageUrl() != null ? w.getStudioImageUrl() : w.getImageUrl())
                            .filter(Objects::nonNull).findFirst().orElse(null));
            coverSource = cover == null ? "nenhuma" : "esquema";
        }
        m.put("coverUrl", cover);
        m.put("coverSource", coverSource);
        m.put("schemes", gs.size());
        m.put("pieces", gp.size());
        return m;
    }

    static String period(SchemeGrouping g) {
        if (g.getPeriodFrom() == null) {
            return null;
        }
        return g.getPeriodTo() == null || g.getPeriodTo().equals(g.getPeriodFrom()) ? String.valueOf(g.getPeriodFrom())
                : g.getPeriodFrom() + "–" + g.getPeriodTo();
    }
}
