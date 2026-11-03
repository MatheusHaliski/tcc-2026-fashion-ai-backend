package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.moments.MomentViews;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeGroup;
import br.com.fashionai.domain.model.FlairChallengeSubmission;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.application.service.FlairChallengeService.Window;
import br.com.fashionai.application.service.FlairChallengeService.BuildRequest;
import br.com.fashionai.application.service.FlairChallengeService.Build;
import br.com.fashionai.application.service.FlairChallengeService.Line;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairChallengeService.OPEN;
import static br.com.fashionai.application.service.FlairChallengeService.UPCOMING;

/**
 * Conferir e entregar: entrega atômica (valida de novo, bloqueia as cartas, grava, lança os pontos pelo ledger
 * idempotente, registra no Momento e escreve capítulos do Atelier) e a conclusão do grupo.
 * Colaborador do {@link FlairChallengeService} (R82).
 */
final class FlairChallengeSubmissions {
    private final Guard guard;
    private final FlairChallengeRepository challenges;
    private final FlairChallengeGroupRepository groups;
    private final FlairChallengeSubmissionRepository submissions;
    private final FlairCardInstanceRepository cards;
    private final FaiPointsService points;
    private final UserAchievementRepository achievements;
    private final MomentService momentService;
    private final AtelierRewardSystem atelier;
    private final FlairChallengeWindows windows;
    private final FlairChallengeViews views;
    private final FlairChallengeBuilds builds;
    private final FlairChallengeClock clock;

    FlairChallengeSubmissions(Guard guard, FlairChallengeRepository challenges, FlairChallengeGroupRepository groups,
                              FlairChallengeSubmissionRepository submissions, FlairCardInstanceRepository cards, FaiPointsService points,
                              UserAchievementRepository achievements, MomentService momentService, AtelierRewardSystem atelier,
                              FlairChallengeWindows windows, FlairChallengeViews views, FlairChallengeBuilds builds,
                              FlairChallengeClock clock) {
        this.guard = guard;
        this.challenges = challenges;
        this.groups = groups;
        this.submissions = submissions;
        this.cards = cards;
        this.points = points;
        this.achievements = achievements;
        this.momentService = momentService;
        this.atelier = atelier;
        this.windows = windows;
        this.views = views;
        this.builds = builds;
        this.clock = clock;
    }

    Map<String, Object> check(CurrentUser user, String idOrSlug, BuildRequest req) {
        FlairChallenge c = windows.visible(user, idOrSlug);
        Build b = builds.build(user, c, req);
        int attempts = submissions.findByChallengeIdAndUserIdOrderByAttemptDesc(c.getId(), user.id()).size();
        Map<String, Object> out = builds.evaluationView(b);
        List<Line> lines = builds.pointsLines(b, attempts + 1);
        out.put("points", Map.of("lines", lines.stream().map(Line::toMap).toList(), "total", lines.stream().mapToInt(Line::points).sum()));
        out.put("attemptsLeft", Math.max(0, c.getRepeatLimit() - attempts));
        out.put("canSubmit", b.evaluation().ok() && OPEN.equals(b.window().status()) && attempts < c.getRepeatLimit());
        return out;
    }

