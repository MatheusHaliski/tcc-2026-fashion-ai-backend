package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.CbcStory;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.moments.MomentTime;
import br.com.fashionai.application.moments.MomentViews;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeGroup;
import br.com.fashionai.domain.model.FlairChallengeSubmission;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
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
 * FLAIR-UT F5 · §14 — Desafios de Montagem (Card Building Challenges) dentro dos Momentos.
 *
 * <p>O desafio é um cenário com vagas; a pessoa monta com as próprias cartas FLAIR e o servidor confere requisitos,
 * sintonia e escreve a história ({@link CbcRules}, {@link CbcStory}). Entregar é atômico: valida de novo, bloqueia as
 * cartas como memória (D7), grava a entrega, lança os pontos pelo ledger idempotente e registra a participação no
 * Momento. Regras de O Império do Efêmero aplicadas aqui: E1–E2 (janela do Momento; encerrado vira Memória), S3
 * (pontos previstos antes de entregar), I1–I2 (comunidade só depois de se expressar; leituras raras), R1/P2/A1
 * (validações da administração).</p>
 */
@Service
public class FlairChallengeService {
    public static final int COMMUNITY_MAX = 12;
    public static final int PRIVATE_MAX_POINTS = 15;
    public static final int PRIVATE_MAX_PER_MOMENT = 3;
    public static final int REDISCOVERY_BONUS = 10;
    public static final double RARE_READING = 0.15;

    public static final String OPEN = "OPEN";
    public static final String UPCOMING = "UPCOMING";
    public static final String ENDED = "ENDED";
    static final String HIDDEN = "HIDDEN";

    private final FlairChallengeRepository challenges;
    private final FlairChallengeGroupRepository groups;
    private final FlairChallengeSubmissionRepository submissions;
    private final FlairCardInstanceRepository cards;
    private final WardrobeItemRepository pieces;
    private final MomentRepository moments;
    private final MomentService momentService;
    private final FaiPointsService points;
    private final UserAchievementRepository achievements;
    private final UserRepository users;
    private final FlairCollectionService collection;
    private final Guard guard;
    private Clock clock = Clock.systemUTC();

    public FlairChallengeService(FlairChallengeRepository challenges, FlairChallengeGroupRepository groups,
                                 FlairChallengeSubmissionRepository submissions, FlairCardInstanceRepository cards,
                                 WardrobeItemRepository pieces, MomentRepository moments, MomentService momentService,
                                 FaiPointsService points, UserAchievementRepository achievements, UserRepository users,
                                 FlairCollectionService collection, Guard guard) {
        this.challenges = challenges;
        this.groups = groups;
        this.submissions = submissions;
        this.cards = cards;
        this.pieces = pieces;
        this.moments = moments;
        this.momentService = momentService;
        this.points = points;
        this.achievements = achievements;
        this.users = users;
        this.collection = collection;
        this.guard = guard;
    }

    public void useClock(Clock clock) {
        this.clock = clock;
    }

    Instant now() {
        return Instant.now(clock);
    }

    LocalDate today() {
        return LocalDate.ofInstant(now(), FaiPointsService.ZONE);
    }

    // ================================================================== janela (E1–E3)
    public record Window(String status, Map<String, Object> time) {
    }

    /** Ligado a Momento: a janela é a do Momento. Sem Momento: a própria (nula = sempre). Arquivado = Memória. */
    Window window(FlairChallenge c, Moment m, Instant now) {
        if (c.getStatus() == FlairChallengeStatus.DRAFT) {
            return new Window(HIDDEN, Map.of());
        }
        if (m != null) {
            MomentStatus eff = MomentTime.effective(m, now);
            String st = switch (eff) {
                case ACTIVE -> OPEN;
                case SCHEDULED -> UPCOMING;
                case DRAFT, CANCELLED -> HIDDEN;
                default -> ENDED;
            };
            if (c.getStatus() == FlairChallengeStatus.ARCHIVED) {
                st = ENDED;
            }
            return new Window(st, MomentTime.view(m, now));
        }
        Instant s = c.getStartAt();
        Instant e = c.getEndAt();
        String st = c.getStatus() == FlairChallengeStatus.ARCHIVED ? ENDED
                : s != null && now.isBefore(s) ? UPCOMING : e != null && !now.isBefore(e) ? ENDED : OPEN;
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("status", st);
        t.put("now", now.toString());
        t.put("always", s == null && e == null);
        t.put("startAt", s == null ? null : s.toString());
        t.put("endAt", e == null ? null : e.toString());
        t.put("startsInSeconds", UPCOMING.equals(st) ? Math.max(0, s.getEpochSecond() - now.getEpochSecond()) : 0);
        t.put("endsInSeconds", OPEN.equals(st) && e != null ? Math.max(0, e.getEpochSecond() - now.getEpochSecond()) : 0);
        t.put("daysLeft", OPEN.equals(st) && e != null ? (int) Math.ceil((e.getEpochSecond() - now.getEpochSecond()) / 86400.0) : null);
        return new Window(st, t);
    }

    boolean visibleTo(CurrentUser viewer, FlairChallenge c, Moment m) {
        if (c.getStatus() == FlairChallengeStatus.DRAFT) {
            return viewer != null && viewer.admin();
        }
        return m == null || momentService.canSee(viewer, m);
    }

    FlairChallenge find(String idOrSlug) {
        Optional<FlairChallenge> c;
        try {
            c = challenges.findById(UUID.fromString(idOrSlug));
        } catch (IllegalArgumentException e) {
            c = challenges.findBySlug(idOrSlug.toLowerCase(Locale.ROOT));
        }
        return c.orElseThrow(() -> ApiException.notFound(Msg.t("cbc.desafio")));
    }

