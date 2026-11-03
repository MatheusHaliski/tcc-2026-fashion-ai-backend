package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import br.com.fashionai.domain.model.enums.NotificationType;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.moments.MomentRules.nz;
import static br.com.fashionai.application.moments.MomentRules.publiclyListed;
import static br.com.fashionai.application.moments.MomentRules.strings;
import static br.com.fashionai.application.moments.MomentRules.top;
import static br.com.fashionai.application.moments.MomentService.DEFAULT_COOP_POINTS;
import static br.com.fashionai.application.moments.MomentService.MAX_PRIZE;

/** Job (§45, §44): transições de status, avisos de início e de prazo, e o encerramento com ranking, prêmios e Memória. */
final class MomentLifecycle extends MomentSupport {
    MomentLifecycle(MomentContext ctx) {
        super(ctx);
    }

    /** Passa a cada 5 min: SCHEDULED→ACTIVE, ACTIVE→ENDED (Memória, ranking, prêmios), avisos de início e de prazo. */
    Map<String, Integer> tick() {
        Instant now = now();
        int started = 0, ended = 0, reminded = 0, deadlines = 0;
        for (Moment m : moments.findByStatusIn(LIVE)) {
            MomentStatus eff = MomentTime.effective(m, now);
            if (m.getStatus() == MomentStatus.SCHEDULED && eff == MomentStatus.ACTIVE) {
                m.setStatus(MomentStatus.ACTIVE);
                moments.save(m);
                started++;
            } else if (eff == MomentStatus.ENDED) {
                end(m);
                ended++;
                continue;
            }
            // "começa esta semana" — só para quem pediu lembrete, uma vez
            if (eff == MomentStatus.SCHEDULED && MomentTime.startsInSeconds(m, now) <= 7 * 86400L) {
                for (MomentParticipation p : participations.findByMomentId(m.getId())) {
                    if (p.isRemind() && !p.isRemindSent()) {
                        notifications.notify(p.getUserId(), null, NotificationType.MOMENT_STARTING, "MOMENT", m.getId(),
                                Msg.k("moment.notif.comeca_titulo", MomentViews.localized(m.getName(), m.getNamesJson())),
                                Msg.k("moment.notif.comeca_corpo", MomentTime.localStart(m).toString()), Map.of("href", "/moments/" + m.getSlug()));
                        p.setRemindSent(true);
                        participations.save(p);
                        reminded++;
                    }
                }
            }
            // "faltam dois dias para enviar seu look" — quem entrou e ainda não enviou, uma vez
            if (eff == MomentStatus.ACTIVE && MomentTime.endsInSeconds(m, now) <= 2 * 86400L) {
                for (MomentParticipation p : participations.findByMomentIdAndStatusIn(m.getId(), List.of(MomentParticipationStatus.JOINED))) {
                    if (!p.isDeadlineNotified()) {
                        notifications.notify(p.getUserId(), null, NotificationType.MOMENT_DEADLINE, "MOMENT", m.getId(),
                                Msg.k("moment.notif.prazo_titulo", MomentViews.localized(m.getName(), m.getNamesJson())),
                                Msg.k("moment.notif.prazo_corpo"), Map.of("href", "/moments/" + m.getSlug()));
                        p.setDeadlineNotified(true);
                        participations.save(p);
                        deadlines++;
                    }
                }
            }
        }
        return Map.of("started", started, "ended", ended, "reminded", reminded, "deadlines", deadlines);
    }

