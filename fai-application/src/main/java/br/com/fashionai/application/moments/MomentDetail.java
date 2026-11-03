package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Página do Momento (§52) e looks candidatos ao envio. */
final class MomentDetail extends MomentSupport {
    MomentDetail(MomentContext ctx) {
        super(ctx);
    }

    /** Detalhe (MomentPage genérica, §52): dados + desafios + minha participação + estatísticas + ranking/feed resumidos. */
    Map<String, Object> detail(CurrentUser viewer, String idOrSlug) {
        Instant now = now();
        Moment m = visible(viewer, idOrSlug);
        Map<String, Object> out = MomentViews.card(m, now);
        out.put("interpretations", MomentViews.interpretations(m));
        out.put("challenges", challenges.findByMomentIdOrderBySortOrderAsc(m.getId()).stream().filter(MomentChallenge::isActive).map(MomentViews::challenge).toList());
        out.put("rules", Json.map(m.getRulesJson()));
        out.put("settings", settings(m));
        out.put("requiredItems", Json.strings(m.getRequiredItemsJson()));
        out.put("suggestedItems", Json.strings(m.getSuggestedItemsJson()));
        out.put("sourceUrl", m.getSourceUrl());
        out.put("sourceNote", m.getSourceNote());
        out.put("bonusRules", MomentPointsPolicy.bonusRules(m));
        out.put("sensitive", m.getNature().sensitive());
        out.put("competitive", competitive(m));
        out.put("cooperative", m.getFlairMode() == FlairMomentMode.COOPERATIVE);
        boolean member = viewer != null && (viewer.admin() || viewer.id().equals(m.getCreatedByUserId()) || (m.getGroupId() != null && isMember(viewer.id(), m.getGroupId())));
        out.put("isCreator", viewer != null && viewer.id().equals(m.getCreatedByUserId()));
        out.put("isMember", member);
        long engaged = participations.countByMomentIdAndStatusIn(m.getId(), ENGAGED);
        long looks = submissions.countByMomentIdAndWithdrawnFalse(m.getId());
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("participants", m.getVisibility().discoverable() || member ? engaged : null);
        stats.put("looks", m.getVisibility().discoverable() || member ? looks : null);
        if (m.getCooperativeGoal() != null) {
            stats.put("goal", m.getCooperativeGoal());
            stats.put("goalFraction", Math.min(1.0, looks / (double) Math.max(1, m.getCooperativeGoal())));
        }
        out.put("stats", stats);
        if (viewer != null) {
            MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), viewer.id()).orElse(null);
            out.put("me", participationView(p));
            out.put("mySubmissions", submissions.findByMomentIdAndUserIdAndWithdrawnFalse(m.getId(), viewer.id()).stream().map(s -> new MomentCommunity(ctx).submissionView(s, viewer, Map.of(), false)).toList());
        }
        if (m.getGroupId() != null && member) {
            teams.findById(m.getGroupId()).ifPresent(t -> {
                Map<String, Object> g = new LinkedHashMap<>();   // cor do grupo é opcional: Map.of recusaria o nulo
                g.put("id", t.getId());
                g.put("name", t.getName());
                g.put("color", t.getColor());
                out.put("group", g);
            });
            out.put("participants", participants(m));
        }
        out.put("trending", new MomentCommunity(ctx).trending(viewer, m, 6));
        if (MomentTime.effective(m, now) == MomentStatus.ENDED) {
            out.put("memory", Json.map(m.getMemoryJson()));
        }
        return out;
    }

    List<Map<String, Object>> participants(Moment m) {
        List<MomentParticipation> ps = participations.findByMomentIdAndStatusIn(m.getId(), ENGAGED);
        Map<UUID, User> us = users.findAllById(ps.stream().map(MomentParticipation::getUserId).toList()).stream().collect(Collectors.toMap(User::getId, u -> u));
        return ps.stream().map(p -> {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("user", Views.user(us.get(p.getUserId())));
            v.put("status", p.getStatus().name());
            v.put("ranking", p.getRanking());
            return v;
        }).toList();
    }

    /** Looks da pessoa disponíveis para enviar (os já enviados vêm marcados). */
    List<Map<String, Object>> candidateLooks(CurrentUser user, String idOrSlug) {
        Moment m = visible(user, idOrSlug);
        Set<UUID> sent = submissions.findByMomentIdAndUserIdAndWithdrawnFalse(m.getId(), user.id()).stream().map(MomentSubmission::getSchemeId).collect(Collectors.toSet());
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED).stream().limit(80).map(s -> {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("id", s.getId());
            v.put("title", s.getTitle());
            v.put("coverImageUrl", s.getCoverImageUrl());
            v.put("status", s.getStatus().name());
            v.put("visibility", s.getVisibility().name());
            v.put("createdAt", s.getCreatedAt() == null ? null : s.getCreatedAt().toString());
            v.put("sent", sent.contains(s.getId()));
            return v;
        }).toList();
    }
}