    Moment momentOf(FlairChallenge c) {
        return c.getMomentId() == null ? null : moments.findById(c.getMomentId()).orElse(null);
    }

    FlairChallenge visible(CurrentUser viewer, String idOrSlug) {
        FlairChallenge c = find(idOrSlug);
        Moment m = momentOf(c);
        if ((c.getMomentId() != null && m == null) || !visibleTo(viewer, c, m)) {
            throw ApiException.notFound(Msg.t("cbc.desafio"));
        }
        return c;
    }

    // ================================================================== lista
    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser viewer, String momentSlug) {
        Instant now = now();
        List<FlairChallenge> all;
        if (momentSlug != null && !momentSlug.isBlank()) {
            Moment m = moments.findBySlug(momentSlug.toLowerCase(Locale.ROOT)).filter(x -> momentService.canSee(viewer, x))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
            all = challenges.findByMomentIdOrderBySortOrderAsc(m.getId());
        } else {
            all = challenges.findAllByOrderBySortOrderAsc();
        }
        Map<UUID, Moment> ms = moments.findByIdIn(all.stream().map(FlairChallenge::getMomentId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Moment::getId, Function.identity()));
        Map<UUID, List<FlairChallengeSubmission>> mine = mineBy(viewer, all);
        List<Map<String, Object>> now0 = new ArrayList<>();
        List<Map<String, Object>> upcoming = new ArrayList<>();
        List<Map<String, Object>> always = new ArrayList<>();
        List<Map<String, Object>> memories = new ArrayList<>();
        for (FlairChallenge c : all) {
            Moment m = c.getMomentId() == null ? null : ms.get(c.getMomentId());
            if ((c.getMomentId() != null && m == null) || !visibleTo(viewer, c, m)) {
                continue;
            }
            Window w = window(c, m, now);
            if (HIDDEN.equals(w.status())) {
                continue;
            }
            Map<String, Object> v = summary(c, m, w, viewer, mine.getOrDefault(c.getId(), List.of()));
            switch (w.status()) {
                case UPCOMING -> upcoming.add(v);
                case ENDED -> memories.add(v);
                default -> (m == null && c.getStartAt() == null && c.getEndAt() == null ? always : now0).add(v);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("now", now0);
        out.put("upcoming", upcoming);
        out.put("always", always);
        out.put("memories", memories);
        out.put("groups", momentSlug == null ? groupViews(viewer, all) : List.of());
        out.put("season", FlairService.season());
        return out;
    }

    Map<UUID, List<FlairChallengeSubmission>> mineBy(CurrentUser viewer, Collection<FlairChallenge> list) {
        if (viewer == null || list.isEmpty()) {
            return Map.of();
        }
        return submissions.findByUserIdAndChallengeIdIn(viewer.id(), list.stream().map(FlairChallenge::getId).toList()).stream()
                .collect(Collectors.groupingBy(FlairChallengeSubmission::getChallengeId));
    }

    List<Map<String, Object>> groupViews(CurrentUser viewer, List<FlairChallenge> all) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (FlairChallengeGroup g : groups.findAllByOrderBySortOrderAsc()) {
            out.add(groupView(viewer, g, all.stream().filter(c -> g.getCode().equals(c.getGroupCode()) && c.getStatus() != FlairChallengeStatus.DRAFT).toList()));
        }
        return out;
    }

    Map<String, Object> groupView(CurrentUser viewer, FlairChallengeGroup g, List<FlairChallenge> members) {
        Set<UUID> done = viewer == null ? Set.of() : mineBy(viewer, members).keySet();
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("code", g.getCode());
        v.put("name", MomentViews.localized(g.getName(), g.getNamesJson()));
        v.put("description", MomentViews.localized(g.getDescription(), g.getDescriptionsJson()));
        v.put("points", g.getPoints());
        v.put("badgeCode", g.getBadgeCode());
        v.put("challenges", members.stream().map(c -> Map.of("id", c.getId(), "slug", c.getSlug(),
                "name", MomentViews.localized(c.getName(), c.getNamesJson()), "done", done.contains(c.getId()))).toList());
        v.put("done", (int) members.stream().filter(c -> done.contains(c.getId())).count());
        v.put("total", members.size());
        v.put("completed", viewer != null && g.getBadgeCode() != null && achievements.existsByUserIdAndAchievementCode(viewer.id(), g.getBadgeCode()));
        return v;
    }

    Map<String, Object> summary(FlairChallenge c, Moment m, Window w, CurrentUser viewer, List<FlairChallengeSubmission> mine) {
        List<Map<String, Object>> reqs = Json.list(c.getRequirementsJson());
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", c.getId());
        v.put("slug", c.getSlug());
        v.put("name", MomentViews.localized(c.getName(), c.getNamesJson()));
        v.put("description", MomentViews.localized(c.getDescription(), c.getDescriptionsJson()));
        v.put("scenario", c.getScenario());
        v.put("difficulty", c.getDifficulty().name());
        v.put("status", w.status());
        v.put("time", w.time());
        v.put("slotsCount", Json.list(c.getSlotsJson()).size());
        v.put("points", c.getPoints());
        v.put("multiplier", multiplier(m, w));
        v.put("pointsPreview", basePoints(c, m, w));
        v.put("requirements", reqs);
        v.put("levelOpen", CbcRules.levelOpen(reqs));
        v.put("groupCode", c.getGroupCode());
        v.put("locksCards", c.isLocksCards());
        v.put("repeatLimit", c.getRepeatLimit());
        v.put("official", c.isOfficial());
        v.put("moment", m == null ? null : momentView(m));
        if (viewer != null) {
            Map<String, Object> me = new LinkedHashMap<>();
            me.put("submissions", mine.size());
            me.put("attemptsLeft", Math.max(0, c.getRepeatLimit() - mine.size()));
            me.put("done", !mine.isEmpty());
            v.put("mine", me);
        } else {
            v.put("mine", null);
        }
        return v;
    }

    static Map<String, Object> momentView(Moment m) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", m.getId());
        v.put("slug", m.getSlug());
        v.put("name", MomentViews.localized(m.getName(), m.getNamesJson()));
        v.put("type", m.getType().name());
        v.put("nature", m.getNature().name());
        v.put("theme", MomentViews.theme(m));
        v.put("groupId", m.getGroupId());
        return v;
    }

    // ================================================================== detalhe
    @Transactional(readOnly = true)
    public Map<String, Object> detail(CurrentUser viewer, String idOrSlug) {
        FlairChallenge c = visible(viewer, idOrSlug);
        Moment m = momentOf(c);
        Window w = window(c, m, now());
        List<FlairChallengeSubmission> mine = viewer == null ? List.of() : submissions.findByChallengeIdAndUserIdOrderByAttemptDesc(c.getId(), viewer.id());
        Map<String, Object> out = summary(c, m, w, viewer, mine);
        out.put("slots", Json.list(c.getSlotsJson()).stream().map(s -> {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("key", s.get("key"));
            v.put("position", position(s.get("position")));
            v.put("label", s.get("label") instanceof Map<?, ?> l ? MomentViews.label(l) : null);
            // restrição opcional da vaga do mosaico (só cartas que combinam com aquele fragmento da imagem)
            v.put("accepts", accepts(s));
            return v;
        }).toList());
        out.put("themeTags", Json.csv(c.getThemeTags()));
        out.put("interpretations", m == null ? List.of() : MomentViews.interpretations(m));
        out.put("suggestedInterpretation", null);
        if (viewer != null && m != null) {
            List<CbcRules.Card> available = models(cards.findByOwnerIdOrderByCreatedAtDesc(viewer.id()).stream()
                    .filter(x -> "AVAILABLE".equals(x.getState())).toList()).values().stream().toList();
            out.put("suggestedInterpretation", CbcRules.suggestInterpretation(available, interpretations(m)));
        }
        out.put("mySubmissions", mine.stream().map(s -> submissionView(s, null, null, false)).toList());
        boolean delivered = !mine.isEmpty();
        boolean open = delivered || ENDED.equals(w.status());
        out.put("communityOpen", open);
        out.put("community", open ? community(viewer, c, m) : List.of());
        out.put("memory", memory(c, m, open));
        if (c.getGroupCode() != null) {
            groups.findByCode(c.getGroupCode()).ifPresent(g -> out.put("group", groupView(viewer, g,
                    challenges.findByGroupCode(g.getCode()).stream().filter(x -> x.getStatus() != FlairChallengeStatus.DRAFT)
                            .sorted(Comparator.comparingInt(FlairChallenge::getSortOrder)).toList())));
        }
        return out;
    }

    /** I1: montagens de outras pessoas, depois de a pessoa se expressar (ou do fim); cartas de peças privadas ficam ocultas. */
    List<Map<String, Object>> community(CurrentUser viewer, FlairChallenge c, Moment m) {
        boolean group = m != null && m.getGroupId() != null;
        List<FlairChallengeSubmission> others = submissions.findByChallengeIdOrderByCreatedAtDesc(c.getId()).stream()
                .filter(s -> viewer == null || !s.getUserId().equals(viewer.id())).limit(COMMUNITY_MAX).toList();
        Set<UUID> cardIds = new HashSet<>();
        others.forEach(s -> Json.list(s.getCardsJson()).forEach(x -> {
            UUID id = uuid(x.get("cardId"));
            if (id != null) {
                cardIds.add(id);
            }
        }));
        Map<UUID, FlairCardInstance> live = cards.findAllById(cardIds).stream().collect(Collectors.toMap(FlairCardInstance::getId, Function.identity()));
        Map<UUID, Boolean> canSee = new HashMap<>();
        Map<UUID, User> people = users.findAllById(others.stream().map(FlairChallengeSubmission::getUserId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        List<Map<String, Object>> out = new ArrayList<>();
        for (FlairChallengeSubmission s : others) {
            User u = people.get(s.getUserId());
            Map<String, Object> who = u != null && (group || u.getProfileVisibility() == Visibility.PUBLIC)
                    ? Map.of("id", u.getId(), "username", u.getUsername()) : null;
            Map<UUID, Boolean> vis = canSee;
            out.add(submissionView(s, who, id -> vis.computeIfAbsent(id, k -> live.get(k) != null && collection.visible(viewer, live.get(k))), true));
        }
        return out;
    }

    /** Memória do desafio (E2, D2, I2): números sempre; a variedade de leituras só depois de a pessoa se expressar. */
    Map<String, Object> memory(FlairChallenge c, Moment m, boolean readings) {
        List<FlairChallengeSubmission> all = submissions.findByChallengeIdOrderByCreatedAtDesc(c.getId());
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("builds", all.size());
        v.put("people", (int) all.stream().map(FlairChallengeSubmission::getUserId).distinct().count());
        v.put("averageSintonia", all.isEmpty() ? null : (int) Math.round(100 * all.stream()
                .mapToDouble(s -> s.getSintoniaMax() == 0 ? 0 : s.getSintonia() / (double) s.getSintoniaMax()).average().orElse(0)));
        if (readings && !all.isEmpty()) {
            Map<String, String> labels = new HashMap<>();
            if (m != null) {
                MomentViews.interpretations(m).forEach(i -> labels.put(String.valueOf(i.get("key")), (String) i.get("label")));
            }
            Map<String, Long> counts = all.stream().collect(Collectors.groupingBy(s -> s.getInterpretation() == null ? CbcRules.OWN : s.getInterpretation(),
                    LinkedHashMap::new, Collectors.counting()));
            List<Map<String, Object>> list = new ArrayList<>();
            counts.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).forEach(e -> {
                double pct = e.getValue() / (double) all.size();
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("key", e.getKey());
                r.put("label", labels.get(e.getKey()));
                r.put("count", e.getValue());
                r.put("pct", (int) Math.round(pct * 100));
                r.put("rare", pct < RARE_READING);
                list.add(r);
            });
            v.put("readings", list);
        } else {
            v.put("readings", null);
        }
        v.put("season", m != null && m.getSeason() != null ? m.getSeason().name() : null);
        return v;
    }

    Map<String, Object> submissionView(FlairChallengeSubmission s, Map<String, Object> who, Function<UUID, Boolean> cardVisible, boolean community) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", s.getId());
        v.put("attempt", s.getAttempt());
        v.put("createdAt", s.getCreatedAt());
        v.put("interpretation", s.getInterpretation());
        v.put("sintonia", s.getSintonia());
        v.put("sintoniaMax", s.getSintoniaMax());
        v.put("points", community ? null : s.getPoints());
        v.put("story", Json.list(s.getStoryJson()));
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> x : Json.list(s.getCardsJson())) {
            UUID id = uuid(x.get("cardId"));
            if (cardVisible != null && (id == null || !cardVisible.apply(id))) {
                // carta de peça privada (ou removida): só o nível e a posição, sem foto nem nome
                Map<String, Object> hidden = new LinkedHashMap<>();
                hidden.put("slot", x.get("slot"));
                hidden.put("tier", x.get("tier"));
                hidden.put("position", x.get("position"));
                hidden.put("hidden", true);
                list.add(hidden);
            } else {
                list.add(x);
            }
        }
        v.put("cards", list);
        if (community) {
            v.put("user", who);
            // a história cita nome e marca das cartas: com carta oculta, a linha dela sai sem os dados
            Set<String> hiddenSlots = list.stream().filter(x -> Boolean.TRUE.equals(x.get("hidden"))).map(x -> String.valueOf(x.get("slot"))).collect(Collectors.toSet());
            if (!hiddenSlots.isEmpty()) {
                v.put("story", Json.list(s.getStoryJson()).stream().map(l -> hiddenSlots.contains(String.valueOf(l.get("slot")))
                        ? Map.<String, Object>of("key", "cbc.story.hidden_card", "vars", Map.of(), "slot", l.get("slot")) : l).toList());
            }
        }
        return v;
    }

    // ================================================================== conferir e entregar
    public record BuildRequest(Map<String, UUID> slots, String interpretation) {
    }

    record Build(FlairChallenge challenge, Moment moment, Window window, List<CbcRules.Slot> slots, List<CbcStory.SlotText> texts,
                 Map<String, FlairCardInstance> placed, CbcRules.Evaluation evaluation, List<Map<String, Object>> story, String interpretation) {
    }

    @Transactional(readOnly = true)
    public Map<String, Object> check(CurrentUser user, String idOrSlug, BuildRequest req) {
        FlairChallenge c = visible(user, idOrSlug);
        Build b = build(user, c, req);
        int attempts = submissions.findByChallengeIdAndUserIdOrderByAttemptDesc(c.getId(), user.id()).size();
        Map<String, Object> out = evaluationView(b);
        List<Line> lines = pointsLines(b, attempts + 1);
        out.put("points", Map.of("lines", lines.stream().map(Line::toMap).toList(), "total", lines.stream().mapToInt(Line::points).sum()));
        out.put("attemptsLeft", Math.max(0, c.getRepeatLimit() - attempts));
        out.put("canSubmit", b.evaluation().ok() && OPEN.equals(b.window().status()) && attempts < c.getRepeatLimit());
        return out;
    }

    @Transactional
    public Map<String, Object> submit(CurrentUser user, String idOrSlug, BuildRequest req) {
        guard.requireCanCreate(user);
        FlairChallenge c = visible(user, idOrSlug);
        Moment m = momentOf(c);
        Window w = window(c, m, now());
        if (UPCOMING.equals(w.status())) {
            throw ApiException.conflict("DESAFIO_EM_BREVE", Msg.t("cbc.ainda_nao_abriu"));
        }
        if (!OPEN.equals(w.status())) {
            throw ApiException.conflict("DESAFIO_ENCERRADO", Msg.t("cbc.desafio_encerrado"));
        }
        List<FlairChallengeSubmission> prior = submissions.findByChallengeIdAndUserIdOrderByAttemptDesc(c.getId(), user.id());
        if (prior.size() >= c.getRepeatLimit()) {
            throw ApiException.conflict("LIMITE_DE_ENTREGAS", Msg.t("cbc.limite_de_entregas"));
        }
        Build b = build(user, c, req);
        if (!b.evaluation().ok()) {
            throw new ApiException(409, "MONTAGEM_INCOMPLETA", Msg.t("cbc.montagem_incompleta"), Map.of("evaluation", evaluationView(b)));
        }
        Instant now = now();
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
        s.setCardsJson(Json.write(snapshot(b)));
        s.setStoryJson(Json.write(b.story()));
        submissions.save(s);

        List<Map<String, Object>> granted = new ArrayList<>();
        int total = 0;
        for (Line l : pointsLines(b, attempt)) {
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
        s.setPoints(total);
        s.setBonusJson(Json.write(granted));
        submissions.save(s);

        Map<String, Object> out = evaluationView(b);
        out.put("submission", submissionView(s, null, null, false));
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
        Set<UUID> done = new HashSet<>(mineBy(user, members).keySet());
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
            if (g.getBadgeCode() != null && !achievements.existsByUserIdAndAchievementCode(user.id(), g.getBadgeCode())) {
                UserAchievement ach = new UserAchievement();
                ach.setUserId(user.id());
                ach.setAchievementCode(g.getBadgeCode());
                ach.setSecret(false);
                ach.setGrantedAt(now());
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

    Build build(CurrentUser user, FlairChallenge c, BuildRequest req) {
        Moment m = momentOf(c);
        Window w = window(c, m, now());
        List<Map<String, Object>> rawSlots = Json.list(c.getSlotsJson());
        List<CbcRules.Slot> slots = rawSlots.stream().map(s -> new CbcRules.Slot(String.valueOf(s.get("key")), position(s.get("position")), accepts(s))).toList();
        @SuppressWarnings("unchecked")
        List<CbcStory.SlotText> texts = rawSlots.stream().map(s -> new CbcStory.SlotText(String.valueOf(s.get("key")),
                s.get("story") instanceof Map<?, ?> st ? (Map<String, Object>) st : null)).toList();
        Set<String> keys = slots.stream().map(CbcRules.Slot::key).collect(Collectors.toSet());
        Map<String, UUID> asked = req == null || req.slots() == null ? Map.of() : req.slots();
        Map<String, FlairCardInstance> placed = new LinkedHashMap<>();
        Set<UUID> used = new HashSet<>();
        for (Map.Entry<String, UUID> e : asked.entrySet()) {
            if (e.getValue() == null) {
                continue;
            }
            if (!keys.contains(e.getKey())) {
                throw ApiException.badRequest("VAGA_DESCONHECIDA", Msg.t("cbc.vaga_desconhecida"), Map.of("slot", e.getKey()));
            }
            if (!used.add(e.getValue())) {
                throw ApiException.badRequest("CARTA_REPETIDA", Msg.t("cbc.carta_repetida"), Map.of("cardId", e.getValue()));
            }
            FlairCardInstance card = cards.findById(e.getValue()).filter(x -> x.getOwnerId().equals(user.id()))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("cbc.carta")));
            if (!"AVAILABLE".equals(card.getState())) {
                throw ApiException.conflict("CARTA_ENTREGUE", Msg.t("cbc.carta_ja_entregue"));
            }
            placed.put(e.getKey(), card);
        }
        String interpretation = interpretationOf(req == null ? null : req.interpretation(), m);
        Map<UUID, CbcRules.Card> models = models(placed.values());
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        placed.forEach((k, v) -> board.put(k, models.get(v.getId())));
        CbcRules.Context ctx = context(c, m, interpretation);
        CbcRules.Evaluation ev = CbcRules.evaluate(slots, board, Json.list(c.getRequirementsJson()), ctx);
        Map<String, CbcStory.CardText> textCards = new LinkedHashMap<>();
        placed.forEach((k, v) -> textCards.put(k, new CbcStory.CardText(v.getName(), v.getBrandName(),
                models.get(v.getId()).colors().stream().findFirst().orElse(null))));
        List<Map<String, Object>> story = CbcStory.write(c.getScenario(), texts, textCards, ev, interpretation);
        return new Build(c, m, w, slots, texts, placed, ev, story, interpretation);
    }

    /** "Minha leitura" quando nada (ou uma leitura que o Momento não tem) é pedido: nunca um erro (P3). */
    static String interpretationOf(String asked, Moment m) {
        if (asked == null || asked.isBlank() || m == null) {
            return CbcRules.OWN;
        }
        boolean known = Json.list(m.getInterpretationsJson()).stream().anyMatch(i -> asked.equals(String.valueOf(i.get("key"))));
        return known ? asked : CbcRules.OWN;
    }

    CbcRules.Context context(FlairChallenge c, Moment m, String chosen) {
        List<String> theme = Json.csv(c.getThemeTags());
        List<String> styles = new ArrayList<>(theme);
        List<String> colors = new ArrayList<>(theme);
        List<String> occasions = new ArrayList<>();
        if (m != null) {
            styles.addAll(Json.csv(m.getStyleTags()));
            colors.addAll(Json.csv(m.getColorTags()));
            occasions.addAll(Json.csv(m.getOccasionTags()));
        }
        Instant start = m != null ? m.getStartAt() : c.getStartAt();
        return new CbcRules.Context(m == null ? List.of() : interpretations(m), Set.copyOf(styles), Set.copyOf(colors), Set.copyOf(occasions),
                chosen, start, today());
    }

    @SuppressWarnings("unchecked")
    static List<CbcRules.Interpretation> interpretations(Moment m) {
        List<CbcRules.Interpretation> out = new ArrayList<>();
        for (Map<String, Object> i : Json.list(m.getInterpretationsJson())) {
            out.add(new CbcRules.Interpretation(String.valueOf(i.get("key")), Set.copyOf(strings(i.get("styleTags"))), Set.copyOf(strings(i.get("colorTags")))));
        }
        return out;
    }

    /** Cartas no formato do motor: tags do retrato da geração ou, em cartas antigas, da peça; datas da peça viva. */
    Map<UUID, CbcRules.Card> models(Collection<FlairCardInstance> list) {
        Set<UUID> pieceIds = list.stream().filter(c -> "PIECE".equals(c.getOriginType())).map(FlairCardInstance::getOriginId).collect(Collectors.toSet());
        Map<UUID, WardrobeItem> byId = pieces.findAllById(pieceIds).stream().collect(Collectors.toMap(WardrobeItem::getId, Function.identity()));
        Map<UUID, CbcRules.Card> out = new LinkedHashMap<>();
        for (FlairCardInstance c : list) {
            WardrobeItem w = "PIECE".equals(c.getOriginType()) ? byId.get(c.getOriginId()) : null;
            Map<String, Object> tags = c.getTagsJson() != null ? Json.map(c.getTagsJson()) : FlairCollectionService.tagsOf(w);
            Map<String, Double> hype = new HashMap<>();
            if (c.getHypeJson() != null) {
                Json.map(c.getHypeJson()).forEach((k, v) -> {
                    if (v instanceof Number n) {
                        hype.put(k, n.doubleValue());
                    }
                });
            }
            Instant added = null;
            LocalDate lastWorn = null;
            if (w != null) {
                added = w.getCreatedAt();
                if (w.getPurchaseDate() != null) {
                    // comprada antes de entrar no app: vale a data da compra (C2 olha a compra, não o cadastro)
                    Instant bought = w.getPurchaseDate().atStartOfDay(ZoneOffset.UTC).toInstant();
                    added = added == null || bought.isBefore(added) ? bought : added;
                }
                lastWorn = w.getLastWornDate();
            }
            out.put(c.getId(), new CbcRules.Card(c.getId(), c.getPosition(), c.getTier(), c.getOvr(), c.getBrandName(), c.getOriginType(),
                    Set.copyOf(strings(tags.get("styles"))), Set.copyOf(strings(tags.get("colors"))), Set.copyOf(strings(tags.get("occasions"))),
                    Set.copyOf(strings(tags.get("materials"))), hype, added, lastWorn, c.getCategory(), c.getSubcategory()));
        }
        return out;
    }

    List<Map<String, Object>> snapshot(Build b) {
        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, CbcRules.SlotResult> res = b.evaluation().slots().stream().collect(Collectors.toMap(CbcRules.SlotResult::slot, Function.identity()));
        for (CbcRules.Slot s : b.slots()) {
            FlairCardInstance c = b.placed().get(s.key());
            if (c == null) {
                continue;
            }
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("slot", s.key());
            v.put("cardId", c.getId());
            v.put("name", c.getName());
            v.put("brandName", c.getBrandName());
            v.put("tier", c.getTier());
            v.put("ovr", c.getOvr());
            v.put("rare", c.isRare());
            v.put("position", c.getPosition());
            v.put("imageUrl", c.getImageUrl());
            v.put("sintonia", res.get(s.key()) == null ? 0 : res.get(s.key()).sintonia());
            out.add(v);
        }
        return out;
    }

    Map<String, Object> evaluationView(Build b) {
        CbcRules.Evaluation ev = b.evaluation();
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("slots", ev.slots().stream().map(CbcRules.SlotResult::toMap).toList());
        e.put("requirements", ev.requirements().stream().map(CbcRules.RequirementResult::toMap).toList());
        e.put("sintonia", ev.sintonia());
        e.put("sintoniaMax", ev.sintoniaMax());
        e.put("filled", ev.filled());
        e.put("complete", ev.complete());
        e.put("ok", ev.ok());
        e.put("rediscovered", ev.rediscovered());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", b.window().status());
        out.put("interpretation", b.interpretation());
        out.put("evaluation", e);
        out.put("story", b.story());
        return out;
    }

    // ================================================================== pontos (S3, C1, C3)
    public record Line(String action, int points, String ref, String label) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("action", action);
            m.put("points", points);
            m.put("ref", ref);
            m.put("label", label);
            return m;
        }
    }

    static double multiplier(Moment m, Window w) {
        if (m == null || !OPEN.equals(w.status()) && !UPCOMING.equals(w.status()) || !m.isPointsEnabled() || m.getNature().sensitive()) {
            return 1.0;
        }
        return m.getPointsMultiplier() == null ? 1.0 : m.getPointsMultiplier().doubleValue();
    }

    static int basePoints(FlairChallenge c, Moment m, Window w) {
        return BigDecimal.valueOf(c.getPoints()).multiply(BigDecimal.valueOf(multiplier(m, w))).setScale(0, RoundingMode.HALF_UP).intValue();
    }

    /** Linhas determinísticas: valor do desafio × multiplicador do Momento; +10 de redescoberta. Nada premia compra (C1). */
    List<Line> pointsLines(Build b, int attempt) {
        List<Line> out = new ArrayList<>();
        FlairChallenge c = b.challenge();
        int base = basePoints(c, b.moment(), b.window());
        String ref = c.getRepeatLimit() > 1 ? c.getId() + ":" + attempt : c.getId().toString();
        if (base > 0 && b.evaluation().ok()) {
            out.add(new Line("FLAIR_CBC", base, ref, "challenge"));
        }
        if (b.evaluation().ok() && !b.evaluation().rediscovered().isEmpty()) {
            out.add(new Line("FLAIR_CBC_REDISCOVERY", REDISCOVERY_BONUS, c.getId().toString(), "rediscovery"));
        }
        return out;
    }

    // ================================================================== Momento privado de grupo
    public record PrivateChallengeRequest(String template) {
    }

    /** O dono de um Momento privado de grupo adiciona um desafio a partir de um modelo oficial (até 3; vale até 15 pontos). */
    @Transactional
    public Map<String, Object> addToPrivateMoment(CurrentUser user, UUID momentId, PrivateChallengeRequest req) {
        guard.requireCanCreate(user);
        Moment m = moments.findById(momentId).filter(x -> momentService.canSee(user, x)).orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
        if (m.getGroupId() == null || !(user.id().equals(m.getCreatedByUserId()) || user.admin())) {
            throw guard.deny(user, "moment:" + m.getSlug(), Msg.t("cbc.so_quem_criou_o_momento"));
        }
        MomentStatus eff = MomentTime.effective(m, now());
        if (eff != MomentStatus.ACTIVE && eff != MomentStatus.SCHEDULED) {
            throw ApiException.conflict("MOMENTO_ENCERRADO", Msg.t("moment.este_momento_ja_terminou"));
        }
        if (challenges.findByMomentIdOrderBySortOrderAsc(m.getId()).size() >= PRIVATE_MAX_PER_MOMENT) {
            throw ApiException.conflict("LIMITE_DE_DESAFIOS", Msg.t("cbc.limite_de_desafios_no_momento", PRIVATE_MAX_PER_MOMENT));
        }
        FlairChallenge t = challenges.findBySlug(req == null || req.template() == null ? "" : req.template().toLowerCase(Locale.ROOT))
                .filter(x -> x.isOfficial() && x.getStatus() == FlairChallengeStatus.ACTIVE && x.getMomentId() == null)
                .orElseThrow(() -> ApiException.notFound(Msg.t("cbc.modelo")));
        FlairChallenge c = new FlairChallenge();
        c.setSlug(uniqueSlug(t.getSlug() + "-" + m.getSlug()));
        c.setName(t.getName());
        c.setNamesJson(t.getNamesJson());
        c.setDescription(t.getDescription());
        c.setDescriptionsJson(t.getDescriptionsJson());
        c.setScenario(t.getScenario());
        c.setDifficulty(t.getDifficulty());
        c.setStatus(FlairChallengeStatus.ACTIVE);
        c.setMomentId(m.getId());
        c.setSlotsJson(t.getSlotsJson());
        // sem "tema" quando o Momento privado não tem leituras: o requisito de tema exige ≥ 2 interpretações (P2)
        List<Map<String, Object>> reqs = Json.list(t.getRequirementsJson()).stream()
                .filter(r -> !"theme".equals(r.get("type")) || interpretations(m).size() >= 2).toList();
        c.setRequirementsJson(Json.write(reqs));
        c.setThemeTags(t.getThemeTags());
        c.setPoints(Math.min(PRIVATE_MAX_POINTS, t.getPoints()));
        c.setRepeatLimit(1);
        c.setLocksCards(false);   // entre amigos as cartas não são consumidas
        c.setOfficial(false);
        c.setCreatedByUserId(user.id());
        c.setSortOrder(1000 + challenges.findByMomentIdOrderBySortOrderAsc(m.getId()).size());
        challenges.save(c);
        return summary(c, m, window(c, m, now()), user, List.of());
    }

    String uniqueSlug(String base) {
        String slug = base.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]+", "-").replaceAll("-+", "-");
        slug = slug.length() > 72 ? slug.substring(0, 72) : slug;
        String candidate = slug;
        for (int i = 2; challenges.findBySlug(candidate).isPresent(); i++) {
            candidate = slug + "-" + i;
        }
        return candidate;
    }

    // ================================================================== administração (sem deploy)
    public record AdminChallengeRequest(String slug, String name, Map<String, String> names, String description, Map<String, String> descriptions,
                                        String scenario, String difficulty, String status, String moment, String startAt, String endAt,
                                        List<Map<String, Object>> slots, List<Map<String, Object>> requirements, List<String> themeTags,
                                        Integer points, Integer repeatLimit, String groupCode, Boolean locksCards, Integer sortOrder) {
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminList(CurrentUser admin) {
        guard.requireAdmin(admin);
        Instant now = now();
        List<FlairChallenge> all = challenges.findAllByOrderBySortOrderAsc();
        Map<UUID, Moment> ms = moments.findByIdIn(all.stream().map(FlairChallenge::getMomentId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Moment::getId, Function.identity()));
        List<Map<String, Object>> out = new ArrayList<>();
        for (FlairChallenge c : all) {
            Moment m = c.getMomentId() == null ? null : ms.get(c.getMomentId());
            Map<String, Object> v = summary(c, m, window(c, m, now), null, List.of());
            v.put("adminStatus", c.getStatus().name());
            v.put("slots", Json.list(c.getSlotsJson()));
            v.put("themeTags", Json.csv(c.getThemeTags()));
            v.put("startAt", c.getStartAt());
            v.put("endAt", c.getEndAt());
            v.put("sortOrder", c.getSortOrder());
            v.put("names", Json.map(c.getNamesJson()));
            v.put("descriptions", Json.map(c.getDescriptionsJson()));
            out.add(v);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> adminSave(CurrentUser admin, UUID id, AdminChallengeRequest r) {
        guard.requireAdmin(admin);
        FlairChallenge c = id == null ? new FlairChallenge() : challenges.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("cbc.desafio")));
        List<String> errors = new ArrayList<>();
        String slug = r.slug() == null ? null : r.slug().trim().toLowerCase(Locale.ROOT);
        if (slug == null || !slug.matches("[a-z0-9-]{3,80}")) {
            errors.add("slug");
        } else if (challenges.findBySlug(slug).filter(x -> !x.getId().equals(c.getId())).isPresent()) {
            errors.add("slug.taken");
        }
        if (r.name() == null || r.name().isBlank() || r.name().length() > 120) {
            errors.add("name");
        }
        if (r.scenario() == null || !r.scenario().matches("[a-z0-9-]{2,40}")) {
            errors.add("scenario");
        }
        List<CbcRules.Slot> slots = r.slots() == null ? List.of() : r.slots().stream()
                .map(s -> new CbcRules.Slot(s.get("key") == null ? null : String.valueOf(s.get("key")), position(s.get("position")), accepts(s))).toList();
        List<Map<String, Object>> reqs = r.requirements() == null ? List.of() : r.requirements();
        errors.addAll(CbcRules.validate(slots, reqs));
        if (CbcStory.FREE.equals(r.scenario()) && r.slots() != null && r.slots().stream().anyMatch(s -> !(s.get("label") instanceof Map<?, ?>) || !(s.get("story") instanceof Map<?, ?>))) {
            errors.add("slots.free_texts");   // cenário livre: cada vaga traz rótulo e modelo de história por idioma
        }
        int pts = r.points() == null ? 0 : r.points();
        if (pts < 0 || pts > 200) {
            errors.add("points");
        }
        int repeat = r.repeatLimit() == null ? 1 : r.repeatLimit();
        if (repeat < 1 || repeat > 10) {
            errors.add("repeatLimit");
        }
        Moment m = null;
        if (r.moment() != null && !r.moment().isBlank()) {
            m = moments.findBySlug(r.moment().toLowerCase(Locale.ROOT)).or(() -> {
                try {
                    return moments.findById(UUID.fromString(r.moment()));
                } catch (IllegalArgumentException e) {
                    return Optional.empty();
                }
            }).orElse(null);
            if (m == null) {
                errors.add("moment");
            }
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("DESAFIO_INVALIDO", Msg.t("cbc.admin.invalido"), Map.of("errors", errors));
        }
        FlairChallengeStatus status = r.status() == null ? FlairChallengeStatus.ACTIVE : enumOf(FlairChallengeStatus.class, r.status(), "status");
        if (m != null) {
            // R1: rito religioso nunca vira jogo
            if (m.getNature() == MomentNature.RELIGIOUS) {
                throw ApiException.badRequest("DESAFIO_EM_MOMENTO_RELIGIOSO", Msg.t("cbc.admin.religioso"));
            }
            // P2: tema exige pelo menos duas leituras possíveis
            if (CbcRules.hasTheme(reqs) && interpretations(m).size() < 2) {
                throw ApiException.badRequest("TEMA_SEM_LEITURAS", Msg.t("cbc.admin.tema_sem_leituras"));
            }
            // A1: o Momento precisa de pelo menos um desafio aberto a qualquer nível
            UUID self = c.getId();
            boolean otherOpen = challenges.findByMomentIdOrderBySortOrderAsc(m.getId()).stream()
                    .anyMatch(x -> !x.getId().equals(self) && x.getStatus() == FlairChallengeStatus.ACTIVE && CbcRules.levelOpen(Json.list(x.getRequirementsJson())));
            if (status == FlairChallengeStatus.ACTIVE && !CbcRules.levelOpen(reqs) && !otherOpen) {
                throw ApiException.badRequest("MOMENTO_SEM_DESAFIO_ABERTO", Msg.t("cbc.admin.sem_desafio_aberto"));
            }
        } else if (CbcRules.hasTheme(reqs) && (r.themeTags() == null || r.themeTags().isEmpty())) {
            throw ApiException.badRequest("TEMA_SEM_LEITURAS", Msg.t("cbc.admin.tema_sem_leituras"));
        }
        c.setSlug(slug);
        c.setName(r.name().trim());
        c.setNamesJson(r.names() == null || r.names().isEmpty() ? null : Json.write(r.names()));
        c.setDescription(r.description());
        c.setDescriptionsJson(r.descriptions() == null || r.descriptions().isEmpty() ? null : Json.write(r.descriptions()));
        c.setScenario(r.scenario());
        c.setDifficulty(r.difficulty() == null ? FlairChallengeDifficulty.EASY : enumOf(FlairChallengeDifficulty.class, r.difficulty(), "difficulty"));
        c.setStatus(status);
        c.setMomentId(m == null ? null : m.getId());
        c.setStartAt(m == null ? instant(r.startAt(), "startAt") : null);
        c.setEndAt(m == null ? instant(r.endAt(), "endAt") : null);
        c.setSlotsJson(Json.write(r.slots()));
        c.setRequirementsJson(Json.write(reqs));
        c.setThemeTags(r.themeTags() == null ? null : Json.csv(r.themeTags()));
        c.setPoints(pts);
        c.setRepeatLimit(repeat);
        c.setGroupCode(r.groupCode() == null || r.groupCode().isBlank() ? null : r.groupCode());
        c.setLocksCards(r.locksCards() == null || r.locksCards());
        c.setOfficial(true);
        c.setSortOrder(r.sortOrder() == null ? c.getSortOrder() : r.sortOrder());
        if (c.getCreatedByUserId() == null) {
            c.setCreatedByUserId(admin.id());
        }
        challenges.save(c);
        return summary(c, m, window(c, m, now()), null, List.of());
    }

    // ================================================================== apoio
    @SuppressWarnings("unchecked")
    static Map<String, Object> accepts(Map<String, Object> slot) {
        return slot.get("accepts") instanceof Map<?, ?> a ? (Map<String, Object>) a : Map.of();
    }

    static String position(Object v) {
        return v == null ? CbcRules.ANY : String.valueOf(v).toUpperCase(Locale.ROOT);
    }

    static UUID uuid(Object v) {
        if (v == null) {
            return null;
        }
        try {
            return UUID.fromString(String.valueOf(v));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    static List<String> strings(Object v) {
        if (v instanceof Collection<?> c) {
            return c.stream().filter(Objects::nonNull).map(String::valueOf).toList();
        }
        if (v instanceof String s && !s.isBlank()) {
            return List.of(s);
        }
        return List.of();
    }

    static Instant instant(String v, String field) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(v);
        } catch (RuntimeException e) {
            throw ApiException.badRequest("DATA_INVALIDA", Msg.t("cbc.admin.data_invalida"), Map.of("field", field));
        }
    }

    static <E extends Enum<E>> E enumOf(Class<E> type, String raw, String field) {
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw ApiException.badRequest("VALOR_INVALIDO", Msg.t("cbc.admin.invalido"), Map.of("field", field));
        }
    }
}
