package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
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

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.moments.MomentRules.outcome;
import static br.com.fashionai.application.moments.MomentRules.strings;

/**
 * Base dos colaboradores do MomentService: dependências (lidas do {@link MomentContext}), relógio e as regras de
 * acesso compartilhadas (quem pode ver, escopo, Hype v2, configurações, competitividade e a view da participação).
 */
abstract class MomentSupport {
    static final List<MomentStatus> LIVE = List.of(MomentStatus.SCHEDULED, MomentStatus.ACTIVE);
    static final List<MomentStatus> VISIBLE = List.of(MomentStatus.SCHEDULED, MomentStatus.ACTIVE, MomentStatus.ENDED);
    static final List<MomentParticipationStatus> ENGAGED = List.of(MomentParticipationStatus.JOINED, MomentParticipationStatus.SUBMITTED, MomentParticipationStatus.COMPLETED);

    final MomentContext ctx;
    final MomentRepository moments;
    final MomentChallengeRepository challenges;
    final MomentParticipationRepository participations;
    final MomentSubmissionRepository submissions;
    final MomentVoteRepository votes;
    final SchemeRepository schemes;
    final SchemeItemRepository schemeItems;
    final WardrobeItemRepository pieces;
    final UserRepository users;
    final FlairTeamRepository teams;
    final FlairTeamMemberRepository members;
    final UserAchievementRepository achievements;
    final PieceUsageDiaryEntryRepository diary;
    final FaiPointsService points;
    final NotificationService notifications;
    final Guard guard;
    /** HypeScore v2 (hype_scores): fonte única do Hype; peças e looks não guardam mais cópia desnormalizada. */
    final HypeQueryService hypeQuery;

    MomentSupport(MomentContext ctx) {
        this.ctx = ctx;
        this.moments = ctx.moments;
        this.challenges = ctx.challenges;
        this.participations = ctx.participations;
        this.submissions = ctx.submissions;
        this.votes = ctx.votes;
        this.schemes = ctx.schemes;
        this.schemeItems = ctx.schemeItems;
        this.pieces = ctx.pieces;
        this.users = ctx.users;
        this.teams = ctx.teams;
        this.members = ctx.members;
        this.achievements = ctx.achievements;
        this.diary = ctx.diary;
        this.points = ctx.points;
        this.notifications = ctx.notifications;
        this.guard = ctx.guard;
        this.hypeQuery = ctx.hypeQuery;
    }

