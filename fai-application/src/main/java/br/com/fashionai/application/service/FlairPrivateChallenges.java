package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.moments.MomentTime;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.application.service.FlairChallengeService.PrivateChallengeRequest;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairChallengeService.PRIVATE_MAX_PER_MOMENT;
import static br.com.fashionai.application.service.FlairChallengeService.PRIVATE_MAX_POINTS;
import static br.com.fashionai.application.service.FlairChallengeValues.interpretations;

/**
 * Momento privado de grupo: o dono adiciona um desafio a partir de um modelo oficial (até 3; vale até 15 pontos).
 * Colaborador do {@link FlairChallengeService} (R82).
 */
final class FlairPrivateChallenges {
    private final Guard guard;
    private final FlairChallengeRepository challenges;
    private final MomentRepository moments;
    private final MomentService momentService;
    private final FlairChallengeWindows windows;
    private final FlairChallengeViews views;
    private final FlairChallengeClock clock;

    FlairPrivateChallenges(Guard guard, FlairChallengeRepository challenges, MomentRepository moments, MomentService momentService,
                           FlairChallengeWindows windows, FlairChallengeViews views, FlairChallengeClock clock) {
        this.guard = guard;
        this.challenges = challenges;
        this.moments = moments;
        this.momentService = momentService;
        this.windows = windows;
        this.views = views;
        this.clock = clock;
    }

    /** O dono de um Momento privado de grupo adiciona um desafio a partir de um modelo oficial (até 3; vale até 15 pontos). */
    Map<String, Object> addToPrivateMoment(CurrentUser user, UUID momentId, PrivateChallengeRequest req) {
        guard.requireCanCreate(user);
        Moment m = moments.findById(momentId).filter(x -> momentService.canSee(user, x)).orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
        if (m.getGroupId() == null || !(user.id().equals(m.getCreatedByUserId()) || user.admin())) {
            throw guard.deny(user, "moment:" + m.getSlug(), Msg.t("cbc.so_quem_criou_o_momento"));
        }
        MomentStatus eff = MomentTime.effective(m, clock.now());
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
        return views.summary(c, m, windows.window(c, m, clock.now()), user, List.of());
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
}
