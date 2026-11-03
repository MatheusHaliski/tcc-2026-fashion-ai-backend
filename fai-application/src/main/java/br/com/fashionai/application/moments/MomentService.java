package br.com.fashionai.application.moments;

import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.MomentChallengeRepository;
import br.com.fashionai.domain.repository.MomentParticipationRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.MomentSubmissionRepository;
import br.com.fashionai.domain.repository.MomentVoteRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FashionAI MOMENTOS — o tempo da moda dentro do FashionAI (docs/momentos/MOMENTOS.md; visão e regras gerais em
 * {@code package-info.java}). Facade (R81): este bean é dono das transações, do job agendado e dos contratos públicos;
 * cada caso de uso mora num colaborador do pacote (consultas, participação, envio, comunidade, ranking, FLAIR, job e
 * administração), delegados nesta ordem.
 */
@Service
public class MomentService {
    public static final int UPCOMING_DAYS = 60;
    public static final int LEADERBOARD_MAX = 50;
    public static final int FEED_MAX = 60;
    public static final int MAX_PRIZE = 150;
    public static final int DEFAULT_COOP_POINTS = 30;

    final MomentContext ctx;

    public MomentService(MomentRepository moments, MomentChallengeRepository challenges, MomentParticipationRepository participations,
                         MomentSubmissionRepository submissions, MomentVoteRepository votes, SchemeRepository schemes, SchemeItemRepository schemeItems,
                         WardrobeItemRepository pieces, UserRepository users, FlairTeamRepository teams, FlairTeamMemberRepository members,
                         UserAchievementRepository achievements, PieceUsageDiaryEntryRepository diary, FaiPointsService points,
                         NotificationService notifications, Guard guard, HypeQueryService hypeQuery) {
        this.ctx = new MomentContext(moments, challenges, participations, submissions, votes, schemes, schemeItems, pieces, users, teams,
                members, achievements, diary, points, notifications, guard, hypeQuery);
    }

    /** Testes: relógio fixo. */
    public void useClock(Clock clock) {
        ctx.clock = clock;
    }

