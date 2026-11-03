package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.moments.MomentRules.contextualHype;
import static br.com.fashionai.application.moments.MomentRules.idOf;
import static br.com.fashionai.application.moments.MomentRules.rounded;
import static br.com.fashionai.application.moments.MomentRules.top;
import static br.com.fashionai.application.moments.MomentService.FEED_MAX;

/** Comunidade do Momento: envios visíveis para quem olha, feed, card do envio e "em alta" (§36). */
final class MomentCommunity extends MomentSupport {
    MomentCommunity(MomentContext ctx) {
        super(ctx);
    }

    /**
     * Envios que QUEM OLHA pode ver, na ordem do repositório (mais recentes primeiro): o próprio look, tudo para
     * administração e membros de um Momento de grupo, e para os demais só looks liberados pela regra de visibilidade do
     * Guard (PUBLIC; FOLLOWERS para quem segue). Feed, ranking e trending passam por aqui — um look PRIVATE enviado a um
     * Momento público nunca aparece (título, capa, dono ou ids) para quem não poderia abri-lo.
     */
    List<MomentSubmission> visibleSubmissions(CurrentUser viewer, Moment m, Map<UUID, Scheme> schemesOut) {
        boolean member = viewer != null && (viewer.admin() || (m.getGroupId() != null && isMember(viewer.id(), m.getGroupId())));
        List<MomentSubmission> subs = submissions.findByMomentIdAndWithdrawnFalseOrderBySubmittedAtDesc(m.getId());
        Map<UUID, Scheme> byId = schemes.findByIdIn(subs.stream().map(MomentSubmission::getSchemeId).toList()).stream()
                .collect(Collectors.toMap(Scheme::getId, x -> x, (a, b) -> a));
        List<MomentSubmission> out = new ArrayList<>();
        for (MomentSubmission s : subs) {
            Scheme sc = byId.get(s.getSchemeId());
            if (sc == null) {
                continue;
            }
            boolean own = viewer != null && viewer.id().equals(s.getUserId());
            if (own || member || guard.canView(viewer, sc.getUser().getId(), sc.getVisibility())) {
                out.add(s);
                schemesOut.put(sc.getId(), sc);
            }
        }
        return out;
    }

    /** Feed do Momento: looks enviados; só públicos para quem não é membro, tudo para membros de um Momento de grupo. */
    Map<String, Object> feed(CurrentUser viewer, String idOrSlug) {
        Moment m = visible(viewer, idOrSlug);
        Map<UUID, Scheme> byId = new HashMap<>();
        List<MomentSubmission> subs = visibleSubmissions(viewer, m, byId);
        Set<UUID> myVotes = viewer == null ? Set.of() : votes.findByMomentIdAndVoterId(m.getId(), viewer.id()).stream().map(MomentVote::getSubmissionId).collect(Collectors.toSet());
        List<MomentSubmission> page = subs.stream().limit(FEED_MAX).toList();
        Map<UUID, Double> hypes = hypeScores(HypeEntityType.SCHEME, page.stream().map(MomentSubmission::getSchemeId).toList(), idOf(viewer));
        List<Map<String, Object>> items = new ArrayList<>();
        for (MomentSubmission s : page) {
            items.add(submissionView(s, viewer, byId, myVotes.contains(s.getId()), hypes));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("dimensions", competitive(m) ? List.of(MomentVoteDimension.values()) : List.of());
        return out;
    }

    Map<String, Object> submissionView(MomentSubmission s, CurrentUser viewer, Map<UUID, Scheme> cache, boolean votedByMe) {
        return submissionView(s, viewer, cache, votedByMe, null);
    }

    /** {@code hypes}: HypeScore v2 já lido em lote (feed); nulo = lê só o deste look. */
    Map<String, Object> submissionView(MomentSubmission s, CurrentUser viewer, Map<UUID, Scheme> cache, boolean votedByMe, Map<UUID, Double> hypes) {
        Scheme sc = cache.containsKey(s.getSchemeId()) ? cache.get(s.getSchemeId()) : schemes.findById(s.getSchemeId()).orElse(null);
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", s.getId());
        v.put("schemeId", s.getSchemeId());
        v.put("challengeId", s.getChallengeId());
        v.put("match", s.getMatchScore());
        v.put("matchDetail", Json.map(s.getMatchJson()));
        v.put("wardrobeOnly", s.isWardrobeOnly());
        v.put("rediscovered", Json.strings(s.getRediscoveredJson()).size());
        v.put("votes", s.getVoteCount());
        v.put("votedByMe", votedByMe);
        v.put("submittedAt", s.getSubmittedAt().toString());
        v.put("mine", viewer != null && viewer.id().equals(s.getUserId()));
        if (sc != null) {
            v.put("scheme", Views.scheme(sc, schemeItems.findBySchemeIdOrderBySortOrder(sc.getId()), Views.ViewerState.NONE, Map.of()));
            Double h = hypes == null ? hypeScore(HypeEntityType.SCHEME, sc.getId(), idOf(viewer)) : hypes.get(sc.getId());
            v.put("hype", rounded(h));
            v.put("contextualHype", contextualHype(h, s.getMatchScore()));
        }
        return v;
    }

    /** "Em alta no Halloween" (§36): estilos, cores, interpretações e looks mais votados/com maior Hype contextual. */
    Map<String, Object> trending(CurrentUser viewer, String idOrSlug, int limit) {
        return trending(viewer, visible(viewer, idOrSlug), limit);
    }

    Map<String, Object> trending(CurrentUser viewer, Moment m, int limit) {
        Map<UUID, Scheme> byId = new HashMap<>();
        List<MomentSubmission> subs = visibleSubmissions(viewer, m, byId);
        Map<String, Integer> styles = new HashMap<>(), colors = new HashMap<>(), interps = new HashMap<>();
        List<Map<String, Object>> looks = new ArrayList<>();
        Map<UUID, Double> hypes = hypeScores(HypeEntityType.SCHEME, byId.keySet(), idOf(viewer));
        for (MomentSubmission s : subs) {
            Scheme sc = byId.get(s.getSchemeId());
            Map<String, Object> match = Json.map(s.getMatchJson());
            if (match.get("interpretation") != null) {
                interps.merge(String.valueOf(match.get("interpretation")), 1, Integer::sum);
            }
            Json.csv(sc.getStyle()).forEach(x -> styles.merge(x, 1, Integer::sum));
            for (SchemeItem si : schemeItems.findBySchemeIdOrderBySortOrder(sc.getId())) {
                if (si.getWardrobeItem() != null && si.getWardrobeItem().getColor() != null) {
                    colors.merge(si.getWardrobeItem().getColor(), 1, Integer::sum);
                }
            }
            Map<String, Object> l = new LinkedHashMap<>();
            l.put("schemeId", sc.getId());
            l.put("title", sc.getTitle());
            l.put("coverImageUrl", sc.getCoverImageUrl());
            l.put("votes", s.getVoteCount());
            l.put("match", s.getMatchScore());
            l.put("contextualHype", contextualHype(hypes.get(sc.getId()), s.getMatchScore()));
            looks.add(l);
        }
        looks.sort(Comparator.comparing((Map<String, Object> l) -> (Integer) l.get("votes")).reversed()
                .thenComparing(l -> l.get("contextualHype") == null ? -1 : (Integer) l.get("contextualHype"), Comparator.reverseOrder()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("styles", top(styles, limit));
        out.put("colors", top(colors, limit));
        out.put("interpretations", top(interps, limit));
        out.put("looks", looks.stream().limit(limit).toList());
        out.put("basis", subs.size());
        return out;
    }
}
