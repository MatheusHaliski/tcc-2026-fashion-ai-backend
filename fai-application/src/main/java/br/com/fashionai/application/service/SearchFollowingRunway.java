package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SearchService.Cursor;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Share;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.ShareRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The Runway (RF7/RF19) — o "Seguindo": looks de quem eu sigo (timeline do Cassandra quando ligada), compartilhamentos
 * no feed de quem eu sigo e os meus, looks vinculados às marcas seguidas (RF14.CA05) e, sem nada disso, a comunidade.
 */
final class SearchFollowingRunway {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final FollowRepository follows;
    private final ShareRepository shares;
    private final SealBondRepository bonds;
    private final ObjectProvider<TimelineProjectionPort> timeline;
    private final SchemeService schemeService;
    private final ChallengeService challenges;
    private final SearchVisibility visibility;

    SearchFollowingRunway(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, UserRepository users,
                          FollowRepository follows, ShareRepository shares, SealBondRepository bonds,
                          ObjectProvider<TimelineProjectionPort> timeline, SchemeService schemeService, ChallengeService challenges,
                          SearchVisibility visibility) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.follows = follows;
        this.shares = shares;
        this.bonds = bonds;
        this.timeline = timeline;
        this.schemeService = schemeService;
        this.challenges = challenges;
        this.visibility = visibility;
    }

    /** Conteúdo de uma entrada do "Seguindo": o look ou a peça compartilhada. */
    private static Object entryContent(Map<String, Object> e) {
        return e.containsKey("scheme") ? e.get("scheme") : e.get("piece");
    }

    private static UUID entryId(Map<String, Object> e) {
        return entryContent(e) instanceof Scheme s ? s.getId() : ((WardrobeItem) e.get("piece")).getId();
    }

    /** Entrada de compartilhamento no feed (RF19.CA08): look ou peça e quem compartilhou (o post não tem descrição). */
    private Map<String, Object> sharedEntry(Share sh) {
        Object content = switch (sh.getTargetType()) {
            case SCHEME -> schemes.findById(sh.getTargetId()).orElse(null);
            case PIECE -> pieces.findById(sh.getTargetId()).orElse(null);
            default -> null;
        };
        if (content == null) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("reason", "COMPARTILHADO");
        m.put("by", Views.user(sh.getUser()));
        m.put(content instanceof Scheme ? "scheme" : "piece", content);
        m.put("at", sh.getCreatedAt());
        return m;
    }

    Map<String, Object> runway(CurrentUser viewer, String rawCursor, int size) {
        int limit = Math.max(1, Math.min(size <= 0 ? 20 : size, 50));
        Cursor cursor = Cursor.parse(rawCursor);
        Set<UUID> blocked = visibility.blockedFor(viewer.id());
        List<UUID> following = follows.findByFollowerIdAndStatus(viewer.id(), FollowStatus.ACEITO).stream().map(f -> f.getFollowing().getId()).toList();
        Map<UUID, Map<String, Object>> entries = new LinkedHashMap<>();
        if (!following.isEmpty()) {
            List<UUID> ids = new ArrayList<>();
            TimelineProjectionPort tl = timeline.getIfAvailable();
            if (tl != null && tl.enabled()) {
                ids.addAll(tl.readTimeline(viewer.id(), 300));
            }
            List<Scheme> fromFollowing = ids.isEmpty() ? schemes.findFeedForFollowing(following, PageRequest.of(0, 300)) : schemes.findByIdIn(ids);
            fromFollowing.forEach(s -> entries.putIfAbsent(s.getId(), Map.of("reason", "SEGUINDO", "scheme", s, "at", s.getPublishedAt() == null ? s.getCreatedAt() : s.getPublishedAt())));
            // compartilhamentos no feed de quem eu sigo: looks e peças (RF19.CA08)
            for (Share sh : shares.findFeedShares(following, ShareChannel.FEED, PageRequest.of(0, 200))) {
                if (!entries.containsKey(sh.getTargetId()) && !blocked.contains(sh.getUser().getId())) {
                    Map<String, Object> e = sharedEntry(sh);
                    if (e != null) {
                        entries.put(sh.getTargetId(), e);
                    }
                }
            }
            // RF14.CA05 — seguir uma marca traz ao feed os esquemas vinculados a ela
            for (UUID f : following) {
                users.findById(f).filter(u -> u.getProfileType() != ProfileType.PESSOAL).ifPresent(inst ->
                        bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(inst.getId(), SealBondStatus.APPROVED).stream().filter(b -> b.getScheme() != null).limit(30)
                                .forEach(b -> entries.putIfAbsent(b.getScheme().getId(), Map.of("reason", "VINCULO_" + inst.getProfileType().name(),
                                        "brand", Views.user(inst), "scheme", b.getScheme(), "at", b.getUpdatedAt()))));
            }
        }
        boolean fallback = entries.isEmpty();
        if (fallback) {
            schemes.findPublicFeed(PageRequest.of(0, 200)).forEach(s -> entries.putIfAbsent(s.getId(), Map.of("reason", "COMUNIDADE", "scheme", s, "at", s.getPublishedAt())));
        }
        // o que EU publiquei no feed aparece no meu "Seguindo" (como numa rede social), por cima da entrada mais antiga
        for (Share sh : shares.findFeedShares(List.of(viewer.id()), ShareChannel.FEED, PageRequest.of(0, 50))) {
            Map<String, Object> prev = entries.get(sh.getTargetId());
            if (prev == null || ((Instant) prev.get("at")).isBefore(sh.getCreatedAt())) {
                Map<String, Object> e = sharedEntry(sh);
                if (e != null) {
                    entries.put(sh.getTargetId(), e);
                }
            }
        }
        List<Map<String, Object>> sorted = entries.values().stream()
                .filter(e -> entryContent(e) instanceof Scheme s ? visibility.visible(viewer, s, blocked) : visibility.visible(viewer, (WardrobeItem) e.get("piece"), blocked))
                .filter(e -> cursor == null || cursor.before((Instant) e.get("at"), entryId(e)))
                .sorted(Comparator.comparing((Map<String, Object> e) -> (Instant) e.get("at")).thenComparing(SearchFollowingRunway::entryId).reversed())
                .limit(limit).toList();
        List<Map<String, Object>> items = sorted.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>(e);
            if (entryContent(e) instanceof Scheme s) {
                m.put("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            } else {
                m.put("piece", Views.piece((WardrobeItem) e.get("piece"), null, null));
            }
            return m;
        }).toList();
        String next = sorted.size() == limit ? new Cursor((Instant) sorted.get(limit - 1).get("at"), entryId(sorted.get(limit - 1))).encode() : null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("nextCursor", next);
        out.put("fallbackToCommunity", fallback);
        out.put("waywt", Map.of("title", Msg.t("search.waywt_o_que_voce_esta"), "hint", Msg.t("search.compartilhe_o_seu_look_do")));
        out.put("battles", challenges.voteFeed(viewer));
        return out;
    }
}
