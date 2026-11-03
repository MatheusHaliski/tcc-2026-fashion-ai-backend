package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.CopilotText.mentions;

/** Momentos como contexto dos looks (§17–§18): Momento citado na mensagem, MomentMatch e aviso da leitura. */
final class CopilotMoments extends CopilotTools {
    CopilotMoments(CopilotContext ctx) {
        super(ctx);
    }

    @SuppressWarnings("unchecked")
    static List<String> strings(Object v) {
        return v instanceof List<?> l ? ((List<Object>) l).stream().map(String::valueOf).toList() : List.of();
    }

    /** O Momento ativo que a mensagem menciona (nome, slug ou tag de estilo/cor exclusiva dele); nulo se nenhum. */
    Map<String, Object> detectMoment(UUID userId, String message) {
        List<Map<String, Object>> active = activeMoments(userId);
        for (Map<String, Object> m : active) {
            String name = String.valueOf(m.get("name"));
            String slug = String.valueOf(m.get("slug")).replace('-', ' ').replaceAll("\\d{4}", "").trim();
            if (mentions(message, name) || (!slug.isBlank() && mentions(message, slug)) || mentions(message, name.replaceAll("\\d{4}", "").trim())) {
                return m;
            }
        }
        return null;
    }

    /**
     * MomentMatch de cada sugestão (sobre as tags das peças, determinístico) e reordenação: a leitura do Momento mais
     * compatível com o DNA sobe, sem apagar as demais — descoberta e identidade convivem (§18).
     */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> withMomentMatch(List<Map<String, Object>> cards, Map<String, Object> moment, List<String> occasions) {
        List<br.com.fashionai.application.moments.MomentMatch.Interpretation> interps = new ArrayList<>();
        for (Object o : (List<Object>) moment.getOrDefault("interpretations", List.of())) {
            if (o instanceof Map<?, ?> im) {
                Map<String, Object> i = (Map<String, Object>) im;
                interps.add(br.com.fashionai.application.moments.MomentMatch.interpretation(String.valueOf(i.get("key")), strings(i.get("styleTags")), strings(i.get("colorTags"))));
            }
        }
        br.com.fashionai.application.moments.MomentMatch.Context ctx = br.com.fashionai.application.moments.MomentMatch.context(
                strings(moment.get("styleTags")), strings(moment.get("colorTags")), strings(moment.get("occasionTags")), List.of(), interps);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> card : cards) {
            Map<String, Object> c = new LinkedHashMap<>(card);
            List<UUID> ids = (List<UUID>) c.get("pieceIds");
            List<WardrobeItem> look = ids == null ? List.of() : pieces.findByIdIn(ids);
            Set<String> styles = new LinkedHashSet<>(strings(c.get("style")));
            Set<String> colors = new LinkedHashSet<>();
            List<String> subs = new ArrayList<>();
            for (WardrobeItem w : look) {
                styles.addAll(Json.csv(w.getStyleTags()));
                colors.addAll(HypeQueryService.colorsOf(w));
                if (w.getSubcategory() != null) subs.add(w.getSubcategory());
            }
            br.com.fashionai.application.moments.MomentMatch.Result r = br.com.fashionai.application.moments.MomentMatch.score(ctx,
                    br.com.fashionai.application.moments.MomentMatch.subject(styles, colors, occasions, subs));
            Map<String, Object> scores = new LinkedHashMap<>((Map<String, Object>) c.getOrDefault("scores", Map.of()));
            scores.put("moment", r == null ? null : r.score());
            c.put("scores", scores);
            c.put("moment", Map.of("slug", moment.get("slug"), "name", moment.get("name"), "match", r == null ? 0 : r.score(),
                    "interpretation", r == null || r.interpretation() == null ? "" : r.interpretation()));
            out.add(c);
        }
        out.sort(Comparator.comparingInt((Map<String, Object> c) -> (Integer) ((Map<?, ?>) c.get("moment")).get("match")).reversed());
        return out;
    }

    @SuppressWarnings("unchecked")
    String momentNotice(Map<String, Object> moment, List<Map<String, Object>> cards) {
        String name = String.valueOf(moment.get("name"));
        String interpretation = cards.stream().map(c -> (Map<String, Object>) c.get("moment")).map(m -> String.valueOf(m.get("interpretation")))
                .filter(x -> !x.isBlank()).findFirst().orElse(null);
        return interpretation == null ? Msg.t("copilot.momento_sem_interpretacao", name) : Msg.t("copilot.momento_interpretacao", name, interpretation);
    }
}