    /**
     * HypeScore v2 atual de várias entidades (ids sem cálculo ficam fora do mapa: "sem base", nunca 0). Para quem não é o
     * dono, só o Hype público elegível: o Hype pessoal (item privado, perfil só para seguidores…) fica com o dono.
     */
    Map<UUID, Double> hypeScores(HypeEntityType type, Collection<UUID> ids, UUID viewerId) {
        if (hypeQuery == null || ids == null || ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Double> out = new HashMap<>();
        hypeQuery.currentOf(type, ids).forEach((id, c) -> {
            boolean owner = viewerId != null && viewerId.equals(c.getOwnerId());
            if (c.getScore() != null && (owner || c.isPublicEligible())) {
                out.put(id, c.getScore().doubleValue());
            }
        });
        return out;
    }

    Double hypeScore(HypeEntityType type, UUID id, UUID viewerId) {
        return id == null ? null : hypeScores(type, List.of(id), viewerId).get(id);
    }

    Instant now() {
        return Instant.now(ctx.clock);
    }

    /** Quem pode ver: PUBLIC = todos; GROUP/INVITE_ONLY/FRIENDS/PRIVATE = criador, membros do grupo e administração. */
    boolean canSee(CurrentUser viewer, Moment m) {
        if (m.getStatus() == MomentStatus.DRAFT || m.getStatus() == MomentStatus.CANCELLED) {
            return viewer != null && (viewer.admin() || viewer.id().equals(m.getCreatedByUserId()));
        }
        if (m.getVisibility().discoverable()) {
            return true;
        }
        if (viewer == null) {
            return false;
        }
        if (viewer.admin() || viewer.id().equals(m.getCreatedByUserId())) {
            return true;
        }
        return m.getGroupId() != null && isMember(viewer.id(), m.getGroupId());
    }

    boolean isMember(UUID userId, UUID teamId) {
        return members.findByUserId(userId).map(x -> x.getTeam().getId().equals(teamId)).orElse(false);
    }

    /** País da pessoa (users.country) para o calendário contextual; nulo = desconhecido (mostra tudo, marcado como regional). */
    String countryOf(CurrentUser viewer) {
        return viewer == null ? null : users.findById(viewer.id()).map(User::getCountry).filter(c -> c != null && !c.isBlank()).orElse(null);
    }

    boolean inScope(Moment m, String country) {
        if (m.getScope() != MomentScope.COUNTRY && m.getScope() != MomentScope.REGION) {
            return true;
        }
        return country == null || m.getCountry() == null || m.getCountry().equalsIgnoreCase(country);
    }

    /** Momentos "vivos" que a pessoa pode ver (públicos no escopo dela + os do grupo dela). */
    List<Moment> visibleLive(CurrentUser viewer, String country) {
        return moments.findByStatusIn(LIVE).stream().filter(m -> canSee(viewer, m)).filter(m -> inScope(m, country))
                .sorted(Comparator.comparing(Moment::getStartAt)).toList();
    }

    Moment find(String idOrSlug) {
        Optional<Moment> m;
        try {
            m = moments.findById(UUID.fromString(idOrSlug));
        } catch (IllegalArgumentException e) {
            m = moments.findBySlug(idOrSlug.toLowerCase(Locale.ROOT));
        }
        return m.orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
    }

    Moment visible(CurrentUser viewer, String idOrSlug) {
        Moment m = find(idOrSlug);
        if (!canSee(viewer, m)) {
            throw guard.deny(viewer, "moment:" + m.getSlug(), Msg.t("guard.este_conteudo_nao_esta_visivel"));
        }
        return m;
    }

    Map<String, Object> settings(Moment m) {
        Map<String, Object> s = new LinkedHashMap<>(Json.map(m.getSettingsJson()));
        s.putIfAbsent("looksPerUser", 0);
        s.putIfAbsent("allowRemix", true);
        s.putIfAbsent("allowVoting", !m.getNature().sensitive());
        s.putIfAbsent("allowComments", true);
        s.putIfAbsent("allowAi", true);
        s.putIfAbsent("allowExternalPieces", true);
        s.putIfAbsent("anonymousVoting", true);
        s.putIfAbsent("prizes", List.of());
        return s;
    }

    boolean competitive(Moment m) {
        if (m.getNature().sensitive()) {
            return false;
        }
        if (m.getFlairMode() != null) {
            return m.getFlairMode().competitive();
        }
        return Boolean.TRUE.equals(settings(m).get("allowVoting"));
    }

    boolean isFlair(Moment m) {
        return m.getType() == MomentType.FLAIR_EVENT || m.getType() == MomentType.PRIVATE_GROUP || m.getGroupId() != null;
    }

    MomentMatch.Context contextOf(Moment m, MomentChallenge chosen) {
        List<String> styles = new ArrayList<>(Json.csv(m.getStyleTags()));
        List<String> colors = new ArrayList<>(Json.csv(m.getColorTags()));
        List<String> occasions = new ArrayList<>(Json.csv(m.getOccasionTags()));
        if (chosen != null) {
            styles.addAll(Json.csv(chosen.getStyleTags()));
            colors.addAll(Json.csv(chosen.getColorTags()));
            occasions.addAll(Json.csv(chosen.getOccasionTags()));
        }
        List<String> items = new ArrayList<>(Json.strings(m.getRequiredItemsJson()));
        items.addAll(Json.strings(m.getSuggestedItemsJson()));
        List<MomentMatch.Interpretation> interps = new ArrayList<>();
        for (Map<String, Object> i : Json.list(m.getInterpretationsJson())) {
            interps.add(MomentMatch.interpretation(String.valueOf(i.get("key")), strings(i.get("styleTags")), strings(i.get("colorTags"))));
        }
        return MomentMatch.context(styles, colors, occasions, items, interps);
    }

    Map<String, Object> participationView(MomentParticipation p) {
        if (p == null) {
            return null;
        }
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("status", p.getStatus().name());
        v.put("approach", p.getApproach() == null ? null : p.getApproach().name());
        v.put("wardrobeOnly", p.isWardrobeOnly());
        v.put("remind", p.isRemind());
        v.put("preparedSchemeId", p.getPreparedSchemeId());
        v.put("joinedAt", p.getJoinedAt() == null ? null : p.getJoinedAt().toString());
        v.put("pointsEarned", p.getPointsEarned());
        v.put("bestMatch", p.getBestMatch());
        v.put("ranking", p.getRanking());
        v.put("percentile", p.getPercentile());
        v.put("badgeCode", p.getBadgeCode());
        v.put("publicOnProfile", p.isPublicOnProfile());
        v.put("outcome", outcome(p));
        return v;
    }
}
