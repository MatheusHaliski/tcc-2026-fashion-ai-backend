package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.moments.MomentViews;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeSubmission;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.application.service.FlairChallengeService.Window;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairChallengeService.COMMUNITY_MAX;
import static br.com.fashionai.application.service.FlairChallengeService.ENDED;
import static br.com.fashionai.application.service.FlairChallengeService.HIDDEN;
import static br.com.fashionai.application.service.FlairChallengeService.RARE_READING;
import static br.com.fashionai.application.service.FlairChallengeService.UPCOMING;
import static br.com.fashionai.application.service.FlairChallengeValues.accepts;
import static br.com.fashionai.application.service.FlairChallengeValues.interpretations;
import static br.com.fashionai.application.service.FlairChallengeValues.position;
import static br.com.fashionai.application.service.FlairChallengeValues.uuid;

/**
 * Leituras: lista por janela (agora, em breve, sempre, memórias), detalhe com leitura sugerida, montagens da comunidade
 * (I1) e memória do desafio (E2, D2, I2). Colaborador do {@link FlairChallengeService} (R82).
 */
final class FlairChallengeReads {
    private final FlairChallengeRepository challenges;
    private final FlairChallengeGroupRepository groups;
    private final FlairChallengeSubmissionRepository submissions;
    private final FlairCardInstanceRepository cards;
    private final UserRepository users;
    private final MomentRepository moments;
    private final MomentService momentService;
    private final FlairCollectionService collection;
    private final FlairChallengeWindows windows;
    private final FlairChallengeViews views;
    private final FlairChallengeBuilds builds;
    private final FlairChallengeClock clock;

    FlairChallengeReads(FlairChallengeRepository challenges, FlairChallengeGroupRepository groups,
                        FlairChallengeSubmissionRepository submissions, FlairCardInstanceRepository cards, UserRepository users,
                        MomentRepository moments, MomentService momentService, FlairCollectionService collection,
                        FlairChallengeWindows windows, FlairChallengeViews views, FlairChallengeBuilds builds, FlairChallengeClock clock) {
        this.challenges = challenges;
        this.groups = groups;
        this.submissions = submissions;
        this.cards = cards;
        this.users = users;
        this.moments = moments;
        this.momentService = momentService;
        this.collection = collection;
        this.windows = windows;
        this.views = views;
        this.builds = builds;
        this.clock = clock;
    }

    Map<String, Object> list(CurrentUser viewer, String momentSlug) {
        Instant now = clock.now();
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
        Map<UUID, List<FlairChallengeSubmission>> mine = views.mineBy(viewer, all);
        List<Map<String, Object>> now0 = new ArrayList<>();
        List<Map<String, Object>> upcoming = new ArrayList<>();
        List<Map<String, Object>> always = new ArrayList<>();
        List<Map<String, Object>> memories = new ArrayList<>();
        for (FlairChallenge c : all) {
            Moment m = c.getMomentId() == null ? null : ms.get(c.getMomentId());
            if ((c.getMomentId() != null && m == null) || !windows.visibleTo(viewer, c, m)) {
                continue;
            }
            Window w = windows.window(c, m, now);
            if (HIDDEN.equals(w.status())) {
                continue;
            }
            Map<String, Object> v = views.summary(c, m, w, viewer, mine.getOrDefault(c.getId(), List.of()));
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
        out.put("groups", momentSlug == null ? views.groupViews(viewer, all) : List.of());
        out.put("season", FlairService.season());
        return out;
    }

    Map<String, Object> detail(CurrentUser viewer, String idOrSlug) {
        FlairChallenge c = windows.visible(viewer, idOrSlug);
        Moment m = windows.momentOf(c);
        Window w = windows.window(c, m, clock.now());
        List<FlairChallengeSubmission> mine = viewer == null ? List.of() : submissions.findByChallengeIdAndUserIdOrderByAttemptDesc(c.getId(), viewer.id());
        Map<String, Object> out = views.summary(c, m, w, viewer, mine);
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
            List<CbcRules.Card> available = builds.models(cards.findByOwnerIdOrderByCreatedAtDesc(viewer.id()).stream()
                    .filter(x -> "AVAILABLE".equals(x.getState())).toList()).values().stream().toList();
            out.put("suggestedInterpretation", CbcRules.suggestInterpretation(available, interpretations(m)));
        }
        out.put("mySubmissions", mine.stream().map(s -> views.submissionView(s, null, null, false)).toList());
        boolean delivered = !mine.isEmpty();
        boolean open = delivered || ENDED.equals(w.status());
        out.put("communityOpen", open);
        out.put("community", open ? community(viewer, c, m) : List.of());
        out.put("memory", memory(c, m, open));
        if (c.getGroupCode() != null) {
            groups.findByCode(c.getGroupCode()).ifPresent(g -> out.put("group", views.groupView(viewer, g,
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
            out.add(views.submissionView(s, who, id -> vis.computeIfAbsent(id, k -> live.get(k) != null && collection.visible(viewer, live.get(k))), true));
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
}