    /** ACTIVE → ENDED: ranking/percentis nas participações, prêmios e meta cooperativa pelo ledger, Memória gravada. */
    void end(Moment m) {
        Instant now = now();
        List<MomentSubmission> subs = submissions.findByMomentIdAndWithdrawnFalseOrderBySubmittedAtDesc(m.getId());
        List<MomentParticipation> ps = participations.findByMomentId(m.getId());
        Map<UUID, MomentParticipation> byUser = ps.stream().collect(Collectors.toMap(MomentParticipation::getUserId, p -> p, (a, b) -> a));
        Map<UUID, Map<MomentVoteDimension, Integer>> byDim = new HashMap<>();
        List<MomentVote> allVotes = votes.findByMomentId(m.getId());
        for (MomentVote v : allVotes) {
            byDim.computeIfAbsent(v.getSubmissionId(), k -> new java.util.EnumMap<>(MomentVoteDimension.class)).merge(v.getDimension(), 1, Integer::sum);
        }
        // melhor envio por pessoa → ranking. Em Momento público, só looks PUBLIC disputam ranking, prêmio e destaque:
        // a Memória e o ranking final são lidos por qualquer pessoa, sem filtro de quem olha.
        Map<UUID, Scheme> subSchemes = schemes.findByIdIn(subs.stream().map(MomentSubmission::getSchemeId).toList()).stream()
                .collect(Collectors.toMap(Scheme::getId, x -> x, (a, b) -> a));
        List<MomentSubmission> listed = subs.stream().filter(s -> publiclyListed(m, subSchemes.get(s.getSchemeId()))).toList();
        Map<UUID, MomentSubmission> best = new LinkedHashMap<>();
        for (MomentSubmission s : listed) {
            best.merge(s.getUserId(), s, (a, b) -> a.getVoteCount() != b.getVoteCount() ? (a.getVoteCount() > b.getVoteCount() ? a : b)
                    : (nz(a.getMatchScore()) >= nz(b.getMatchScore()) ? a : b));
        }
        List<MomentSubmission> ranked = best.values().stream().sorted(Comparator.comparingInt(MomentSubmission::getVoteCount).reversed()
                .thenComparing(s -> nz(s.getMatchScore()), Comparator.reverseOrder()).thenComparing(MomentSubmission::getSubmittedAt)).toList();
        boolean competitive = competitive(m);
        List<Integer> prizes = competitive ? strings(settings(m).get("prizes")).stream().map(x -> (int) Double.parseDouble(x)).toList() : List.of();
        int n = ranked.size();
        for (int i = 0; i < n; i++) {
            MomentParticipation p = byUser.get(ranked.get(i).getUserId());
            if (p == null) {
                continue;
            }
            if (competitive) {
                p.setRanking(i + 1);
                p.setPercentile((int) Math.ceil(100.0 * (i + 1) / n));
                if (i < prizes.size() && prizes.get(i) > 0 && n >= 3 && m.isPointsEnabled()) {
                    FaiPointsService.Award a = points.award(p.getUserId(), "MOMENT_PRIZE", "MOMENT", m.getId() + ":prize", Math.min(MAX_PRIZE, prizes.get(i)));
                    if (a.granted()) {
                        p.setPointsEarned(p.getPointsEarned() + a.points());
                    }
                }
            }
            participations.save(p);
        }
        boolean goalReached = m.getFlairMode() == FlairMomentMode.COOPERATIVE && m.getCooperativeGoal() != null && subs.size() >= m.getCooperativeGoal();
        if (goalReached && m.isPointsEnabled()) {
            int coop = ((Number) settings(m).getOrDefault("coopPoints", DEFAULT_COOP_POINTS)).intValue();
            for (MomentParticipation p : ps) {
                if (ENGAGED.contains(p.getStatus())) {
                    FaiPointsService.Award a = points.award(p.getUserId(), "MOMENT_COOP_GOAL", "MOMENT", m.getId() + ":coop", Math.max(1, Math.min(MAX_PRIZE, coop)));
                    if (a.granted()) {
                        p.setPointsEarned(p.getPointsEarned() + a.points());
                        participations.save(p);
                    }
                }
            }
        }
        Map<String, Object> memory = new LinkedHashMap<>();
        memory.put("endedAt", now.toString());
        memory.put("participants", ps.stream().filter(p -> ENGAGED.contains(p.getStatus())).count());
        memory.put("looks", subs.size());
        memory.put("votes", allVotes.size());
        memory.put("goalReached", goalReached);
        memory.put("winner", competitive && !ranked.isEmpty() ? memoryLook(ranked.get(0), m) : null);
        for (MomentVoteDimension d : List.of(MomentVoteDimension.CREATIVE, MomentVoteDimension.ELEGANT, MomentVoteDimension.TREND, MomentVoteDimension.ORIGINAL, MomentVoteDimension.THEME)) {
            MomentSubmission top = listed.stream().filter(s -> byDim.getOrDefault(s.getId(), Map.of()).getOrDefault(d, 0) > 0)
                    .max(Comparator.comparingInt(s -> byDim.get(s.getId()).get(d))).orElse(null);
            memory.put("most" + d.name().charAt(0) + d.name().substring(1).toLowerCase(Locale.ROOT), top == null ? null : memoryLook(top, m));
        }
        memory.put("interpretations", top(subs.stream().map(s -> String.valueOf(Json.map(s.getMatchJson()).get("interpretation"))).filter(x -> !"null".equals(x))
                .collect(Collectors.groupingBy(x -> x, Collectors.summingInt(x -> 1))), 5));
        m.setMemoryJson(Json.write(memory));
        m.setStatus(MomentStatus.ENDED);
        moments.save(m);
    }

    Map<String, Object> memoryLook(MomentSubmission s, Moment m) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("submissionId", s.getId());
        l.put("schemeId", s.getSchemeId());
        l.put("votes", s.getVoteCount());
        l.put("match", s.getMatchScore());
        schemes.findById(s.getSchemeId()).ifPresent(sc -> {
            l.put("title", sc.getTitle());
            l.put("coverImageUrl", sc.getCoverImageUrl());
            // perfil público só em Momentos públicos (§28)
            l.put("user", m.getVisibility().discoverable() || m.getGroupId() != null ? Views.user(sc.getUser()) : null);
        });
        return l;
    }
}
