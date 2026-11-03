package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.moments.MomentViews;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.FlairChallengeGroup;
import br.com.fashionai.domain.model.FlairChallengeSubmission;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.repository.FlairChallengeGroupRepository;
import br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.application.service.FlairChallengeService.Window;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairChallengeValues.basePoints;
import static br.com.fashionai.application.service.FlairChallengeValues.momentView;
import static br.com.fashionai.application.service.FlairChallengeValues.multiplier;
import static br.com.fashionai.application.service.FlairChallengeValues.uuid;

/**
 * Visões do desafio: entregas da pessoa, grupos com progresso e insígnia, resumo do card e a entrega (com cartas de
 * peças privadas ocultas na comunidade). Colaborador do {@link FlairChallengeService} (R82).
 */
final class FlairChallengeViews {
    private final FlairChallengeSubmissionRepository submissions;
    private final FlairChallengeGroupRepository groups;
    private final UserAchievementRepository achievements;

    FlairChallengeViews(FlairChallengeSubmissionRepository submissions, FlairChallengeGroupRepository groups,
                        UserAchievementRepository achievements) {
        this.submissions = submissions;
        this.groups = groups;
        this.achievements = achievements;
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
}
