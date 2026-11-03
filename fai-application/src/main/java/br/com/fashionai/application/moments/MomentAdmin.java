package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.MomentStatus;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Administração (§56): lista, detalhe e transições de status dos Momentos oficiais. */
final class MomentAdmin extends MomentSupport {
    MomentAdmin(MomentContext ctx) {
        super(ctx);
    }

    List<Map<String, Object>> adminList(CurrentUser admin) {
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

    Map<String, Object> adminDetail(CurrentUser admin, UUID id) {
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

    /** Transições: schedule (DRAFT→SCHEDULED/ACTIVE pelo relógio), feature, unfeature, cancel, archive, draft. */
    Map<String, Object> adminTransition(CurrentUser admin, UUID id, String action) {
        guard.requireAdmin(admin);
        Moment m = moments.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
        switch (action == null ? "" : action.toLowerCase(Locale.ROOT)) {
            case "schedule" -> {
                MomentStatus eff = MomentTime.effective(withStatus(m, MomentStatus.SCHEDULED), now());
                m.setStatus(eff == MomentStatus.ENDED ? MomentStatus.ENDED : eff);
                if (m.getStatus() == MomentStatus.ENDED && m.getMemoryJson() == null) {
                    new MomentLifecycle(ctx).end(m);
                }
            }
            case "feature" -> m.setFeatured(true);
            case "unfeature" -> m.setFeatured(false);
            case "cancel" -> m.setStatus(MomentStatus.CANCELLED);
            case "archive" -> m.setStatus(MomentStatus.ARCHIVED);
            case "draft" -> m.setStatus(MomentStatus.DRAFT);
            case "end" -> new MomentLifecycle(ctx).end(m);
            default -> throw ApiException.badRequest("ACAO_INVALIDA", Msg.t("moment.acao_invalida"));
        }
        moments.save(m);
        return adminDetail(admin, m.getId());
    }

    private static Moment withStatus(Moment m, MomentStatus s) {
        m.setStatus(s);
        return m;
    }
}
