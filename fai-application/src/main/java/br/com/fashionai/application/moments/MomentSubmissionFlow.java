package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentService.SubmitRequest;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.NotificationType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.moments.MomentRules.explain;
import static br.com.fashionai.application.moments.MomentRules.rounded;

/** Envio de look (§58): pré-visualização e envio com pontos idempotentes, conclusão e badge. */
final class MomentSubmissionFlow extends MomentSupport {
    MomentSubmissionFlow(MomentContext ctx) {
        super(ctx);
    }

    /** Pré-visualização (§58): MomentMatch + FAI Points previstos, sem gravar nada. */
    Map<String, Object> preview(CurrentUser user, String idOrSlug, SubmitRequest req) {
        Moment m = visible(user, idOrSlug);
        Scheme s = ownedScheme(user, req.schemeId());
        MomentEvaluator.Evaluation ev = new MomentEvaluator(ctx).evaluate(m, user.id(), s, req.challengeId(), req.interpretation(), false);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("match", ev.match() == null ? null : ev.match().toMap());
        out.put("scores", ev.scores());
        out.put("points", ev.lines().stream().map(MomentPointsPolicy.Line::toMap).toList());
        out.put("pointsTotal", MomentPointsPolicy.total(ev.lines()));
        out.put("wardrobeOnly", ev.facts().wardrobeOnly());
        out.put("rediscovered", ev.facts().rediscoveredPieces());
        out.put("newStyles", ev.facts().newStyles());
        out.put("explanation", explain(ev.match()));
        out.put("alreadySubmitted", submissions.findByMomentIdAndSchemeId(m.getId(), s.getId()).isPresent());
        return out;
    }

