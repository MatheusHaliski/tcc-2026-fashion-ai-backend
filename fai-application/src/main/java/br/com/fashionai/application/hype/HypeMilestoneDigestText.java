package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.enums.HypeEntityType;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF53 · P1-10 — texto e payload do resumo diário de marcos de Hype (puro: recebe os marcos do dia e os nomes). */
final class HypeMilestoneDigestText {
    private HypeMilestoneDigestText() {
    }

    /**
     * Texto do resumo (marcadores de i18n: resolvidos no idioma de quem lê). Um item por peça/look — o marco mais alto
     * do dia (Viral › Tendência › Em alta › Emergente). Com um item, o link abre o detalhe; com vários, Histórico › Hype.
     */
    static HypeMilestoneNotifier.Content content(List<HypeMilestone> day, Map<UUID, String> names) {
        Map<UUID, HypeMilestone> best = new LinkedHashMap<>();
        for (HypeMilestone m : day) {
            best.merge(m.getEntityId(), m, (a, b) -> rank(b.getMilestone()) > rank(a.getMilestone()) ? b : a);
        }
        List<HypeMilestone> items = new ArrayList<>(best.values());
        StringBuilder body = new StringBuilder();
        int named = 0;
        for (HypeMilestone m : items) {
            String name = names.get(m.getEntityId());
            if (name == null || named >= HypeMilestoneNotifier.MAX_NAMED) {
                continue;
            }
            append(body, Msg.k("notification.hype.body." + m.getMilestone().name(), name));
            named++;
        }
        if (items.size() > named) {
            append(body, Msg.k("notification.hype.more", items.size() - named));
        }
        if (items.stream().anyMatch(m -> !m.isPublicEligible())) {
            append(body, Msg.k("notification.hype.personal"));
        }
        List<Map<String, Object>> list = new ArrayList<>();
        for (HypeMilestone m : items) {
            Map<String, Object> it = new LinkedHashMap<>();
            it.put("type", m.getEntityType().name());
            it.put("id", m.getEntityId().toString());
            it.put("milestone", m.getMilestone().name());
            it.put("level", m.getLevel() == null ? null : m.getLevel().name());
            it.put("personal", !m.isPublicEligible());
            list.add(it);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("count", items.size());
        payload.put("items", list);
        if (items.size() == 1) {
            HypeMilestone only = items.get(0);
            String href = (only.getEntityType() == HypeEntityType.PIECE ? "/pieces/" : "/schemes/") + only.getEntityId();
            payload.put("href", href);
            return new HypeMilestoneNotifier.Content(Msg.k("notification.hype.title_one"), body.toString(), only.getEntityType().name(), only.getEntityId(), payload);
        }
        payload.put("href", HypeMilestoneNotifier.DIGEST_HREF);
        return new HypeMilestoneNotifier.Content(Msg.k("notification.hype.title_many", items.size()), body.toString(), HypeMilestoneNotifier.DIGEST_RESOURCE, null, payload);
    }

    /** Ordem do "marco mais alto" no resumo. */
    static int rank(HypeMilestone.Kind k) {
        return k == null ? -1 : k.isLevel() ? 1 + k.level().ordinal() : 0;
    }

    private static void append(StringBuilder sb, String part) {
        if (!sb.isEmpty()) {
            sb.append(' ');
        }
        sb.append(part);
    }
}
