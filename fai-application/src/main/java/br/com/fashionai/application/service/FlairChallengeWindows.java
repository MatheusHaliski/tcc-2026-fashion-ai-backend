package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentService;
import br.com.fashionai.application.moments.MomentTime;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.application.service.FlairChallengeService.Window;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairChallengeService.ENDED;
import static br.com.fashionai.application.service.FlairChallengeService.HIDDEN;
import static br.com.fashionai.application.service.FlairChallengeService.OPEN;
import static br.com.fashionai.application.service.FlairChallengeService.UPCOMING;

/**
 * Janela do desafio (E1–E3) e visibilidade: busca por id ou slug, Momento ligado e a regra de quem pode ver.
 * Colaborador do {@link FlairChallengeService} (R82).
 */
final class FlairChallengeWindows {
    private final FlairChallengeRepository challenges;
    private final MomentRepository moments;
    private final MomentService momentService;

    FlairChallengeWindows(FlairChallengeRepository challenges, MomentRepository moments, MomentService momentService) {
        this.challenges = challenges;
        this.moments = moments;
        this.momentService = momentService;
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
}
