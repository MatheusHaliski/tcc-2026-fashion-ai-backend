package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.enums.HypeEntityType;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.ToIntFunction;

/**
 * RF53 · P1-10 — texto e payload do resumo diário de marcos de Hype (extraído do {@link HypeMilestoneNotifier}, que
 * continua dono do dedupe, da gravação e da notificação). Puro: recebe os marcos do dia e os nomes já lidos.
 */
final class HypeMilestoneDigest {
    /** quantos itens o texto do resumo nomeia; o resto vira "e mais N" */
    static final int MAX_NAMED = 3;
    /** nome cortado no texto: o corpo da notificação tem 500 caracteres */
    static final int NAME_MAX = 60;
    /** resumo com vários itens: abre Histórico › Hype (subiram, emergentes, redescobertas) */
    static final String DIGEST_HREF = "/history?tab=hype";
    static final String DIGEST_RESOURCE = "HYPE";
    /** parâmetro que abre a análise do card já no painel (lib/aura/unlocks.ts, UNLOCKS_PARAM) */
    static final String UNLOCKS_PARAM = "destrava";

    private HypeMilestoneDigest() {
    }

    static String shortName(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String clean = raw.replace('§', ' ').replace('\u001F', ' ').strip();
        return clean.length() > NAME_MAX ? clean.substring(0, NAME_MAX - 1).strip() + "…" : clean;
    }

    record Content(String title, String body, String resourceType, UUID resourceId, Map<String, Object> payload) {
    }

    /**
     * Texto do resumo (marcadores de i18n: resolvidos no idioma de quem lê). Um item por peça/look — o marco mais alto
     * do dia (Viral › Tendência › Em alta › Emergente). Com um item, o link abre o detalhe; com vários, Histórico › Hype.
     */
    static Content content(List<HypeMilestone> day, Map<UUID, String> names) {
        return content(day, names, k -> 0);
    }

    /**
     * Circuito Aura (elo 3): com {@code points}, o resumo diz o que o marco destravou (+N FAI Points no total do dia) e o
     * link de um item só abre o card já no painel "O que este card destrava" ({@code ?destrava=<id>}).
     */
    static Content content(List<HypeMilestone> day, Map<UUID, String> names, ToIntFunction<HypeMilestone.Kind> points) {
        Map<UUID, HypeMilestone> best = new LinkedHashMap<>();
        for (HypeMilestone m : day) {
            best.merge(m.getEntityId(), m, (a, b) -> rank(b.getMilestone()) > rank(a.getMilestone()) ? b : a);
        }
        List<HypeMilestone> items = new ArrayList<>(best.values());
        StringBuilder body = new StringBuilder();
        int named = 0;
        for (HypeMilestone m : items) {
            String name = names.get(m.getEntityId());
            if (name == null || named >= MAX_NAMED) {
                continue;
            }
            append(body, Msg.k("notification.hype.body." + m.getMilestone().name(), name));
            named++;
        }
        if (items.size() > named) {
            append(body, Msg.k("notification.hype.more", items.size() - named));
        }
        int total = day.stream().mapToInt(m -> points.applyAsInt(m.getMilestone())).sum();
        if (total > 0) {
            append(body, Msg.k("notification.hype.reward", total));
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
        payload.put("points", total);
        if (items.size() == 1) {
            HypeMilestone only = items.get(0);
            String href = (only.getEntityType() == HypeEntityType.PIECE ? "/pieces/" : "/schemes/") + only.getEntityId() + "?" + UNLOCKS_PARAM + "=" + only.getEntityId();
            payload.put("href", href);
            return new Content(Msg.k("notification.hype.title_one"), body.toString(), only.getEntityType().name(), only.getEntityId(), payload);
        }
        payload.put("href", DIGEST_HREF);
        return new Content(Msg.k("notification.hype.title_many", items.size()), body.toString(), DIGEST_RESOURCE, null, payload);
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