    Map<String, Object> submit(CurrentUser user, String idOrSlug, BuildRequest req) {
        guard.requireCanCreate(user);
        FlairChallenge c = windows.visible(user, idOrSlug);
        Moment m = windows.momentOf(c);
        Window w = windows.window(c, m, clock.now());
        if (UPCOMING.equals(w.status())) {
            throw ApiException.conflict("DESAFIO_EM_BREVE", Msg.t("cbc.ainda_nao_abriu"));
        }
        if (!OPEN.equals(w.status())) {
            throw ApiException.conflict("DESAFIO_ENCERRADO", Msg.t("cbc.desafio_encerrado"));
        }
        List<FlairChallengeSubmission> prior = submissions.findByChallengeIdAndUserIdOrderByAttemptDesc(c.getId(), user.id());
        Set<UUID> playedElsewhere = cardsPlayedElsewhere(user.id(), c.getId());
        if (prior.size() >= c.getRepeatLimit()) {
            throw ApiException.conflict("LIMITE_DE_ENTREGAS", Msg.t("cbc.limite_de_entregas"));
        }
        Build b = builds.build(user, c, req);
        if (!b.evaluation().ok()) {
            throw new ApiException(409, "MONTAGEM_INCOMPLETA", Msg.t("cbc.montagem_incompleta"), Map.of("evaluation", builds.evaluationView(b)));
        }
        Instant now = clock.now();
        if (c.isLocksCards()) {
            for (FlairCardInstance card : b.placed().values()) {
                card.setState("LOCKED_CHALLENGE");
                card.setLockedChallengeId(c.getId());
                card.setLockedAt(now);
                card.setTradeable(false);
                cards.save(card);
            }
        }
        int attempt = prior.size() + 1;
        FlairChallengeSubmission s = new FlairChallengeSubmission();
        s.setChallengeId(c.getId());
        s.setUserId(user.id());
        s.setAttempt(attempt);
        s.setInterpretation(b.interpretation());
        s.setSintonia(b.evaluation().sintonia());
        s.setSintoniaMax(b.evaluation().sintoniaMax());
        s.setCardsJson(Json.write(builds.snapshot(b)));
        s.setStoryJson(Json.write(b.story()));
        submissions.save(s);

        List<Map<String, Object>> granted = new ArrayList<>();
        int total = 0;
        for (Line l : builds.pointsLines(b, attempt)) {
            FaiPointsService.Award a = points.award(user.id(), l.action(), "FLAIR_CHALLENGE", l.ref(), l.points());
            Map<String, Object> g = new LinkedHashMap<>(l.toMap());
            g.put("granted", a.granted());
            g.put("capReached", a.capReached());
            granted.add(g);
            total += a.granted() ? a.points() : 0;
        }
        Map<String, Object> group = null;
        if (c.getGroupCode() != null) {
            group = groupCompletion(user, c, granted);
            total += granted.stream().filter(g -> "FLAIR_CBC_GROUP".equals(g.get("action")) && Boolean.TRUE.equals(g.get("granted")))
                    .mapToInt(g -> (Integer) g.get("points")).sum();
        }
        if (m != null) {
            momentService.recordCardChallenge(m, user.id());
        }
        String challengeName = MomentViews.localized(c.getName(), c.getNamesJson());
        for (FlairCardInstance card : b.placed().values()) {
            if (playedElsewhere.contains(card.getId())) {
                atelier.grant(AtelierGrants.chapter(user.id(), c.getId(), challengeName, card.getId(), card.getName(), card.getOriginId()));
            }
        }
        s.setPoints(total);
        s.setBonusJson(Json.write(granted));
        submissions.save(s);

        Map<String, Object> out = builds.evaluationView(b);
        out.put("submission", views.submissionView(s, null, null, false));
        out.put("points", Map.of("lines", granted, "total", total));
        out.put("group", group);
        out.put("locked", c.isLocksCards());
        return out;
    }

    /** Grupo completo (todos os desafios entregues) → pontos do grupo e insígnia, 1× (ledger e conquistas idempotentes). */
    Map<String, Object> groupCompletion(CurrentUser user, FlairChallenge c, List<Map<String, Object>> granted) {
        FlairChallengeGroup g = groups.findByCode(c.getGroupCode()).orElse(null);
        if (g == null) {
            return null;
        }
        List<FlairChallenge> members = challenges.findByGroupCode(g.getCode()).stream().filter(x -> x.getStatus() != FlairChallengeStatus.DRAFT).toList();
        Set<UUID> done = new HashSet<>(views.mineBy(user, members).keySet());
        done.add(c.getId());
        boolean complete = !members.isEmpty() && members.stream().allMatch(x -> done.contains(x.getId()));
        if (complete) {
            if (g.getPoints() > 0) {
                FaiPointsService.Award a = points.award(user.id(), "FLAIR_CBC_GROUP", "FLAIR_CHALLENGE_GROUP", "group:" + g.getCode(), g.getPoints());
                Map<String, Object> line = new LinkedHashMap<>(new Line("FLAIR_CBC_GROUP", g.getPoints(), "group:" + g.getCode(), "group").toMap());
                line.put("granted", a.granted());
                line.put("capReached", a.capReached());
                granted.add(line);
            }
            atelier.grant(AtelierGrants.groupCompleted(user.id(), g.getCode(), MomentViews.localized(g.getName(), g.getNamesJson())));
            if (g.getBadgeCode() != null && !achievements.existsByUserIdAndAchievementCode(user.id(), g.getBadgeCode())) {
                UserAchievement ach = new UserAchievement();
                ach.setUserId(user.id());
                ach.setAchievementCode(g.getBadgeCode());
                ach.setSecret(false);
                ach.setGrantedAt(clock.now());
                achievements.save(ach);
            }
        }
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("code", g.getCode());
        v.put("name", MomentViews.localized(g.getName(), g.getNamesJson()));
        v.put("done", (int) members.stream().filter(x -> done.contains(x.getId())).count());
        v.put("total", members.size());
        v.put("completed", complete);
        v.put("badgeCode", g.getBadgeCode());
        return v;
    }

    /** Cartas que a pessoa já entregou em OUTROS desafios: reutilizá-las aqui escreve um capítulo na Memória da peça (Atelier). */
    Set<UUID> cardsPlayedElsewhere(UUID userId, UUID challengeId) {
        Set<UUID> out = new HashSet<>();
        for (FlairChallengeSubmission prev : submissions.findByUserIdAndChallengeIdNot(userId, challengeId)) {
            for (Map<String, Object> card : Json.list(prev.getCardsJson())) {
                try {
                    out.add(UUID.fromString(String.valueOf(card.get("cardId"))));
                } catch (IllegalArgumentException ignored) {
                    // entrega antiga sem cardId válido: não conta como reutilização
                }
            }
        }
        return out;
    }
}
