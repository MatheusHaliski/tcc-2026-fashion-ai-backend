package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.CbcStory;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.application.service.FlairChallengeService.AdminChallengeRequest;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairChallengeValues.accepts;
import static br.com.fashionai.application.service.FlairChallengeValues.enumOf;
import static br.com.fashionai.application.service.FlairChallengeValues.instant;
import static br.com.fashionai.application.service.FlairChallengeValues.interpretations;
import static br.com.fashionai.application.service.FlairChallengeValues.position;

/**
 * Administração dos desafios sem deploy: lista e gravação com as validações R1, P2 e A1.
 * Colaborador do {@link FlairChallengeService} (R82).
 */
final class FlairChallengeAdmin {
    private final Guard guard;
    private final FlairChallengeRepository challenges;
    private final MomentRepository moments;
    private final FlairChallengeWindows windows;
    private final FlairChallengeViews views;
    private final FlairChallengeClock clock;

    FlairChallengeAdmin(Guard guard, FlairChallengeRepository challenges, MomentRepository moments, FlairChallengeWindows windows,
                        FlairChallengeViews views, FlairChallengeClock clock) {
        this.guard = guard;
        this.challenges = challenges;
        this.moments = moments;
        this.windows = windows;
        this.views = views;
        this.clock = clock;
    }

    List<Map<String, Object>> adminList(CurrentUser admin) {
        guard.requireAdmin(admin);
        Instant now = clock.now();
        List<FlairChallenge> all = challenges.findAllByOrderBySortOrderAsc();
        Map<UUID, Moment> ms = moments.findByIdIn(all.stream().map(FlairChallenge::getMomentId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Moment::getId, Function.identity()));
        List<Map<String, Object>> out = new ArrayList<>();
        for (FlairChallenge c : all) {
            Moment m = c.getMomentId() == null ? null : ms.get(c.getMomentId());
            Map<String, Object> v = views.summary(c, m, windows.window(c, m, now), null, List.of());
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

    Map<String, Object> adminSave(CurrentUser admin, UUID id, AdminChallengeRequest r) {
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
        return views.summary(c, m, windows.window(c, m, clock.now()), null, List.of());
    }
}
