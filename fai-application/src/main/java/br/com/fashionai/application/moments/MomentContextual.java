package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.Visibility;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.moments.MomentEvaluator.subjectOf;
import static br.com.fashionai.application.moments.MomentRules.contextualHype;
import static br.com.fashionai.application.moments.MomentRules.idOf;

/** Verso do card (§16, §35) e resumo para o Copilot (§17): MomentMatch e Hype contextual nos Momentos ativos. */
final class MomentContextual extends MomentSupport {
    MomentContextual(MomentContext ctx) {
        super(ctx);
    }

    /**
     * Verso do card (§16, §35): para uma peça ou look, o MomentMatch e o Hype contextual em cada Momento ativo visível.
     * Hype contextual = Hype global ajustado pela relevância no Momento (clamp(hype + (match − 50) · 0,5)), derivado
     * e temporal — o Hype global nunca é sobrescrito. Sem Hype calculado ou sem base de tags, devolve nulo.
     */
    Map<String, Object> contextFor(CurrentUser viewer, HypeEntityType type, UUID id) {
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
            hype = hypeScore(HypeEntityType.PIECE, w.getId(), idOf(viewer));
        } else {
            Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("moment.look")));
            ownerId = s.getUser().getId();
            vis = s.getVisibility();
            subject = subjectOf(s, schemeItems.findBySchemeIdOrderBySortOrder(id));
            hype = hypeScore(HypeEntityType.SCHEME, s.getId(), idOf(viewer));
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

    /** Resumo para o Copilot (§17): Momentos ativos com tags e interpretações, para ele montar leituras por DNA. */
    List<Map<String, Object>> activeSummary(UUID userId) {
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
}
