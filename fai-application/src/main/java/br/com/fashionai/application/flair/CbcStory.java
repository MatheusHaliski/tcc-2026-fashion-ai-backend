package br.com.fashionai.application.flair;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * FLAIR-UT §7.3 e §14.6 — a história do cenário, escrita carta a carta a partir de modelos por vaga (determinística,
 * sem IA). Sai como chaves de tradução e variáveis, nunca como texto pronto: a mesma entrega aparece em português,
 * inglês ou espanhol conforme quem lê. No cenário "livre" os modelos vêm da própria vaga ({"pt-BR": …}).
 */
public final class CbcStory {
    private CbcStory() {
    }

    public static final String FREE = "livre";

    /** Vaga com os textos opcionais do cenário livre. */
    public record SlotText(String key, Map<String, Object> story) {
    }

    /** O que a história usa da carta. */
    public record CardText(String name, String brand, String color) {
    }

    public static List<Map<String, Object>> write(String scenario, List<SlotText> slots, Map<String, CardText> placed,
                                                  CbcRules.Evaluation ev, String interpretation) {
        List<Map<String, Object>> lines = new ArrayList<>();
        boolean free = FREE.equals(scenario);
        lines.add(line(free ? "cbc.story.open_free" : "cbc.scenario." + scenario + ".open", Map.of(), null, null));
        if (interpretation != null && !CbcRules.OWN.equals(interpretation)) {
            lines.add(line("cbc.story.reading", Map.of("interpretation", interpretation), null, null));
        } else {
            lines.add(line("cbc.story.reading_own", Map.of(), null, null));
        }
        Map<String, CbcRules.SlotResult> bySlot = new LinkedHashMap<>();
        if (ev != null) {
            ev.slots().forEach(s -> bySlot.put(s.slot(), s));
        }
        for (SlotText s : slots) {
            CardText c = placed.get(s.key());
            if (c == null) {
                continue;
            }
            Map<String, Object> vars = new LinkedHashMap<>();
            vars.put("name", c.name());
            vars.put("brand", c.brand() == null || c.brand().isBlank() ? "none" : c.brand());
            vars.put("color", c.color() == null || c.color().isBlank() ? "none" : c.color());
            CbcRules.SlotResult r = bySlot.get(s.key());
            Map<String, Object> l = line(free || s.story() != null ? null : "cbc.scenario." + scenario + "." + s.key() + ".story", vars,
                    s.story(), s.key());
            l.put("sintonia", r == null ? 0 : r.sintonia());
            lines.add(l);
        }
        if (ev != null && ev.filled() > 0) {
            double pct = ev.sintoniaMax() == 0 ? 0 : ev.sintonia() / (double) ev.sintoniaMax();
            lines.add(line("cbc.story.close." + (pct >= 0.67 ? "high" : pct >= 0.34 ? "mid" : "low"), Map.of(), null, null));
        }
        return lines;
    }

    private static Map<String, Object> line(String key, Map<String, Object> vars, Map<String, Object> text, String slot) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("vars", vars);
        if (text != null) {
            m.put("text", text);
        }
        if (slot != null) {
            m.put("slot", slot);
        }
        return m;
    }
}
