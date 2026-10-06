package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.FlairTeamMember;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.MomentVote;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FlairMomentMode;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.MomentApproach;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
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

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * FashionAI MOMENTOS — o tempo da moda dentro do FashionAI (docs/momentos/MOMENTOS.md).
 *
 * <p>GUARDA-ROUPA = o que eu tenho · DNA = quem eu sou · HYPE = o que está acontecendo · MOMENTOS = quando e em qual
 * contexto · COPILOT = o que posso fazer · LOOKBOOK = como me expresso · FLAIR = como participo · HISTÓRICO = como mudei.
 * Este serviço cuida só da dimensão temporal e conversa com as outras sem misturá-las numa métrica única: o
 * MomentMatch é separado do Hype e da compatibilidade pessoal; o Hype contextual deriva do global sem sobrescrevê-lo.</p>
 *
 * <p>Regras que valem para tudo aqui: tempo pelo relógio do servidor (MomentTime); FAI Points pelo ledger idempotente
 * (MomentPointsPolicy → FaiPointsService.award); Momentos privados nunca entram em descoberta, ranking global ou perfil
 * público; Momentos terminados nunca somem (viram Memória); notificações informativas, no máximo uma por motivo.</p>
 */
@Service
public class MomentService {
    public static final int UPCOMING_DAYS = 60;
    public static final int LEADERBOARD_MAX = 50;
    public static final int FEED_MAX = 60;
    public static final int MAX_PRIZE = 150;
    public static final int DEFAULT_COOP_POINTS = 30;
    static final List<MomentStatus> LIVE = List.of(MomentStatus.SCHEDULED, MomentStatus.ACTIVE);
    static final List<MomentStatus> VISIBLE = List.of(MomentStatus.SCHEDULED, MomentStatus.ACTIVE, MomentStatus.ENDED);
    static final List<MomentParticipationStatus> ENGAGED = List.of(MomentParticipationStatus.JOINED, MomentParticipationStatus.SUBMITTED, MomentParticipationStatus.COMPLETED);

    private final MomentRepository moments;
    private final MomentChallengeRepository challenges;
    private final MomentParticipationRepository participations;
    private final MomentSubmissionRepository submissions;
    private final MomentVoteRepository votes;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final FlairTeamRepository teams;
    private final FlairTeamMemberRepository members;
    private final UserAchievementRepository achievements;
    private final PieceUsageDiaryEntryRepository diary;
    private final FaiPointsService points;
    private final NotificationService notifications;
    private final Guard guard;
    /** HypeScore v2: estado atual gravado pelo job de snapshots (as entidades não guardam mais o score). */
    private final HypeScoreCurrentRepository hype;
    private final HypeScoreConfig hypeConfig;
    private Clock clock = Clock.systemUTC();

    public MomentService(MomentRepository moments, MomentChallengeRepository challenges, MomentParticipationRepository participations,
                         MomentSubmissionRepository submissions, MomentVoteRepository votes, SchemeRepository schemes, SchemeItemRepository schemeItems,
                         WardrobeItemRepository pieces, UserRepository users, FlairTeamRepository teams, FlairTeamMemberRepository members,
                         UserAchievementRepository achievements, PieceUsageDiaryEntryRepository diary, FaiPointsService points,
                         NotificationService notifications, Guard guard, HypeScoreCurrentRepository hype, HypeScoreConfig hypeConfig) {
        this.moments = moments;
        this.challenges = challenges;
        this.participations = participations;
        this.submissions = submissions;
        this.votes = votes;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.teams = teams;
        this.members = members;
        this.achievements = achievements;
        this.diary = diary;
        this.points = points;
        this.notifications = notifications;
        this.guard = guard;
        this.hype = hype;
        this.hypeConfig = hypeConfig;
    }

    /** Testes: relógio fixo. */
    public void useClock(Clock clock) {
        this.clock = clock;
    }

    Instant now() {
        return Instant.now(clock);
    }