    public boolean canSee(CurrentUser viewer, Moment m) {
        return new MomentQueries(ctx).canSee(viewer, m);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> home(CurrentUser viewer) {
        return new MomentQueries(ctx).home(viewer);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> nowBanner(CurrentUser viewer) {
        return new MomentQueries(ctx).nowBanner(viewer);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> calendar(CurrentUser viewer, int year, Integer month, String tz) {
        return new MomentQueries(ctx).calendar(viewer, year, month, tz);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser viewer, String status, Integer year) {
        return new MomentQueries(ctx).list(viewer, status, year);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(CurrentUser viewer, String idOrSlug) {
        return new MomentDetail(ctx).detail(viewer, idOrSlug);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> candidateLooks(CurrentUser user, String idOrSlug) {
        return new MomentDetail(ctx).candidateLooks(user, idOrSlug);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user) {
        return new MomentHistory(ctx).mine(user);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> timeline(CurrentUser viewer, UUID userId) {
        return new MomentHistory(ctx).timeline(viewer, userId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> replay(CurrentUser user, int year) {
        return new MomentHistory(ctx).replay(user, year);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> contextFor(CurrentUser viewer, HypeEntityType type, UUID id) {
        return new MomentContextual(ctx).contextFor(viewer, type, id);
    }

    public static Integer contextualHype(Double hype, Integer match) {
        return MomentRules.contextualHype(hype, match);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> activeSummary(UUID userId) {
        return new MomentContextual(ctx).activeSummary(userId);
    }

    public record JoinRequest(String approach, Boolean wardrobeOnly) {
    }

    public record SubmitRequest(UUID schemeId, UUID challengeId, String interpretation) {
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, String idOrSlug, Boolean remind, UUID preparedSchemeId) {
        return new MomentParticipationFlow(ctx).save(user, idOrSlug, remind, preparedSchemeId);
    }

    @Transactional
    public Map<String, Object> unsave(CurrentUser user, String idOrSlug) {
        return new MomentParticipationFlow(ctx).unsave(user, idOrSlug);
    }

    @Transactional
    public Map<String, Object> join(CurrentUser user, String idOrSlug, JoinRequest req) {
        return new MomentParticipationFlow(ctx).join(user, idOrSlug, req);
    }

    @Transactional
    public void recordCardChallenge(Moment m, UUID userId) {
        new MomentParticipationFlow(ctx).recordCardChallenge(m, userId);
    }

    @Transactional
    public Map<String, Object> leave(CurrentUser user, String idOrSlug) {
        return new MomentParticipationFlow(ctx).leave(user, idOrSlug);
    }

    @Transactional
    public Map<String, Object> setProfileVisibility(CurrentUser user, String idOrSlug, boolean publicOnProfile) {
        return new MomentParticipationFlow(ctx).setProfileVisibility(user, idOrSlug, publicOnProfile);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> preview(CurrentUser user, String idOrSlug, SubmitRequest req) {
        return new MomentSubmissionFlow(ctx).preview(user, idOrSlug, req);
    }

    @Transactional
    public Map<String, Object> submit(CurrentUser user, String idOrSlug, SubmitRequest req) {
        return new MomentSubmissionFlow(ctx).submit(user, idOrSlug, req);
    }

    public record VoteRequest(UUID submissionId, String dimension) {
    }

    @Transactional(readOnly = true)
    public Map<String, Object> feed(CurrentUser viewer, String idOrSlug) {
        return new MomentCommunity(ctx).feed(viewer, idOrSlug);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> trending(CurrentUser viewer, String idOrSlug, int limit) {
        return new MomentCommunity(ctx).trending(viewer, idOrSlug, limit);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> leaderboard(CurrentUser viewer, String idOrSlug) {
        return new MomentRanking(ctx).leaderboard(viewer, idOrSlug);
    }

    @Transactional
    public Map<String, Object> vote(CurrentUser user, String idOrSlug, VoteRequest req) {
        return new MomentRanking(ctx).vote(user, idOrSlug, req);
    }

    public record GroupMomentRequest(String name, String description, String theme, String startAt, String endAt, String timezone,
                                     String visibility, String flairMode, Integer looksPerUser, Boolean allowRemix, Boolean allowVoting,
                                     Boolean allowComments, Boolean allowAi, Boolean allowExternalPieces, Boolean anonymousVoting,
                                     List<Integer> prizes, Integer cooperativeGoal, List<String> styleTags, List<String> colorTags,
                                     List<String> occasionTags, String rules, UUID basedOnMomentId) {
    }

    @Transactional(readOnly = true)
    public Map<String, Object> groupMoments(CurrentUser user, UUID teamId) {
        return new MomentGroups(ctx).groupMoments(user, teamId);
    }

    @Transactional
    public Map<String, Object> createGroupMoment(CurrentUser user, UUID teamId, GroupMomentRequest req) {
        return new MomentGroups(ctx).createGroupMoment(user, teamId, req);
    }

    @org.springframework.scheduling.annotation.Scheduled(cron = "0 */5 * * * *", zone = "UTC")
    @Transactional
    public Map<String, Integer> tick() {
        return new MomentLifecycle(ctx).tick();
    }

    public record AdminMomentRequest(String slug, String name, Map<String, String> names, String description, Map<String, String> descriptions,
                                     String type, String nature, String status, String startAt, String endAt, String timezone, String scope, String visibility,
                                     String country, String region, String locale, String season, Map<String, Object> theme, String coverUrl, String bannerUrl,
                                     Boolean featured, Boolean sponsored, String sponsorName, String sourceUrl, String sourceNote, Boolean pointsEnabled,
                                     Integer basePoints, Double pointsMultiplier, Map<String, Object> bonusRules, List<String> styleTags, List<String> occasionTags,
                                     List<String> colorTags, List<Map<String, Object>> interpretations, List<String> requiredItems, List<String> suggestedItems,
                                     Map<String, Object> rules, Map<String, Object> settings, String badgeCode, List<AdminChallengeRequest> challenges) {
    }

    public record AdminChallengeRequest(String code, String name, Map<String, String> names, String description, String kind, Integer points,
                                        List<String> styleTags, List<String> colorTags, List<String> occasionTags, Map<String, Object> params, Boolean active) {
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminList(CurrentUser admin) {
        return new MomentAdmin(ctx).adminList(admin);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> adminDetail(CurrentUser admin, UUID id) {
        return new MomentAdmin(ctx).adminDetail(admin, id);
    }

    @Transactional
    public Map<String, Object> adminSave(CurrentUser admin, UUID id, AdminMomentRequest r) {
        return new MomentAdminWriter(ctx).adminSave(admin, id, r);
    }

    @Transactional
    public Map<String, Object> adminTransition(CurrentUser admin, UUID id, String action) {
        return new MomentAdmin(ctx).adminTransition(admin, id, action);
    }
}
