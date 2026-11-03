package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MirrorService.Interpretation;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Vista-me — interpretação do pedido (ocasião, humor, âncoras, clima): palavras-chave em pt, en e es
 * e a interpretação pela IA com a local como fallback.
 */
final class MirrorInterpretation {
    private final AiEngine ai;

    MirrorInterpretation(AiEngine ai) {
        this.ai = ai;
    }

    // ================================================================== Vista-me (CA08–CA15)
    static final Map<String, List<String>> KEYWORDS = Map.ofEntries(
            Map.entry("faculdade", List.of("university")), Map.entry("aula", List.of("university", "school")), Map.entry("escola", List.of("school")),
            Map.entry("trabalho", List.of("work")), Map.entry("trabajo", List.of("work")), Map.entry("escritório", List.of("work", "business")), Map.entry("reunião", List.of("business")),
            Map.entry("apresentação", List.of("business", "formal")), Map.entry("entrevista", List.of("business", "formal")),
            Map.entry("festa", List.of("party")), Map.entry("balada", List.of("night_out")), Map.entry("jantar", List.of("date", "social")),
            Map.entry("encontro", List.of("date")), Map.entry("casamento", List.of("wedding")), Map.entry("formatura", List.of("ceremony", "formal")),
            Map.entry("praia", List.of("beach")), Map.entry("piscina", List.of("beach")), Map.entry("viagem", List.of("travel")),
            Map.entry("academia", List.of("gym")), Map.entry("treino", List.of("gym", "sport")), Map.entry("corrida", List.of("sport")),
            Map.entry("esporte", List.of("sport")), Map.entry("casa", List.of("home")), Map.entry("show", List.of("festival")),
            Map.entry("festival", List.of("festival")), Map.entry("passeio", List.of("casual", "outdoor")), Map.entry("parque", List.of("outdoor")),
            // inglês e espanhol (RF23)
            Map.entry("university", List.of("university")), Map.entry("college", List.of("university")), Map.entry("class", List.of("university", "school")), Map.entry("school", List.of("school")),
            Map.entry("work", List.of("work")), Map.entry("office", List.of("work", "business")), Map.entry("meeting", List.of("business")), Map.entry("presentation", List.of("business", "formal")),
            Map.entry("interview", List.of("business", "formal")), Map.entry("party", List.of("party")), Map.entry("club", List.of("night_out")), Map.entry("dinner", List.of("date", "social")),
            Map.entry("date", List.of("date")), Map.entry("wedding", List.of("wedding")), Map.entry("graduation", List.of("ceremony", "formal")), Map.entry("beach", List.of("beach")),
            Map.entry("pool", List.of("beach")), Map.entry("trip", List.of("travel")), Map.entry("travel", List.of("travel")), Map.entry("gym", List.of("gym")), Map.entry("workout", List.of("gym", "sport")),
            Map.entry("running", List.of("sport")), Map.entry("sport", List.of("sport")), Map.entry("home", List.of("home")), Map.entry("concert", List.of("festival")), Map.entry("walk", List.of("casual", "outdoor")), Map.entry("park", List.of("outdoor")),
            Map.entry("universidad", List.of("university")), Map.entry("clase", List.of("university", "school")), Map.entry("escuela", List.of("school")), Map.entry("oficina", List.of("work", "business")),
            Map.entry("reunión", List.of("business")), Map.entry("reunion", List.of("business")), Map.entry("presentación", List.of("business", "formal")), Map.entry("presentacion", List.of("business", "formal")),
            Map.entry("fiesta", List.of("party")), Map.entry("discoteca", List.of("night_out")), Map.entry("cena", List.of("date", "social")),
            Map.entry("cita", List.of("date")), Map.entry("boda", List.of("wedding")), Map.entry("graduación", List.of("ceremony", "formal")), Map.entry("graduacion", List.of("ceremony", "formal")),
            Map.entry("playa", List.of("beach")), Map.entry("viaje", List.of("travel")), Map.entry("gimnasio", List.of("gym")), Map.entry("entrenamiento", List.of("gym", "sport")),
            Map.entry("carrera", List.of("sport")), Map.entry("deporte", List.of("sport")), Map.entry("concierto", List.of("festival")), Map.entry("paseo", List.of("casual", "outdoor")));

    /** palavra inteira (inglês): "hot" não casa com "photo", "cold" não casa com "scolding" */
    static boolean hasWord(String text, String word) {
        return java.util.regex.Pattern.compile("\\b" + java.util.regex.Pattern.quote(word) + "\\b").matcher(text).find();
    }

