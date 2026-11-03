package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.Visibility;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.moments.MomentRules.outcome;

/** Histórico pessoal: Meus Momentos (§41), linha do tempo pública e FashionAI Replay (§42). */
final class MomentHistory extends MomentSupport {
    MomentHistory(MomentContext ctx) {
        super(ctx);
    }

    /** Meus Momentos (§41): salvos, em andamento, concluídos e badges — base do Perfil → Momentos. */
    Map<String, Object> mine(CurrentUser user) {
        Instant now = now();
        List<MomentParticipation> all = participations.findByUserIdOrderByCreatedAtDesc(user.id());
        Map<UUID, Moment> byId = moments.findByIdIn(all.stream().map(MomentParticipation::getMomentId).toList()).stream().collect(Collectors.toMap(Moment::getId, m -> m));
        List<Map<String, Object>> saved = new ArrayList<>(), active = new ArrayList<>(), done = new ArrayList<>();
        for (MomentParticipation p : all) {
            Moment m = byId.get(p.getMomentId());
            if (m == null) {
                continue;
            }
            Map<String, Object> c = MomentViews.card(m, now);
            c.put("me", participationView(p));
            MomentStatus eff = MomentTime.effective(m, now);
            if (eff == MomentStatus.ENDED || eff == MomentStatus.ARCHIVED) {
                done.add(c);
            } else if (p.getStatus() == MomentParticipationStatus.INTERESTED) {
                saved.add(c);
            } else if (p.getStatus() != MomentParticipationStatus.LEFT) {
                active.add(c);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("now", now.toString());
        out.put("saved", saved);
        out.put("active", active);
        out.put("completed", done);
        out.put("badges", badges(user.id()));
        out.put("summary", mineSummary(user.id()));
        return out;
    }

    Map<String, Object> mineSummary(UUID userId) {
        List<MomentParticipation> all = participations.findByUserIdOrderByCreatedAtDesc(userId);
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("saved", all.stream().filter(p -> p.getStatus() == MomentParticipationStatus.INTERESTED).count());
        s.put("participated", all.stream().filter(p -> p.getStatus() != MomentParticipationStatus.INTERESTED && p.getStatus() != MomentParticipationStatus.LEFT).count());
        s.put("completed", all.stream().filter(p -> p.getStatus() == MomentParticipationStatus.COMPLETED).count());
        s.put("points", all.stream().mapToInt(MomentParticipation::getPointsEarned).sum());
        return s;
    }

    List<Map<String, Object>> badges(UUID userId) {
        return achievements.findByUserIdOrderByGrantedAtDesc(userId).stream().filter(a -> a.getAchievementCode().startsWith("MOMENT_"))
                .map(a -> Map.<String, Object>of("code", a.getAchievementCode(), "grantedAt", a.getGrantedAt().toString())).toList();
    }

    /**
     * Linha do tempo pública de uma pessoa (§41): só participações marcadas como públicas, em Momentos PUBLIC, e só se
     * o perfil da pessoa está visível para quem olha. O próprio dono vê tudo.
     */
    Map<String, Object> timeline(CurrentUser viewer, UUID userId) {
        Instant now = now();
        boolean self = viewer != null && viewer.id().equals(userId);
        User owner = users.findById(userId).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (!self && !guard.canView(viewer, userId, owner.getProfileVisibility() == null ? Visibility.PRIVATE : owner.getProfileVisibility())) {
            return Map.of("years", List.of(), "visible", false);
        }
        List<MomentParticipation> all = participations.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(p -> p.getStatus() != MomentParticipationStatus.INTERESTED && p.getStatus() != MomentParticipationStatus.LEFT)
                .filter(p -> self || p.isPublicOnProfile()).toList();
        Map<UUID, Moment> byId = moments.findByIdIn(all.stream().map(MomentParticipation::getMomentId).toList()).stream()
                .filter(m -> self || m.getVisibility().discoverable()).collect(Collectors.toMap(Moment::getId, m -> m));
        Map<Integer, List<Map<String, Object>>> years = new java.util.TreeMap<>(Comparator.reverseOrder());
        for (MomentParticipation p : all) {
            Moment m = byId.get(p.getMomentId());
            if (m == null) {
                continue;
            }
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("momentId", m.getId());
            e.put("slug", m.getSlug());
            e.put("name", MomentViews.localized(m.getName(), m.getNamesJson()));
            e.put("type", m.getType().name());
            e.put("theme", MomentViews.theme(m));
            e.put("localStart", MomentTime.localStart(m).toString());
            e.put("localEnd", MomentTime.localEnd(m).toString());
            e.put("status", p.getStatus().name());
            e.put("outcome", outcome(p));
            e.put("ranking", p.getRanking());
            e.put("percentile", p.getPercentile());
            e.put("badgeCode", p.getBadgeCode());
            e.put("publicOnProfile", p.isPublicOnProfile());
            if (self) {
                e.put("pointsEarned", p.getPointsEarned());
            }
            years.computeIfAbsent(MomentTime.localStart(m).getYear(), k -> new ArrayList<>()).add(e);
        }
        List<Map<String, Object>> out = years.entrySet().stream().map(en -> Map.<String, Object>of("year", en.getKey(), "items", en.getValue())).toList();
        return Map.of("years", out, "visible", true, "now", now.toString());
    }

    /** FashionAI Replay (§42): "em {ano} você…", calculado das participações e envios. */
    Map<String, Object> replay(CurrentUser user, int year) {
        ZoneId zone = ZoneId.of("America/Sao_Paulo");
        List<MomentParticipation> all = participations.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(p -> p.getJoinedAt() != null && p.getJoinedAt().atZone(zone).getYear() == year).toList();
        Map<UUID, Moment> byId = moments.findByIdIn(all.stream().map(MomentParticipation::getMomentId).toList()).stream().collect(Collectors.toMap(Moment::getId, m -> m));
        List<MomentSubmission> subs = submissions.findByUserIdAndWithdrawnFalse(user.id()).stream().filter(s -> s.getSubmittedAt().atZone(zone).getYear() == year).toList();
        Set<String> styles = new LinkedHashSet<>();
        Set<String> rediscovered = new LinkedHashSet<>();
        Map<Integer, Integer> byMonth = new HashMap<>();
        for (MomentSubmission s : subs) {
            Map<String, Object> match = Json.map(s.getMatchJson());
            Object reasons = match.get("reasons");
            if (reasons instanceof List<?> l) {
                l.forEach(r -> {
                    String x = String.valueOf(r);
                    if (x.startsWith("style:")) {
                        styles.addAll(Json.csv(x.substring(6)));
                    }
                });
            }
            rediscovered.addAll(Json.strings(s.getRediscoveredJson()));
            byMonth.merge(s.getSubmittedAt().atZone(zone).getMonthValue(), 1, Integer::sum);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("year", year);
        out.put("moments", all.size());
        out.put("completed", all.stream().filter(p -> p.getStatus() == MomentParticipationStatus.COMPLETED).count());
        out.put("looks", subs.size());
        out.put("stylesTried", styles.size());
        out.put("rediscoveredPieces", rediscovered.size());
        out.put("points", all.stream().mapToInt(MomentParticipation::getPointsEarned).sum());
        out.put("bestMonth", byMonth.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null));
        out.put("favoriteMoment", all.stream().filter(p -> byId.containsKey(p.getMomentId())).max(Comparator.comparingInt(MomentParticipation::getPointsEarned))
                .map(p -> MomentViews.localized(byId.get(p.getMomentId()).getName(), byId.get(p.getMomentId()).getNamesJson())).orElse(null));
        out.put("peakHype", subs.stream().map(MomentSubmission::getHypeAtSubmission).filter(Objects::nonNull).max(Integer::compare)
                .map(h -> Map.of("hype", h, "moment", subs.stream().filter(s -> h.equals(s.getHypeAtSubmission())).findFirst()
                        .map(s -> byId.containsKey(s.getMomentId()) ? MomentViews.localized(byId.get(s.getMomentId()).getName(), byId.get(s.getMomentId()).getNamesJson()) : null).orElse(null))).orElse(null));
        return out;
    }
}