    /** ENVIAR LOOK: grava o envio, paga os pontos (idempotentes), conclui a participação e concede a badge. */
    Map<String, Object> submit(CurrentUser user, String idOrSlug, SubmitRequest req) {
        guard.requireCanCreate(user);
        Instant now = now();
        Moment m = visible(user, idOrSlug);
        if (MomentTime.effective(m, now) != MomentStatus.ACTIVE) {
            throw ApiException.conflict("MOMENTO_FORA_DO_PERIODO", Msg.t("moment.envios_so_durante_o_periodo"));
        }
        Scheme s = ownedScheme(user, req.schemeId());
        if (submissions.findByMomentIdAndSchemeId(m.getId(), s.getId()).isPresent()) {
            throw ApiException.conflict("LOOK_JA_ENVIADO", Msg.t("moment.este_look_ja_participa"));
        }
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElse(null);
        if (p == null || p.getJoinedAt() == null || p.getStatus() == MomentParticipationStatus.LEFT) {
            new MomentParticipationFlow(ctx).join(user, idOrSlug, null);
            p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseThrow();
        }
        int limit = ((Number) settings(m).getOrDefault("looksPerUser", 0)).intValue();
        List<MomentSubmission> mine = submissions.findByMomentIdAndUserIdAndWithdrawnFalse(m.getId(), user.id());
        if (limit > 0 && mine.size() >= limit) {
            throw ApiException.conflict("LIMITE_DE_LOOKS", Msg.t("moment.limite_de_looks_neste_momento", limit));
        }
        MomentEvaluator.Evaluation ev = new MomentEvaluator(ctx).evaluate(m, user.id(), s, req.challengeId(), req.interpretation(), true);
        MomentSubmission sub = new MomentSubmission();
        sub.setMomentId(m.getId());
        sub.setParticipationId(p.getId());
        sub.setUserId(user.id());
        sub.setSchemeId(s.getId());
        sub.setChallengeId(req.challengeId());
        sub.setMatchScore(ev.match() == null ? null : ev.match().score());
        sub.setMatchJson(ev.match() == null ? null : Json.write(ev.match().toMap()));
        sub.setWardrobeOnly(ev.facts().wardrobeOnly());
        sub.setRediscoveredJson(Json.write(ev.facts().rediscoveredPieces()));
        sub.setHypeAtSubmission(rounded(hypeScore(HypeEntityType.SCHEME, s.getId(), user.id())));
        sub.setSubmittedAt(now);
        // pontos: cada linha paga 1× pelo ledger (idempotência por usuário:ação:referência)
        int earned = 0;
        List<Map<String, Object>> paid = new ArrayList<>();
        for (MomentPointsPolicy.Line line : ev.lines()) {
            FaiPointsService.Award a = points.award(user.id(), line.actionCode(), "MOMENT", line.refId(), line.points());
            if (a.granted()) {
                earned += a.points();
                paid.add(line.toMap());
            }
        }
        if (isFlair(m) && m.isPointsEnabled()) {
            FaiPointsService.Award a = points.award(user.id(), "MOMENT_FLAIR", "MOMENT", m.getId().toString(), null);
            if (a.granted()) {
                earned += a.points();
                paid.add(Map.of("action", "MOMENT_FLAIR", "points", a.points(), "ref", m.getId().toString(), "label", "flair"));
            }
        }
        sub.setPointsJson(Json.write(paid));
        sub.setPointsEarned(earned);
        submissions.save(sub);
        p.setPointsEarned(p.getPointsEarned() + earned);
        p.setSubmittedAt(p.getSubmittedAt() == null ? now : p.getSubmittedAt());
        if (ev.match() != null && (p.getBestMatch() == null || ev.match().score() > p.getBestMatch())) {
            p.setBestMatch(ev.match().score());
        }
        boolean related = ev.match() == null ? contextOf(m, null).empty() : ev.match().score() >= MomentPointsPolicy.RELATED_THRESHOLD;
        boolean completedNow = false;
        if (related && p.getStatus() != MomentParticipationStatus.COMPLETED) {
            p.setStatus(MomentParticipationStatus.COMPLETED);
            p.setCompletedAt(now);
            completedNow = true;
        } else if (p.getStatus() == MomentParticipationStatus.JOINED) {
            p.setStatus(MomentParticipationStatus.SUBMITTED);
        }
        int completionPoints = 0;
        if (completedNow) {
            if (m.isPointsEnabled() && !m.getNature().sensitive()) {
                FaiPointsService.Award a = points.award(user.id(), "MOMENT_COMPLETED", "MOMENT", m.getId().toString(), null);
                if (a.granted()) {
                    completionPoints = a.points();
                    p.setPointsEarned(p.getPointsEarned() + completionPoints);
                }
            }
            if (m.getBadgeCode() != null && !m.getBadgeCode().isBlank()) {
                grantBadge(user.id(), m.getBadgeCode());
                p.setBadgeCode(m.getBadgeCode());
            }
            notifications.notify(user.id(), null, NotificationType.MOMENT_COMPLETED, "MOMENT", m.getId(),
                    Msg.k("moment.notif.concluido_titulo", MomentViews.localized(m.getName(), m.getNamesJson())),
                    Msg.k("moment.notif.concluido_corpo", earned + completionPoints),
                    Map.of("href", "/moments/" + m.getSlug(), "points", earned + completionPoints, "badge", p.getBadgeCode() == null ? "" : p.getBadgeCode()));
        }
        participations.save(p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("submission", new MomentCommunity(ctx).submissionView(sub, user, Map.of(), false));
        out.put("me", participationView(p));
        out.put("match", ev.match() == null ? null : ev.match().toMap());
        out.put("scores", ev.scores());
        out.put("points", paid);
        out.put("pointsTotal", earned + completionPoints);
        out.put("completed", completedNow);
        out.put("badge", completedNow ? p.getBadgeCode() : null);
        out.put("explanation", explain(ev.match()));
        out.put("message", completedNow ? Msg.t("moment.momento_concluido_pts", earned + completionPoints) : Msg.t("moment.look_enviado"));
        return out;
    }

    void grantBadge(UUID userId, String code) {
        if (achievements.existsByUserIdAndAchievementCode(userId, code)) {
            return;
        }
        UserAchievement a = new UserAchievement();
        a.setUserId(userId);
        a.setAchievementCode(code);
        a.setSecret(false);
        a.setGrantedAt(now());
        achievements.save(a);
    }

    Scheme ownedScheme(CurrentUser user, UUID schemeId) {
        if (schemeId == null) {
            throw ApiException.badRequest("LOOK_OBRIGATORIO", Msg.t("moment.escolha_um_look"));
        }
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound(Msg.t("moment.look")));
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + s.getId());
        return s;
    }
}