    static Interpretation localInterpretation(String prompt, List<UUID> anchors) {
        String p = prompt == null ? "" : prompt.toLowerCase(Locale.ROOT);
        LinkedHashSet<String> occ = new LinkedHashSet<>();
        KEYWORDS.forEach((k, v) -> {
            if (p.contains(k)) {
                occ.addAll(v);
            }
        });
        // humor e clima também em inglês e espanhol (as células do Vista-me mandam o rótulo no idioma da pessoa)
        String mood = p.contains("confort") || p.contains("comfort") || p.contains("cómod") || p.contains("comod") || p.contains("relax") ? "COMFORTABLE"
                : p.contains("eleg") || p.contains("chique") ? "ELEGANT"
                : p.contains("sofistic") ? "SOPHISTICATED" : p.contains("energ") || p.contains("anim") ? "ENERGETIC" : null;
        List<String> constraints = new ArrayList<>();
        if (p.contains("frio") || p.contains("frío") || p.contains("chuva") || hasWord(p, "cold") || hasWord(p, "rainy") || p.contains("lluvia")) {
            constraints.add("cold");
        }
        if (p.contains("calor") || p.contains("quente") || p.contains("sol") || hasWord(p, "hot") || hasWord(p, "warm") || p.contains("caluroso")) {
            constraints.add("hot");
        }
        if (p.contains("diferente") || p.contains("ousad")) {
            constraints.add("different_from_usual");
        }
        if (p.contains("preto") || p.contains("monocrom")) {
            constraints.add("monochrome");
        }
        if (occ.isEmpty()) {
            occ.add("casual");
        }
        String season = constraints.contains("cold") ? "WINTER" : constraints.contains("hot") ? "SUMMER" : null;
        return new Interpretation(new ArrayList<>(occ).subList(0, Math.min(3, occ.size())), mood, anchors, constraints, season);
    }

    Interpretation interpret(CurrentUser user, String prompt, List<UUID> anchors, List<WardrobeItem> eligible, AiOutcome<?>[] holder) {
        Map<String, UUID> refs = new LinkedHashMap<>();
        List<Map<String, Object>> names = new ArrayList<>();
        int i = 1;
        for (WardrobeItem w : eligible) {
            String ref = "p" + i++;
            refs.put(ref, w.getId());
            names.add(Map.of("ref", ref, "name", String.valueOf(w.getName()), "subcategory", String.valueOf(w.getSubcategory()),
                    "color", String.valueOf(w.getColor())));
        }
        Interpretation local = localInterpretation(prompt, anchors);
        AiOutcome<Interpretation> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                Msg.t("mirror.interprete_o_pedido_de_look", Taxonomy.OCCASIONS),
                "Pedido: " + prompt + "\nPeças do acervo (refs): " + Json.write(names) + "\nÂncoras já escolhidas: " + anchors,
                List.of(), 400, List.of(Msg.t("mirror.texto_do_pedido"), Msg.t("mirror.nomes_subcategorias_das_pecas")),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    if (m.isEmpty()) {
                        return null;
                    }
                    List<String> occ = m.get("occasion") instanceof List<?> l ? l.stream().map(String::valueOf).filter(Taxonomy.OCCASIONS::contains)
                            .distinct().limit(3).toList() : List.of();
                    String mood = m.get("mood") == null ? null : String.valueOf(m.get("mood"));
                    if (mood != null && !Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED").contains(mood)) {
                        mood = null;
                    }
                    LinkedHashSet<UUID> anc = new LinkedHashSet<>(anchors);
                    if (m.get("anchor_refs") instanceof List<?> l) {
                        l.stream().map(String::valueOf).map(refs::get).filter(Objects::nonNull).forEach(anc::add);
                    }
                    List<String> cons = m.get("constraints") instanceof List<?> l ? l.stream().map(String::valueOf).map(c -> InputSanitizer.clean(c, 30))
                            .limit(5).toList() : List.of();
                    String season = m.get("season") == null ? null : String.valueOf(m.get("season"));
                    if (season != null && !Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(season)) {
                        season = null;
                    }
                    return new Interpretation(occ.isEmpty() ? local.occasion() : occ, mood == null ? local.mood() : mood, new ArrayList<>(anc), cons, season);
                }, () -> local, null));
        holder[0] = outcome;
        return outcome.value() == null ? local : outcome.value();
    }
}
