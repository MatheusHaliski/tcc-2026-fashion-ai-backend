package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Slot;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.CbcSintonia.colorsMatch;
import static br.com.fashionai.application.flair.CbcValues.intersects;
import static br.com.fashionai.application.flair.CbcValues.norm;
import static br.com.fashionai.application.flair.CbcValues.strings;

/**
 * O que uma vaga do mosaico aceita ({@link Slot#accepts}): nível, nota mínima, marca, categoria, subcategoria, cor,
 * estilo, ocasião, material e origem que faltam à carta.
 */
final class CbcSlotAccepts {
    private CbcSlotAccepts() {
    }

    /** O que falta à carta para completar a vaga (lista vazia = aceita). Vaga sem {@code accepts} aceita qualquer carta. */
    public static List<String> misses(Slot s, Card c) {
        List<String> out = new ArrayList<>();
        Map<String, Object> a = s.accepts();
        if (a.isEmpty() || c == null) {
            return out;
        }
        if (a.get("tier") != null) {
            Set<String> tiers = new HashSet<>();
            strings(a.get("tier")).forEach(t -> tiers.add(t.toUpperCase(Locale.ROOT)));
            if (a.get("tier") instanceof String one) {
                tiers.add(one.toUpperCase(Locale.ROOT));
            }
            if (!tiers.contains(c.tier())) {
                out.add("tier");
            }
        }
        if (a.get("minOvr") instanceof Number n && c.ovr() < n.intValue()) {
            out.add("minOvr");
        }
        if (a.get("brand") != null && (c.brand() == null || !norm(listOrOne(a.get("brand"))).contains(c.brand().trim().toLowerCase(Locale.ROOT)))) {
            out.add("brand");
        }
        if (a.get("category") != null && (c.category() == null || !norm(listOrOne(a.get("category"))).contains(c.category().toLowerCase(Locale.ROOT)))) {
            out.add("category");
        }
        if (a.get("subcategory") != null && (c.subcategory() == null || !norm(listOrOne(a.get("subcategory"))).contains(c.subcategory().toLowerCase(Locale.ROOT)))) {
            out.add("subcategory");
        }
        if (a.get("color") != null && !colorsMatch(c.colors(), norm(listOrOne(a.get("color"))))) {
            out.add("color");
        }
        if (a.get("style") != null && !intersects(c.styles(), norm(listOrOne(a.get("style"))))) {
            out.add("style");
        }
        if (a.get("occasion") != null && !intersects(c.occasions(), norm(listOrOne(a.get("occasion"))))) {
            out.add("occasion");
        }
        if (a.get("material") != null && !intersects(c.materials(), norm(listOrOne(a.get("material"))))) {
            out.add("material");
        }
        if (a.get("origin") != null && !String.valueOf(a.get("origin")).equalsIgnoreCase(c.originType())) {
            out.add("origin");
        }
        return out;
    }

    static List<String> listOrOne(Object v) {
        return v instanceof String s ? List.of(s) : strings(v);
    }
}