    // ================================================================== visibilidade e contexto
    /** Quem pode ver: PUBLIC = todos; GROUP/INVITE_ONLY/FRIENDS/PRIVATE = criador, membros do grupo e administração. */
    public boolean canSee(CurrentUser viewer, Moment m) {
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

    // ================================================================== consultas (§7–§9, §19)
    /** Home da aba Momentos: AGORA, PRÓXIMOS, destaque, resumo pessoal e os Momentos dos grupos FLAIR. */
    @Transactional(readOnly = true)
    public Map<String, Object> home(CurrentUser viewer) {
        Instant now = now();
        String country = countryOf(viewer);
        List<Moment> live = visibleLive(viewer, country);
        List<Map<String, Object>> active = new ArrayList<>();
        List<Map<String, Object>> upcoming = new ArrayList<>();
        Map<UUID, MomentParticipation> mine = viewer == null ? Map.of() : participations.findByMomentIdInAndUserId(live.stream().map(Moment::getId).toList(), viewer.id())
                .stream().collect(Collectors.toMap(MomentParticipation::getMomentId, p -> p, (a, b) -> a));
        for (Moment m : live) {
            MomentStatus eff = MomentTime.effective(m, now);
            Map<String, Object> card = MomentViews.card(m, now);
            card.put("regional", m.getScope() == MomentScope.COUNTRY && country == null);
            card.put("me", participationView(mine.get(m.getId())));
            if (eff == MomentStatus.ACTIVE) {
                active.add(card);
            } else if (eff == MomentStatus.SCHEDULED && MomentTime.startsInSeconds(m, now) <= UPCOMING_DAYS * 86400L) {
                upcoming.add(card);
            }
        }
        active.sort(Comparator.comparing((Map<String, Object> c) -> !Boolean.TRUE.equals(c.get("featured"))).thenComparing(c -> (Long) ((Map<?, ?>) c.get("time")).get("endsInSeconds")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("now", now.toString());
        out.put("country", country);
        out.put("active", active);
        out.put("upcoming", upcoming);
        out.put("featured", active.stream().filter(c -> Boolean.TRUE.equals(c.get("featured"))).findFirst().orElse(active.isEmpty() ? null : active.get(0)));
        if (viewer != null) {
            out.put("mine", mineSummary(viewer.id()));
            out.put("group", members.findByUserId(viewer.id()).map(mm -> groupSummary(mm.getTeam(), now)).orElse(null));
        }
        out.put("principle", Msg.t("moment.principio"));
        return out;
    }

    /** "Agora no FashionAI" (§43): só quando há Momento relevante; nunca um banner permanente. */
    @Transactional(readOnly = true)
    public Map<String, Object> nowBanner(CurrentUser viewer) {
        Instant now = now();
        String country = countryOf(viewer);
        Optional<Moment> pick = visibleLive(viewer, country).stream().filter(m -> MomentTime.active(m, now))
                .filter(m -> m.getVisibility().discoverable())
                .sorted(Comparator.comparing((Moment m) -> !m.isFeatured()).thenComparing(Moment::getEndAt)).findFirst();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("now", now.toString());
        out.put("moment", pick.map(m -> {
            Map<String, Object> c = MomentViews.card(m, now);
            if (viewer != null) {
                c.put("me", participationView(participations.findByMomentIdAndUserId(m.getId(), viewer.id()).orElse(null)));
            }
            return c;
        }).orElse(null));
        return out;
    }

    /** Calendário anual/mensal (§3, §19): cada Momento visível que toca o mês, com dias locais no fuso do Momento. */
    @Transactional(readOnly = true)
    public Map<String, Object> calendar(CurrentUser viewer, int year, Integer month, String tz) {
        Instant now = now();
        ZoneId zone = MomentTime.zone(tz);
        String country = countryOf(viewer);
        Instant from = MomentTime.yearStart(year, zone).minus(31, ChronoUnit.DAYS);
        Instant to = MomentTime.yearEnd(year, zone).plus(31, ChronoUnit.DAYS);
        List<Moment> all = moments.findByStatusInAndStartAtLessThanAndEndAtGreaterThan(VISIBLE, to, from).stream()
                .filter(m -> canSee(viewer, m)).filter(m -> inScope(m, country)).sorted(Comparator.comparing(Moment::getStartAt)).toList();
        List<Map<String, Object>> monthsOut = new ArrayList<>();
        int first = month == null ? 1 : month, last = month == null ? 12 : month;
        for (int mo = first; mo <= last; mo++) {
            YearMonth ym = YearMonth.of(year, mo);
            List<Map<String, Object>> items = new ArrayList<>();
            for (Moment m : all) {
                if (MomentTime.touches(m, ym)) {
                    Map<String, Object> c = MomentViews.card(m, now);
                    c.put("regional", m.getScope() == MomentScope.COUNTRY && country == null);
                    items.add(c);
                }
            }
            Map<String, Object> mv = new LinkedHashMap<>();
            mv.put("year", year);
            mv.put("month", mo);
            mv.put("days", ym.lengthOfMonth());
            mv.put("items", items);
            monthsOut.add(mv);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("now", now.toString());
        out.put("timezone", zone.getId());
        out.put("year", year);
        out.put("months", monthsOut);
        return out;
    }

    /** Detalhe (MomentPage genérica, §52): dados + desafios + minha participação + estatísticas + ranking/feed resumidos. */
    @Transactional(readOnly = true)
    public Map<String, Object> detail(CurrentUser viewer, String idOrSlug) {
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
            out.put("mySubmissions", submissions.findByMomentIdAndUserIdAndWithdrawnFalse(m.getId(), viewer.id()).stream().map(s -> submissionView(s, viewer, Map.of(), false)).toList());
        }
        if (m.getGroupId() != null && member) {
            teams.findById(m.getGroupId()).ifPresent(t -> out.put("group", Map.of("id", t.getId(), "name", t.getName(), "color", t.getColor())));
            out.put("participants", participants(m));
        }
        out.put("trending", trending(viewer, m, 6));
        if (MomentTime.effective(m, now) == MomentStatus.ENDED) {
            out.put("memory", Json.map(m.getMemoryJson()));
        }
        return out;
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

    /** Meus Momentos (§41): salvos, em andamento, concluídos e badges — base do Perfil → Momentos. */
    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user) {
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
    @Transactional(readOnly = true)
    public Map<String, Object> timeline(CurrentUser viewer, UUID userId) {
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

    static String outcome(MomentParticipation p) {
        if (p.getRanking() != null && p.getRanking() == 1) {
            return "WINNER";
        }
        if (p.getPercentile() != null && p.getPercentile() <= 10) {
            return "TOP_10";
        }
        if (p.getStatus() == MomentParticipationStatus.COMPLETED) {
            return "COMPLETED";
        }
        return "PARTICIPATED";
    }

    /** FashionAI Replay (§42): "em {ano} você…", calculado das participações e envios. */
    @Transactional(readOnly = true)
    public Map<String, Object> replay(CurrentUser user, int year) {
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

    /**
     * Verso do card (§16, §35): para uma peça ou look, o MomentMatch e o Hype contextual em cada Momento ativo visível.
     * Hype contextual = Hype global ajustado pela relevância no Momento (clamp(hype + (match − 50) · 0,5)), derivado
     * e temporal — o Hype global nunca é sobrescrito. Sem Hype calculado ou sem base de tags, devolve nulo.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> contextFor(CurrentUser viewer, HypeEntityType type, UUID id) {
        Instant now = now();
        MomentMatch.Subject subject;
        Double hype;
        UUID ownerId;
        Visibility vis;
        if (type == HypeEntityType.PIECE) {
            WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            ownerId = w.getUser().getId();
            vis = w.getVisibility();
            subject = subjectOf(w);
            hype = hypeOf(HypeEntityType.PIECE, id, isOwner(viewer, ownerId));
        } else {
            Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("moment.look")));
            ownerId = s.getUser().getId();
            vis = s.getVisibility();
            subject = subjectOf(s, schemeItems.findBySchemeIdOrderBySortOrder(id));
            hype = hypeOf(HypeEntityType.SCHEME, id, isOwner(viewer, ownerId));
        }
        if (!guard.canView(viewer, ownerId, vis)) {
            throw guard.deny(viewer, type.name().toLowerCase(Locale.ROOT) + ":" + id, Msg.t("guard.este_conteudo_nao_esta_visivel"));
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Moment m : visibleLive(viewer, countryOf(viewer))) {
            if (!MomentTime.active(m, now)) {
                continue;
            }
            MomentMatch.Result r = MomentMatch.score(contextOf(m, null), subject);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("momentId", m.getId());
            row.put("slug", m.getSlug());
            row.put("name", MomentViews.localized(m.getName(), m.getNamesJson()));
            row.put("icon", MomentViews.theme(m).get("icon"));
            row.put("match", r == null ? null : r.score());
            row.put("interpretation", r == null ? null : r.interpretation());
            row.put("contextualHype", contextualHype(hype, r == null ? null : r.score()));
            rows.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("id", id);
        out.put("globalHype", hype == null ? null : Math.round(hype));
        out.put("moments", rows);
        return out;
    }

    public static Integer contextualHype(Double hype, Integer match) {
        if (hype == null || match == null) {
            return null;
        }
        return (int) Math.max(0, Math.min(100, Math.round(hype + (match - 50) * 0.5)));
    }

    /** Resumo para o Copilot (§17): Momentos ativos com tags e interpretações, para ele montar leituras por DNA. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> activeSummary(UUID userId) {
        Instant now = now();
        User u = userId == null ? null : users.findById(userId).orElse(null);
        CurrentUser viewer = u == null ? null : CurrentUser.of(u, null, null);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Moment m : visibleLive(viewer, u == null ? null : u.getCountry())) {
            if (!MomentTime.active(m, now)) {
                continue;
            }
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("id", m.getId());
            s.put("slug", m.getSlug());
            s.put("name", MomentViews.localized(m.getName(), m.getNamesJson()));
            s.put("type", m.getType().name());
            s.put("styleTags", Json.csv(m.getStyleTags()));
            s.put("colorTags", Json.csv(m.getColorTags()));
            s.put("occasionTags", Json.csv(m.getOccasionTags()));
            s.put("interpretations", MomentViews.interpretations(m));
            s.put("daysLeft", MomentTime.view(m, now).get("daysLeft"));
            s.put("pointsMultiplier", m.getPointsMultiplier() == null ? 1.0 : m.getPointsMultiplier().doubleValue());
            s.put("bonusRules", MomentPointsPolicy.bonusRules(m));
            out.add(s);
        }
        return out;
    }

    // ================================================================== ações (§46, §58)
    public record JoinRequest(String approach, Boolean wardrobeOnly) {
    }

    /** Salvar no calendário / lembrar-me / preparar look (§46) — antes de começar ou durante. */
    @Transactional
    public Map<String, Object> save(CurrentUser user, String idOrSlug, Boolean remind, UUID preparedSchemeId) {
        guard.requireCanCreate(user);
        Moment m = visible(user, idOrSlug);
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseGet(() -> fresh(m, user.id()));
        if (remind != null) {
            p.setRemind(remind);
        }
        if (preparedSchemeId != null) {
            Scheme s = schemes.findById(preparedSchemeId).orElseThrow(() -> ApiException.notFound(Msg.t("moment.look")));
            guard.requireOwner(user, s.getUser().getId(), "scheme:" + s.getId());
            p.setPreparedSchemeId(s.getId());
        }
        participations.save(p);
        return Map.of("me", participationView(p), "message", Msg.t("moment.salvo_no_seu_calendario"));
    }

    @Transactional
    public Map<String, Object> unsave(CurrentUser user, String idOrSlug) {
        Moment m = visible(user, idOrSlug);
        participations.findByMomentIdAndUserId(m.getId(), user.id()).ifPresent(p -> {
            if (p.getStatus() == MomentParticipationStatus.INTERESTED) {
                participations.delete(p);
            } else {
                p.setRemind(false);
                participations.save(p);
            }
        });
        return Map.of("ok", true);
    }

    MomentParticipation fresh(Moment m, UUID userId) {
        MomentParticipation p = new MomentParticipation();
        p.setMomentId(m.getId());
        p.setUserId(userId);
        p.setStatus(MomentParticipationStatus.INTERESTED);
        return p;
    }

    /** PARTICIPAR: "como quer participar?" + "usar só meu guarda-roupa?". Reentrar não zera nada (anti-farming). */
    @Transactional
    public Map<String, Object> join(CurrentUser user, String idOrSlug, JoinRequest req) {
        guard.requireCanCreate(user);
        Instant now = now();
        Moment m = visible(user, idOrSlug);
        MomentStatus eff = MomentTime.effective(m, now);
        if (eff != MomentStatus.ACTIVE && eff != MomentStatus.SCHEDULED) {
            throw ApiException.conflict("MOMENTO_ENCERRADO", Msg.t("moment.este_momento_ja_terminou"));
        }
        if (m.getGroupId() != null && !isMember(user.id(), m.getGroupId()) && !user.id().equals(m.getCreatedByUserId())) {
            throw guard.deny(user, "moment:" + m.getSlug(), Msg.t("moment.so_membros_do_grupo"));
        }
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseGet(() -> fresh(m, user.id()));
        boolean first = p.getJoinedAt() == null;
        if (req != null && req.approach() != null) {
            p.setApproach(MomentApproach.valueOf(req.approach().toUpperCase(Locale.ROOT)));
        }
        if (req != null && req.wardrobeOnly() != null) {
            p.setWardrobeOnly(req.wardrobeOnly());
        }
        if (p.getStatus() == MomentParticipationStatus.INTERESTED || p.getStatus() == MomentParticipationStatus.LEFT) {
            p.setStatus(MomentParticipationStatus.JOINED);
        }
        if (first) {
            p.setJoinedAt(now);
        }
        p.setLeftAt(null);
        p.setJoinCount(p.getJoinCount() + 1);
        participations.save(p);
        if (first) {
            m.setParticipantCount(m.getParticipantCount() + 1);
            moments.save(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("me", participationView(p));
        out.put("message", eff == MomentStatus.SCHEDULED ? Msg.t("moment.voce_esta_dentro_comeca", MomentTime.localStart(m).toString()) : Msg.t("moment.voce_esta_dentro"));
        out.put("nextSteps", List.of("CREATE_LOOK", "USE_WARDROBE", "ASK_COPILOT", "SEE_COMMUNITY"));
        return out;
    }

    @Transactional
    public Map<String, Object> leave(CurrentUser user, String idOrSlug) {
        Moment m = visible(user, idOrSlug);
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("moment.participacao")));
        if (p.getStatus() == MomentParticipationStatus.COMPLETED) {
            throw ApiException.conflict("MOMENTO_CONCLUIDO", Msg.t("moment.momento_concluido_fica_no_historico"));
        }
        p.setStatus(MomentParticipationStatus.LEFT);
        p.setLeftAt(now());
        participations.save(p);
        return Map.of("me", participationView(p));
    }

    /** Visibilidade no perfil (§41): a pessoa controla cada participação. */
    @Transactional
    public Map<String, Object> setProfileVisibility(CurrentUser user, String idOrSlug, boolean publicOnProfile) {
        Moment m = visible(user, idOrSlug);
        MomentParticipation p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("moment.participacao")));
        p.setPublicOnProfile(publicOnProfile);
        participations.save(p);
        return Map.of("me", participationView(p));
    }

    public record SubmitRequest(UUID schemeId, UUID challengeId, String interpretation) {
    }

    /** Pré-visualização (§58): MomentMatch + FAI Points previstos, sem gravar nada. */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(CurrentUser user, String idOrSlug, SubmitRequest req) {
        Moment m = visible(user, idOrSlug);
        Scheme s = ownedScheme(user, req.schemeId());
        Evaluation ev = evaluate(m, user.id(), s, req.challengeId(), req.interpretation(), false);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("match", ev.match == null ? null : ev.match.toMap());
        out.put("scores", ev.scores);
        out.put("points", ev.lines.stream().map(MomentPointsPolicy.Line::toMap).toList());
        out.put("pointsTotal", MomentPointsPolicy.total(ev.lines));
        out.put("wardrobeOnly", ev.facts.wardrobeOnly());
        out.put("rediscovered", ev.facts.rediscoveredPieces());
        out.put("newStyles", ev.facts.newStyles());
        out.put("explanation", explain(ev.match));
        out.put("alreadySubmitted", submissions.findByMomentIdAndSchemeId(m.getId(), s.getId()).isPresent());
        return out;
    }

    /** ENVIAR LOOK: grava o envio, paga os pontos (idempotentes), conclui a participação e concede a badge. */
    @Transactional
    public Map<String, Object> submit(CurrentUser user, String idOrSlug, SubmitRequest req) {
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
            join(user, idOrSlug, null);
            p = participations.findByMomentIdAndUserId(m.getId(), user.id()).orElseThrow();
        }
        int limit = ((Number) settings(m).getOrDefault("looksPerUser", 0)).intValue();
        List<MomentSubmission> mine = submissions.findByMomentIdAndUserIdAndWithdrawnFalse(m.getId(), user.id());
        if (limit > 0 && mine.size() >= limit) {
            throw ApiException.conflict("LIMITE_DE_LOOKS", Msg.t("moment.limite_de_looks_neste_momento", limit));
        }
        Evaluation ev = evaluate(m, user.id(), s, req.challengeId(), req.interpretation(), true);
        MomentSubmission sub = new MomentSubmission();
        sub.setMomentId(m.getId());
        sub.setParticipationId(p.getId());
        sub.setUserId(user.id());
        sub.setSchemeId(s.getId());
        sub.setChallengeId(req.challengeId());
        sub.setMatchScore(ev.match == null ? null : ev.match.score());
        sub.setMatchJson(ev.match == null ? null : Json.write(ev.match.toMap()));
        sub.setWardrobeOnly(ev.facts.wardrobeOnly());
        sub.setRediscoveredJson(Json.write(ev.facts.rediscoveredPieces()));
        Double hypeNow = hypeOf(HypeEntityType.SCHEME, s.getId(), true);
        sub.setHypeAtSubmission(hypeNow == null ? null : (int) Math.round(hypeNow));
        sub.setSubmittedAt(now);
        // pontos: cada linha paga 1× pelo ledger (idempotência por usuário:ação:referência)
        int earned = 0;
        List<Map<String, Object>> paid = new ArrayList<>();
        for (MomentPointsPolicy.Line line : ev.lines) {
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
        if (ev.match != null && (p.getBestMatch() == null || ev.match.score() > p.getBestMatch())) {
            p.setBestMatch(ev.match.score());
        }
        boolean related = ev.match == null ? contextOf(m, null).empty() : ev.match.score() >= MomentPointsPolicy.RELATED_THRESHOLD;
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
        out.put("submission", submissionView(sub, user, Map.of(), false));
        out.put("me", participationView(p));
        out.put("match", ev.match == null ? null : ev.match.toMap());
        out.put("scores", ev.scores);
        out.put("points", paid);
        out.put("pointsTotal", earned + completionPoints);
        out.put("completed", completedNow);
        out.put("badge", completedNow ? p.getBadgeCode() : null);
        out.put("explanation", explain(ev.match));
        out.put("message", completedNow ? Msg.t("moment.momento_concluido_pts", earned + completionPoints) : Msg.t("moment.look_enviado"));
        return out;
    }

    boolean isFlair(Moment m) {
        return m.getType() == MomentType.FLAIR_EVENT || m.getType() == MomentType.PRIVATE_GROUP || m.getGroupId() != null;
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

    /** Explicação do MomentMatch (§13): razões, nunca um veredito. */
    static List<Map<String, Object>> explain(MomentMatch.Result r) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (r == null) {
            return out;
        }
        for (String reason : r.reasons()) {
            int i = reason.indexOf(':');
            String kind = i < 0 ? reason : reason.substring(0, i);
            List<String> values = i < 0 ? List.of() : Json.csv(reason.substring(i + 1));
            out.add(Map.of("kind", kind, "values", values));
        }
        return out;
    }

    // ================================================================== avaliação de um look (fatos verificáveis)
    record Evaluation(MomentMatch.Result match, MomentPointsPolicy.Facts facts, List<MomentPointsPolicy.Line> lines, Map<String, Object> scores) {
    }

    Evaluation evaluate(Moment m, UUID userId, Scheme s, UUID challengeId, String interpretation, boolean countingThis) {
        Instant now = now();
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
        if (items.isEmpty()) {
            throw ApiException.badRequest("LOOK_VAZIO", Msg.t("moment.o_look_precisa_de_pecas"));
        }
        List<WardrobeItem> look = items.stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).toList();
        List<MomentChallenge> cs = challenges.findByMomentIdOrderBySortOrderAsc(m.getId());
        MomentChallenge chosen = challengeId == null ? null : cs.stream().filter(c -> c.getId().equals(challengeId)).findFirst()
                .orElseThrow(() -> ApiException.notFound(Msg.t("moment.desafio")));
        MomentMatch.Subject subject = subjectOf(s, items);
        MomentMatch.Result match = MomentMatch.score(contextOf(m, chosen), subject);
        if (match != null && interpretation != null && match.interpretation() == null) {
            match = new MomentMatch.Result(match.score(), match.parts(), interpretation, match.reasons());
        }
        // fatos
        boolean wardrobeOnly = look.stream().allMatch(w -> w.getCreatedAt() != null && w.getCreatedAt().isBefore(m.getStartAt()));
        Map<UUID, LocalDate> lastDiary = new HashMap<>();
        for (PieceUsageDiaryEntry e : diary.findByUserIdAndUsedOnAfter(userId, LocalDate.now(ZoneId.of("America/Sao_Paulo")).minusYears(5))) {
            lastDiary.merge(e.getWardrobeItemId(), e.getUsedOn(), (a, b) -> a.isAfter(b) ? a : b);
        }
        List<Scheme> previous = schemes.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(x -> !x.getId().equals(s.getId()) && x.getCreatedAt() != null && x.getCreatedAt().isBefore(s.getCreatedAt() == null ? now : s.getCreatedAt())).toList();
        Map<UUID, Instant> lastInLook = new HashMap<>();
        if (!previous.isEmpty()) {
            for (SchemeItem si : schemeItems.findBySchemeIdIn(previous.stream().map(Scheme::getId).toList())) {
                if (si.getWardrobeItem() != null && si.getScheme() != null && si.getScheme().getCreatedAt() != null) {
                    lastInLook.merge(si.getWardrobeItem().getId(), si.getScheme().getCreatedAt(), (a, b) -> a.isAfter(b) ? a : b);
                }
            }
        }
        int idleDays = cs.stream().filter(c -> c.getKind() == br.com.fashionai.domain.model.enums.MomentChallengeKind.REDISCOVERY)
                .map(c -> MomentPointsPolicy.intParam(Json.map(c.getParamsJson()), "idleDays", MomentPointsPolicy.DEFAULT_IDLE_DAYS)).min(Integer::compare).orElse(MomentPointsPolicy.DEFAULT_IDLE_DAYS);
        List<UUID> rediscovered = new ArrayList<>();
        long maxIdle = 0;
        LocalDate today = now.atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate();
        for (WardrobeItem w : look) {
            LocalDate last = lastDiary.get(w.getId());
            if (w.getLastWornDate() != null && (last == null || w.getLastWornDate().isAfter(last))) {
                last = w.getLastWornDate();
            }
            Instant inLook = lastInLook.get(w.getId());
            if (inLook != null) {
                LocalDate d = inLook.atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate();
                if (last == null || d.isAfter(last)) {
                    last = d;
                }
            }
            if (last == null && w.getCreatedAt() != null) {
                last = w.getCreatedAt().atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate();
            }
            long idle = last == null ? 0 : ChronoUnit.DAYS.between(last, today);
            if (idle >= idleDays) {
                rediscovered.add(w.getId());
                maxIdle = Math.max(maxIdle, idle);
            }
        }
        boolean remix = s.getOriginalScheme() != null && s.getOriginalScheme().getCreatedAt() != null && s.getOriginalScheme().getCreatedAt().isBefore(m.getStartAt());
        Set<String> usedBefore = previous.stream().flatMap(x -> Json.csv(x.getStyle()).stream()).map(x -> x.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        Set<String> newStyles = subject.styles().stream().filter(x -> !usedBefore.contains(x)).collect(Collectors.toCollection(LinkedHashSet::new));
        if (previous.isEmpty()) {
            newStyles = Set.of();   // primeiro look não "experimenta estilo novo": não há histórico para comparar
        }
        int distinctColors = (int) look.stream().map(WardrobeItem::getColor).filter(Objects::nonNull).map(c -> c.toLowerCase(Locale.ROOT)).distinct().count();
        List<MomentSubmission> mine = submissions.findByMomentIdAndUserIdAndWithdrawnFalse(m.getId(), userId);
        Map<UUID, Integer> looksPerPiece = new HashMap<>();
        look.forEach(w -> looksPerPiece.merge(w.getId(), 1, Integer::sum));
        if (!mine.isEmpty()) {
            for (SchemeItem si : schemeItems.findBySchemeIdIn(mine.stream().map(MomentSubmission::getSchemeId).toList())) {
                if (si.getWardrobeItem() != null) {
                    looksPerPiece.merge(si.getWardrobeItem().getId(), 1, Integer::sum);
                }
            }
        }
        boolean published = s.getStatus() == SchemeStatus.PUBLISHED && s.getVisibility() != Visibility.PRIVATE
                && (s.getPublishedAt() == null || !s.getPublishedAt().isBefore(m.getStartAt()));
        MomentPointsPolicy.Facts facts = new MomentPointsPolicy.Facts(match == null ? (contextOf(m, null).empty() ? 100 : null) : match.score(), published, wardrobeOnly, rediscovered, maxIdle,
                remix, newStyles, distinctColors, looksPerPiece, subject.styles(), subject.colors(), mine.size() + (countingThis ? 1 : 0));
        List<MomentPointsPolicy.Line> lines = MomentPointsPolicy.compute(m, cs, facts);
        Map<String, Object> scores = new LinkedHashMap<>();
        scores.put("moment", match == null ? null : match.score());
        Double hypeScore = hypeOf(HypeEntityType.SCHEME, s.getId(), true);   // avaliação do próprio look
        scores.put("hype", hypeScore == null ? null : (int) Math.round(hypeScore));
        scores.put("contextualHype", contextualHype(hypeScore, match == null ? null : match.score()));
        scores.put("reuse", look.isEmpty() ? null : (int) Math.round(100.0 * look.stream().filter(w -> w.getCreatedAt() != null && w.getCreatedAt().isBefore(m.getStartAt())).count() / look.size()));
        scores.put("rediscovery", look.isEmpty() ? null : (int) Math.round(100.0 * rediscovered.size() / look.size()));
        return new Evaluation(match, facts, lines, scores);
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

    @SuppressWarnings("unchecked")
    static List<String> strings(Object v) {
        return v instanceof List<?> l ? ((List<Object>) l).stream().map(String::valueOf).toList() : List.of();
    }

    /**
     * HypeScore v2 gravado pelo job (nada é recalculado aqui): só com dados suficientes; de terceiros, só o público
     * elegível — o Hype pessoal de item privado ou de perfil restrito é só do dono. Sem score = nulo, nunca 0.
     */
    Double hypeOf(HypeEntityType type, UUID id, boolean owner) {
        if (hype == null || hypeConfig == null || id == null) {
            return null;
        }
        return hype.findByEntityTypeAndEntityIdAndAlgorithmVersion(type, id, hypeConfig.algorithmVersion())
                .filter(c -> c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null && (owner || c.isPublicEligible()))
                .map(c -> c.getScore().doubleValue()).orElse(null);
    }

    private static boolean isOwner(CurrentUser viewer, UUID ownerId) {
        return viewer != null && ownerId != null && ownerId.equals(viewer.id());
    }

    static MomentMatch.Subject subjectOf(Scheme s, List<SchemeItem> items) {
        Set<String> styles = new LinkedHashSet<>(Json.csv(s.getStyle()));
        Set<String> colors = new LinkedHashSet<>();
        Set<String> subs = new LinkedHashSet<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            if (w == null) {
                continue;
            }
            styles.addAll(Json.csv(w.getStyleTags()));
            colors.addAll(HypeQueryService.colorsOf(w));
            if (w.getSubcategory() != null) {
                subs.add(w.getSubcategory());
            }
        }
        return MomentMatch.subject(styles, colors, Json.csv(s.getOccasion()), subs);
    }

    static MomentMatch.Subject subjectOf(WardrobeItem w) {
        return MomentMatch.subject(Json.csv(w.getStyleTags()), HypeQueryService.colorsOf(w), Json.csv(w.getOccasionTags()),
                w.getSubcategory() == null ? List.of() : List.of(w.getSubcategory()));
    }

    // ================================================================== comunidade: feed, ranking, votação, trending
    /** Feed do Momento: looks enviados; só públicos para quem não é membro, tudo para membros de um Momento de grupo. */
    @Transactional(readOnly = true)
    public Map<String, Object> feed(CurrentUser viewer, String idOrSlug) {
        Moment m = visible(viewer, idOrSlug);
        boolean member = viewer != null && (viewer.admin() || (m.getGroupId() != null && isMember(viewer.id(), m.getGroupId())));
        List<MomentSubmission> subs = submissions.findByMomentIdAndWithdrawnFalseOrderBySubmittedAtDesc(m.getId());
        Map<UUID, Scheme> byId = schemes.findByIdIn(subs.stream().map(MomentSubmission::getSchemeId).toList()).stream().collect(Collectors.toMap(Scheme::getId, x -> x));
        Set<UUID> myVotes = viewer == null ? Set.of() : votes.findByMomentIdAndVoterId(m.getId(), viewer.id()).stream().map(MomentVote::getSubmissionId).collect(Collectors.toSet());
        List<Map<String, Object>> items = new ArrayList<>();
        for (MomentSubmission s : subs) {
            Scheme sc = byId.get(s.getSchemeId());
            if (sc == null) {
                continue;
            }
            boolean own = viewer != null && viewer.id().equals(s.getUserId());
            if (!own && !member && !guard.canView(viewer, sc.getUser().getId(), sc.getVisibility())) {
                continue;
            }
            items.add(submissionView(s, viewer, Map.of(), myVotes.contains(s.getId())));
            if (items.size() >= FEED_MAX) {
                break;
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("dimensions", competitive(m) ? List.of(MomentVoteDimension.values()) : List.of());
        return out;
    }

    Map<String, Object> submissionView(MomentSubmission s, CurrentUser viewer, Map<UUID, Scheme> cache, boolean votedByMe) {
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
            v.put("contextualHype", contextualHype(hypeOf(HypeEntityType.SCHEME, sc.getId(), isOwner(viewer, s.getUserId())), s.getMatchScore()));
        }
        return v;
    }

    /** Ranking (§36): votos por dimensão + MomentMatch como desempate. Só Momentos competitivos; privados só para membros. */
    @Transactional(readOnly = true)
    public Map<String, Object> leaderboard(CurrentUser viewer, String idOrSlug) {
        Moment m = visible(viewer, idOrSlug);
        Map<String, Object> out = new LinkedHashMap<>();
        if (!competitive(m)) {
            out.put("competitive", false);
            out.put("items", List.of());
            if (m.getFlairMode() == FlairMomentMode.COOPERATIVE) {
                long looks = submissions.countByMomentIdAndWithdrawnFalse(m.getId());
                out.put("cooperative", Map.of("goal", m.getCooperativeGoal() == null ? 0 : m.getCooperativeGoal(), "looks", looks));
            }
            return out;
        }
        List<MomentSubmission> subs = submissions.findByMomentIdAndWithdrawnFalseOrderBySubmittedAtDesc(m.getId());
        Map<UUID, Map<MomentVoteDimension, Integer>> byDim = new HashMap<>();
        for (MomentVote v : votes.findByMomentId(m.getId())) {
            byDim.computeIfAbsent(v.getSubmissionId(), k -> new java.util.EnumMap<>(MomentVoteDimension.class)).merge(v.getDimension(), 1, Integer::sum);
        }
        List<MomentSubmission> ranked = subs.stream().sorted(Comparator.comparingInt(MomentSubmission::getVoteCount).reversed()
                .thenComparing(s -> s.getMatchScore() == null ? 0 : s.getMatchScore(), Comparator.reverseOrder()).thenComparing(MomentSubmission::getSubmittedAt)).limit(LEADERBOARD_MAX).toList();
        Map<UUID, User> owners = users.findAllById(ranked.stream().map(MomentSubmission::getUserId).collect(Collectors.toSet())).stream().collect(Collectors.toMap(User::getId, u -> u));
        boolean anonymous = Boolean.TRUE.equals(settings(m).get("anonymousVoting")) && !m.getVisibility().discoverable();
        List<Map<String, Object>> items = new ArrayList<>();
        int pos = 0;
        for (MomentSubmission s : ranked) {
            pos++;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("position", pos);
            row.put("submissionId", s.getId());
            row.put("schemeId", s.getSchemeId());
            row.put("votes", s.getVoteCount());
            row.put("match", s.getMatchScore());
            row.put("byDimension", byDim.getOrDefault(s.getId(), Map.of()).entrySet().stream().collect(Collectors.toMap(e -> e.getKey().name(), Map.Entry::getValue)));
            row.put("you", viewer != null && viewer.id().equals(s.getUserId()));
            row.put("user", anonymous && !(viewer != null && viewer.id().equals(s.getUserId())) ? null : Views.user(owners.get(s.getUserId())));
            schemes.findById(s.getSchemeId()).ifPresent(sc -> {
                row.put("title", sc.getTitle());
                row.put("coverImageUrl", sc.getCoverImageUrl());
            });
            items.add(row);
        }
        out.put("competitive", true);
        out.put("items", items);
        out.put("dimensions", List.of(MomentVoteDimension.values()));
        return out;
    }

    public record VoteRequest(UUID submissionId, String dimension) {
    }

    /** Votar/desvotar numa dimensão. Nunca no próprio look; nunca fora do período; um por (envio, dimensão). */
    @Transactional
    public Map<String, Object> vote(CurrentUser user, String idOrSlug, VoteRequest req) {
        guard.requireCanCreate(user);
        Moment m = visible(user, idOrSlug);
        if (!competitive(m)) {
            throw ApiException.conflict("SEM_VOTACAO", Msg.t("moment.este_momento_nao_tem_votacao"));
        }
        if (MomentTime.effective(m, now()) != MomentStatus.ACTIVE) {
            throw ApiException.conflict("MOMENTO_FORA_DO_PERIODO", Msg.t("moment.votacao_so_durante_o_periodo"));
        }
        if (m.getGroupId() != null && !isMember(user.id(), m.getGroupId())) {
            throw guard.deny(user, "moment:" + m.getSlug(), Msg.t("moment.so_membros_do_grupo"));
        }
        MomentSubmission s = submissions.findById(req.submissionId()).filter(x -> x.getMomentId().equals(m.getId()) && !x.isWithdrawn())
                .orElseThrow(() -> ApiException.notFound(Msg.t("moment.envio")));
        if (s.getUserId().equals(user.id())) {
            throw ApiException.conflict("VOTO_PROPRIO", Msg.t("moment.nao_da_para_votar_no_proprio"));
        }
        MomentVoteDimension dim = MomentVoteDimension.valueOf(req.dimension().toUpperCase(Locale.ROOT));
        Optional<MomentVote> existing = votes.findBySubmissionIdAndVoterIdAndDimension(s.getId(), user.id(), dim);
        boolean voted;
        if (existing.isPresent()) {
            votes.delete(existing.get());
            s.setVoteCount(Math.max(0, s.getVoteCount() - 1));
            voted = false;
        } else {
            MomentVote v = new MomentVote();
            v.setMomentId(m.getId());
            v.setSubmissionId(s.getId());
            v.setVoterId(user.id());
            v.setDimension(dim);
            votes.save(v);
            s.setVoteCount(s.getVoteCount() + 1);
            voted = true;
        }
        submissions.save(s);
        return Map.of("voted", voted, "dimension", dim.name(), "votes", s.getVoteCount());
    }

    /** "Em alta no Halloween" (§36): estilos, cores, interpretações e looks mais votados/com maior Hype contextual. */
    @Transactional(readOnly = true)
    public Map<String, Object> trending(CurrentUser viewer, String idOrSlug, int limit) {
        return trending(viewer, visible(viewer, idOrSlug), limit);
    }

    Map<String, Object> trending(CurrentUser viewer, Moment m, int limit) {
        List<MomentSubmission> subs = submissions.findByMomentIdAndWithdrawnFalseOrderBySubmittedAtDesc(m.getId());
        boolean member = viewer != null && (viewer.admin() || (m.getGroupId() != null && isMember(viewer.id(), m.getGroupId())));
        Map<String, Integer> styles = new HashMap<>(), colors = new HashMap<>(), interps = new HashMap<>();
        List<Map<String, Object>> looks = new ArrayList<>();
        Map<UUID, Scheme> byId = schemes.findByIdIn(subs.stream().map(MomentSubmission::getSchemeId).toList()).stream().collect(Collectors.toMap(Scheme::getId, x -> x));
        for (MomentSubmission s : subs) {
            Scheme sc = byId.get(s.getSchemeId());
            if (sc == null || (!member && !guard.canView(viewer, sc.getUser().getId(), sc.getVisibility()))) {
                continue;
            }
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
            l.put("contextualHype", contextualHype(hypeOf(HypeEntityType.SCHEME, sc.getId(), isOwner(viewer, s.getUserId())), s.getMatchScore()));
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

    static List<Map<String, Object>> top(Map<String, Integer> counts, int limit) {
        return counts.entrySet().stream().sorted(Map.Entry.<String, Integer>comparingByValue().reversed()).limit(limit)
                .map(e -> Map.<String, Object>of("key", e.getKey(), "count", e.getValue())).toList();
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

    // ================================================================== FLAIR — Momentos privados (§26–§34)
    public record GroupMomentRequest(String name, String description, String theme, String startAt, String endAt, String timezone,
                                     String visibility, String flairMode, Integer looksPerUser, Boolean allowRemix, Boolean allowVoting,
                                     Boolean allowComments, Boolean allowAi, Boolean allowExternalPieces, Boolean anonymousVoting,
                                     List<Integer> prizes, Integer cooperativeGoal, List<String> styleTags, List<String> colorTags,
                                     List<String> occasionTags, String rules, UUID basedOnMomentId) {
    }

    /** Calendário do grupo (§33): próximos, ativos e Memórias (§34). Só para membros. */
    @Transactional(readOnly = true)
    public Map<String, Object> groupMoments(CurrentUser user, UUID teamId) {
        FlairTeam t = teams.findById(teamId).orElseThrow(() -> ApiException.notFound(Msg.t("moment.grupo")));
        if (!user.admin() && !isMember(user.id(), teamId)) {
            throw guard.deny(user, "team:" + teamId, Msg.t("moment.so_membros_do_grupo"));
        }
        Instant now = now();
        Map<String, Object> out = groupSummary(t, now);
        List<Moment> all = moments.findByGroupIdOrderByStartAtDesc(teamId);
        Map<UUID, MomentParticipation> mine = participations.findByMomentIdInAndUserId(all.stream().map(Moment::getId).toList(), user.id()).stream()
                .collect(Collectors.toMap(MomentParticipation::getMomentId, p -> p, (a, b) -> a));
        List<Map<String, Object>> upcoming = new ArrayList<>(), active = new ArrayList<>(), history = new ArrayList<>();
        for (Moment m : all) {
            if (m.getStatus() == MomentStatus.CANCELLED) {
                continue;
            }
            Map<String, Object> c = MomentViews.card(m, now);
            c.put("me", participationView(mine.get(m.getId())));
            switch (MomentTime.effective(m, now)) {
                case SCHEDULED, DRAFT -> upcoming.add(c);
                case ACTIVE -> active.add(c);
                default -> {
                    c.put("memory", Json.map(m.getMemoryJson()));
                    history.add(c);
                }
            }
        }
        upcoming.sort(Comparator.comparing(c -> (String) ((Map<?, ?>) c.get("time")).get("startAt")));
        out.put("upcoming", upcoming);
        out.put("active", active);
        out.put("history", history);
        out.put("members", members.countByTeamId(teamId));
        out.put("modes", List.of(FlairMomentMode.values()));
        return out;
    }

    Map<String, Object> groupSummary(FlairTeam t, Instant now) {
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("id", t.getId());
        g.put("name", t.getName());
        g.put("color", t.getColor());
        g.put("code", t.getCode());
        List<Moment> live = moments.findByGroupIdOrderByStartAtDesc(t.getId()).stream().filter(m -> m.getStatus().live()).toList();
        g.put("activeCount", live.stream().filter(m -> MomentTime.active(m, now)).count());
        g.put("upcomingCount", live.stream().filter(m -> MomentTime.upcoming(m, now)).count());
        return g;
    }

    /** FLAIR → Criar → Momento privado (§27). Nunca público; nunca em descoberta; membros avisados uma vez (§44). */
    @Transactional
    public Map<String, Object> createGroupMoment(CurrentUser user, UUID teamId, GroupMomentRequest req) {
        guard.requireCanCreate(user);
        FlairTeam t = teams.findById(teamId).orElseThrow(() -> ApiException.notFound(Msg.t("moment.grupo")));
        if (!isMember(user.id(), teamId)) {
            throw guard.deny(user, "team:" + teamId, Msg.t("moment.so_membros_do_grupo"));
        }
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("NOME_OBRIGATORIO", Msg.t("moment.de_um_nome_ao_momento"));
        }
        Instant start = parseInstant(req.startAt(), "startAt");
        Instant end = parseInstant(req.endAt(), "endAt");
        if (!end.isAfter(start)) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("moment.o_fim_precisa_ser_depois"));
        }
        if (end.isBefore(now())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("moment.o_momento_ja_teria_terminado"));
        }
        Moment m = new Moment();
        Moment base = req.basedOnMomentId() == null ? null : moments.findById(req.basedOnMomentId()).filter(x -> canSee(user, x)).orElse(null);
        m.setSlug(slugFor(req.name(), t.getCode()));
        m.setName(req.name().trim());
        m.setDescription(req.description() == null ? null : req.description().trim());
        m.setType(req.flairMode() == null ? MomentType.PRIVATE_GROUP : MomentType.FLAIR_EVENT);
        m.setNature(MomentNature.PRIVATE);
        m.setStatus(start.isAfter(now()) ? MomentStatus.SCHEDULED : MomentStatus.ACTIVE);
        m.setStartAt(start);
        m.setEndAt(end);
        m.setTimezone(MomentTime.zone(req.timezone()).getId());
        m.setScope(MomentScope.GROUP);
        MomentVisibility vis = req.visibility() == null ? MomentVisibility.GROUP : MomentVisibility.valueOf(req.visibility().toUpperCase(Locale.ROOT));
        if (vis == MomentVisibility.PUBLIC) {
            vis = MomentVisibility.GROUP;   // Momento de grupo nunca é público (§28)
        }
        m.setVisibility(vis);
        m.setCreatedByUserId(user.id());
        m.setGroupId(t.getId());
        m.setOfficial(false);
        m.setPointsEnabled(true);
        m.setBasePoints(0);
        m.setPointsMultiplier(BigDecimal.ONE);
        m.setFlairMode(req.flairMode() == null ? FlairMomentMode.MOMENT : FlairMomentMode.valueOf(req.flairMode().toUpperCase(Locale.ROOT)));
        m.setCooperativeGoal(m.getFlairMode() == FlairMomentMode.COOPERATIVE ? Optional.ofNullable(req.cooperativeGoal()).filter(g -> g > 0).orElse(10) : null);
        m.setStyleTags(Json.csv(req.styleTags() == null || req.styleTags().isEmpty() ? (base == null ? List.of() : Json.csv(base.getStyleTags())) : req.styleTags()));
        m.setColorTags(Json.csv(req.colorTags() == null || req.colorTags().isEmpty() ? (base == null ? List.of() : Json.csv(base.getColorTags())) : req.colorTags()));
        m.setOccasionTags(Json.csv(req.occasionTags() == null ? List.of() : req.occasionTags()));
        if (base != null) {
            m.setInterpretationsJson(base.getInterpretationsJson());
            m.setThemeJson(base.getThemeJson());
        } else {
            m.setThemeJson(Json.write(Map.of("accent", t.getColor() == null ? "#1F7A76" : t.getColor(), "icon", "🎯", "animation", "none")));
        }
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("looksPerUser", req.looksPerUser() == null ? 1 : Math.max(0, req.looksPerUser()));
        settings.put("allowRemix", req.allowRemix() == null || req.allowRemix());
        settings.put("allowVoting", req.allowVoting() == null || req.allowVoting());
        settings.put("allowComments", req.allowComments() == null || req.allowComments());
        settings.put("allowAi", req.allowAi() == null || req.allowAi());
        settings.put("allowExternalPieces", req.allowExternalPieces() == null || req.allowExternalPieces());
        settings.put("anonymousVoting", req.anonymousVoting() == null || req.anonymousVoting());
        settings.put("prizes", req.prizes() == null ? List.of() : req.prizes().stream().map(x -> Math.max(0, Math.min(MAX_PRIZE, x))).limit(3).toList());
        settings.put("theme", req.theme());
        m.setSettingsJson(Json.write(settings));
        Map<String, Object> rules = new LinkedHashMap<>();
        rules.put("text", req.rules());
        rules.put("theme", req.theme());
        m.setRulesJson(Json.write(rules));
        moments.save(m);
        // o criador já está dentro; os demais membros recebem um único aviso
        join(user, m.getId().toString(), null);
        for (FlairTeamMember mm : members.findByTeamIdOrderByCreatedAtAsc(t.getId())) {
            if (!mm.getUser().getId().equals(user.id())) {
                notifications.notify(mm.getUser().getId(), user.id(), NotificationType.MOMENT_GROUP_CREATED, "MOMENT", m.getId(),
                        Msg.k("moment.notif.grupo_criou_titulo", t.getName()), Msg.k("moment.notif.grupo_criou_corpo", m.getName(), MomentTime.localStart(m).toString()),
                        Map.of("href", "/moments/" + m.getSlug()));
            }
        }
        return detail(user, m.getId().toString());
    }

    String slugFor(String name, String teamCode) {
        String base = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.length() > 40) {
            base = base.substring(0, 40);
        }
        String slug = base + "-" + (teamCode == null ? "g" : teamCode.toLowerCase(Locale.ROOT)) + "-" + Integer.toHexString((int) (now().toEpochMilli() % 0xFFFFF));
        int n = 0;
        while (moments.findBySlug(slug).isPresent()) {
            slug = base + "-" + (++n);
        }
        return slug;
    }

    static Instant parseInstant(String v, String field) {
        if (v == null || v.isBlank()) {
            throw ApiException.badRequest("DATA_OBRIGATORIA", Msg.t("moment.informe_a_data", field));
        }
        try {
            return Instant.parse(v);
        } catch (java.time.format.DateTimeParseException e) {
            try {
                return LocalDate.parse(v.length() > 10 ? v.substring(0, 10) : v).atStartOfDay(ZoneId.of("America/Sao_Paulo")).toInstant();
            } catch (java.time.format.DateTimeParseException e2) {
                throw ApiException.badRequest("DATA_INVALIDA", Msg.t("moment.data_invalida", field));
            }
        }
    }

    // ================================================================== job (§45, §44) — status, memórias, avisos
    /** Passa a cada 5 min: SCHEDULED→ACTIVE, ACTIVE→ENDED (Memória, ranking, prêmios), avisos de início e de prazo. */
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 */5 * * * *", zone = "UTC")
    @Transactional
    public Map<String, Integer> tick() {
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
        // melhor envio por pessoa → ranking
        Map<UUID, MomentSubmission> best = new LinkedHashMap<>();
        for (MomentSubmission s : subs) {
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
            MomentSubmission top = subs.stream().filter(s -> byDim.getOrDefault(s.getId(), Map.of()).getOrDefault(d, 0) > 0)
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

    static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    // ================================================================== administração (§56)
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
        guard.requireAdmin(admin);
        Instant now = now();
        return moments.findAllByOrderByStartAtDesc().stream().filter(m -> m.getGroupId() == null).map(m -> {
            Map<String, Object> c = MomentViews.card(m, now);
            c.put("storedStatus", m.getStatus().name());
            c.put("challenges", challenges.findByMomentIdOrderBySortOrderAsc(m.getId()).size());
            c.put("sourceUrl", m.getSourceUrl());
            return c;
        }).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> adminDetail(CurrentUser admin, UUID id) {
        guard.requireAdmin(admin);
        Moment m = moments.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
        Map<String, Object> out = MomentViews.card(m, now());
        out.put("storedStatus", m.getStatus().name());
        out.put("names", Json.map(m.getNamesJson()));
        out.put("descriptions", Json.map(m.getDescriptionsJson()));
        out.put("interpretations", Json.list(m.getInterpretationsJson()));
        out.put("requiredItems", Json.strings(m.getRequiredItemsJson()));
        out.put("suggestedItems", Json.strings(m.getSuggestedItemsJson()));
        out.put("rules", Json.map(m.getRulesJson()));
        out.put("settings", Json.map(m.getSettingsJson()));
        out.put("bonusRules", MomentPointsPolicy.bonusRules(m));
        out.put("sourceUrl", m.getSourceUrl());
        out.put("sourceNote", m.getSourceNote());
        out.put("challenges", challenges.findByMomentIdOrderBySortOrderAsc(m.getId()).stream().map(MomentViews::challenge).toList());
        out.put("memory", Json.map(m.getMemoryJson()));
        return out;
    }

    /** Criar/editar um Momento oficial. Eventos externos exigem fonte (§21); patrocinado exige patrocinador (§47). */
    @Transactional
    public Map<String, Object> adminSave(CurrentUser admin, UUID id, AdminMomentRequest r) {
        guard.requireAdmin(admin);
        Moment m = id == null ? new Moment() : moments.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
        if (id == null) {
            m.setCreatedByUserId(admin.id());
            m.setOfficial(true);
            m.setStatus(MomentStatus.DRAFT);
        }
        if (r.name() != null) {
            m.setName(r.name().trim());
        }
        if (m.getName() == null || m.getName().isBlank()) {
            throw ApiException.badRequest("NOME_OBRIGATORIO", Msg.t("moment.de_um_nome_ao_momento"));
        }
        if (r.slug() != null && !r.slug().isBlank()) {
            String slug = r.slug().trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]+", "-");
            moments.findBySlug(slug).filter(x -> !x.getId().equals(m.getId())).ifPresent(x -> {
                throw ApiException.conflict("SLUG_EM_USO", Msg.t("moment.slug_em_uso"));
            });
            m.setSlug(slug);
        } else if (m.getSlug() == null) {
            m.setSlug(slugFor(m.getName(), "fai"));
        }
        if (r.names() != null) m.setNamesJson(Json.write(r.names()));
        if (r.description() != null) m.setDescription(r.description());
        if (r.descriptions() != null) m.setDescriptionsJson(Json.write(r.descriptions()));
        if (r.type() != null) m.setType(MomentType.valueOf(r.type().toUpperCase(Locale.ROOT)));
        if (r.nature() != null) m.setNature(MomentNature.valueOf(r.nature().toUpperCase(Locale.ROOT)));
        if (r.startAt() != null) m.setStartAt(parseInstant(r.startAt(), "startAt"));
        if (r.endAt() != null) m.setEndAt(parseInstant(r.endAt(), "endAt"));
        if (m.getStartAt() == null || m.getEndAt() == null || !m.getEndAt().isAfter(m.getStartAt())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("moment.o_fim_precisa_ser_depois"));
        }
        if (r.timezone() != null) m.setTimezone(MomentTime.zone(r.timezone()).getId());
        if (r.scope() != null) m.setScope(MomentScope.valueOf(r.scope().toUpperCase(Locale.ROOT)));
        if (r.visibility() != null) m.setVisibility(MomentVisibility.valueOf(r.visibility().toUpperCase(Locale.ROOT)));
        if (r.country() != null) m.setCountry(r.country().isBlank() ? null : r.country().toUpperCase(Locale.ROOT));
        if (r.region() != null) m.setRegion(r.region().isBlank() ? null : r.region());
        if (r.locale() != null) m.setLocale(r.locale().isBlank() ? null : r.locale());
        if (r.season() != null) m.setSeason(r.season().isBlank() ? null : br.com.fashionai.domain.model.enums.Season.valueOf(r.season().toUpperCase(Locale.ROOT)));
        if (r.theme() != null) m.setThemeJson(Json.write(r.theme()));
        if (r.coverUrl() != null) m.setCoverUrl(r.coverUrl().isBlank() ? null : r.coverUrl());
        if (r.bannerUrl() != null) m.setBannerUrl(r.bannerUrl().isBlank() ? null : r.bannerUrl());
        if (r.featured() != null) m.setFeatured(r.featured());
        if (r.sponsored() != null) m.setSponsored(r.sponsored());
        if (r.sponsorName() != null) m.setSponsorName(r.sponsorName().isBlank() ? null : r.sponsorName());
        if (r.sourceUrl() != null) m.setSourceUrl(r.sourceUrl().isBlank() ? null : r.sourceUrl());
        if (r.sourceNote() != null) m.setSourceNote(r.sourceNote().isBlank() ? null : r.sourceNote());
        if (r.pointsEnabled() != null) m.setPointsEnabled(r.pointsEnabled());
        if (r.basePoints() != null) m.setBasePoints(Math.max(0, Math.min(100, r.basePoints())));
        if (r.pointsMultiplier() != null) m.setPointsMultiplier(BigDecimal.valueOf(Math.max(0.5, Math.min(3.0, r.pointsMultiplier()))));
        if (r.bonusRules() != null) m.setBonusRulesJson(Json.write(r.bonusRules()));
        if (r.styleTags() != null) m.setStyleTags(Json.csv(r.styleTags()));
        if (r.occasionTags() != null) m.setOccasionTags(Json.csv(r.occasionTags()));
        if (r.colorTags() != null) m.setColorTags(Json.csv(r.colorTags()));
        if (r.interpretations() != null) m.setInterpretationsJson(Json.write(r.interpretations()));
        if (r.requiredItems() != null) m.setRequiredItemsJson(Json.write(r.requiredItems()));
        if (r.suggestedItems() != null) m.setSuggestedItemsJson(Json.write(r.suggestedItems()));
        if (r.rules() != null) m.setRulesJson(Json.write(r.rules()));
        if (r.settings() != null) m.setSettingsJson(Json.write(r.settings()));
        if (r.badgeCode() != null) m.setBadgeCode(r.badgeCode().isBlank() ? null : r.badgeCode().trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_"));
        if (m.getType() == MomentType.BRAND_EVENT) {
            m.setSponsored(true);
            if (m.getSponsorName() == null) {
                throw ApiException.badRequest("PATROCINADOR_OBRIGATORIO", Msg.t("moment.momento_de_marca_exige_patrocinador"));
            }
        }
        if ((m.getType() == MomentType.FASHION_EVENT || m.getType() == MomentType.EVENT) && m.getSourceUrl() == null && m.getSourceNote() == null) {
            throw ApiException.badRequest("FONTE_OBRIGATORIA", Msg.t("moment.evento_externo_exige_fonte"));
        }
        if (m.getNature().sensitive()) {
            m.setPointsEnabled(false);
        }
        moments.save(m);
        if (r.challenges() != null) {
            List<MomentChallenge> existing = challenges.findByMomentIdOrderBySortOrderAsc(m.getId());
            Map<String, MomentChallenge> byCode = existing.stream().collect(Collectors.toMap(MomentChallenge::getCode, c -> c, (a, b) -> a));
            Set<String> kept = new HashSet<>();
            int order = 0;
            for (AdminChallengeRequest c : r.challenges()) {
                String code = c.code() == null ? null : c.code().trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_");
                if (code == null || code.isBlank()) {
                    continue;
                }
                MomentChallenge mc = byCode.getOrDefault(code, new MomentChallenge());
                mc.setMomentId(m.getId());
                mc.setCode(code);
                mc.setName(c.name() == null ? code : c.name());
                mc.setNamesJson(c.names() == null ? null : Json.write(c.names()));
                mc.setDescription(c.description());
                mc.setKind(c.kind() == null ? br.com.fashionai.domain.model.enums.MomentChallengeKind.STYLE : br.com.fashionai.domain.model.enums.MomentChallengeKind.valueOf(c.kind().toUpperCase(Locale.ROOT)));
                mc.setPoints(c.points() == null ? 15 : Math.max(0, Math.min(100, c.points())));
                mc.setStyleTags(Json.csv(c.styleTags() == null ? List.of() : c.styleTags()));
                mc.setColorTags(Json.csv(c.colorTags() == null ? List.of() : c.colorTags()));
                mc.setOccasionTags(Json.csv(c.occasionTags() == null ? List.of() : c.occasionTags()));
                mc.setParamsJson(c.params() == null ? null : Json.write(c.params()));
                mc.setActive(c.active() == null || c.active());
                mc.setSortOrder(order++);
                challenges.save(mc);
                kept.add(code);
            }
            existing.stream().filter(c -> !kept.contains(c.getCode())).forEach(c -> {
                c.setActive(false);
                challenges.save(c);
            });
        }
        return adminDetail(admin, m.getId());
    }

    /** Transições: schedule (DRAFT→SCHEDULED/ACTIVE pelo relógio), feature, unfeature, cancel, archive, draft. */
    @Transactional
    public Map<String, Object> adminTransition(CurrentUser admin, UUID id, String action) {
        guard.requireAdmin(admin);
        Moment m = moments.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
        switch (action == null ? "" : action.toLowerCase(Locale.ROOT)) {
            case "schedule" -> {
                MomentStatus eff = MomentTime.effective(withStatus(m, MomentStatus.SCHEDULED), now());
                m.setStatus(eff == MomentStatus.ENDED ? MomentStatus.ENDED : eff);
                if (m.getStatus() == MomentStatus.ENDED && m.getMemoryJson() == null) {
                    end(m);
                }
            }
            case "feature" -> m.setFeatured(true);
            case "unfeature" -> m.setFeatured(false);
            case "cancel" -> m.setStatus(MomentStatus.CANCELLED);
            case "archive" -> m.setStatus(MomentStatus.ARCHIVED);
            case "draft" -> m.setStatus(MomentStatus.DRAFT);
            case "end" -> end(m);
            default -> throw ApiException.badRequest("ACAO_INVALIDA", Msg.t("moment.acao_invalida"));
        }
        moments.save(m);
        return adminDetail(admin, m.getId());
    }

    private static Moment withStatus(Moment m, MomentStatus s) {
        m.setStatus(s);
        return m;
    }

    /** Lista pública simples (descoberta): vivos e terminados recentes, no escopo da pessoa. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser viewer, String status, Integer year) {
        Instant now = now();
        String country = countryOf(viewer);
        List<MomentStatus> wanted = status == null ? VISIBLE : List.of(MomentStatus.valueOf(status.toUpperCase(Locale.ROOT)));
        List<Map<String, Object>> items = moments.findByStatusIn(wanted).stream().filter(m -> canSee(viewer, m)).filter(m -> inScope(m, country))
                .filter(m -> year == null || MomentTime.localStart(m).getYear() == year || MomentTime.localEnd(m).getYear() == year)
                .sorted(Comparator.comparing(Moment::getStartAt).reversed()).map(m -> MomentViews.card(m, now)).toList();
        return Map.of("now", now.toString(), "items", items);
    }

    /** Looks da pessoa disponíveis para enviar (os já enviados vêm marcados). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> candidateLooks(CurrentUser user, String idOrSlug) {
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

    static <T> Collection<T> nonNull(Collection<T> c) {
        return c == null ? List.of() : c;
    }

    static <K, V> Map<K, V> index(Collection<V> values, Function<V, K> key) {
        return values.stream().collect(Collectors.toMap(key, v -> v, (a, b) -> a));
    }
}
