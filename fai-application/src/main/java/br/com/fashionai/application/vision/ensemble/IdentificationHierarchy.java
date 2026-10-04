package br.com.fashionai.application.vision.ensemble;

import br.com.fashionai.domain.model.enums.IdentificationLevel;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF4 · Hierarquia da identificação (categoria → subcategoria → marca → linha → modelo → variante), cada nível com
 * confiança independente. Saber "Nike 95%" não autoriza "Air Max 90" como certeza: a política de exibição separa
 * IDENTIFIED (≥ 0,90), LIKELY (≥ 0,60) e POSSIBLE (abaixo, com alternativas e pedido de revisão).
 */
public final class IdentificationHierarchy {
    public static final double IDENTIFIED = 0.90;
    public static final double LIKELY = 0.60;

    public enum Display { IDENTIFIED, LIKELY, POSSIBLE, UNKNOWN }

    public record Alternative(String value, double confidence) {
    }

    public record Level(IdentificationLevel level, String value, double confidence, List<Alternative> alternatives,
                        String source) {
        public Display display() {
            if (value == null || value.isBlank()) {
                return Display.UNKNOWN;
            }
            return confidence >= IDENTIFIED ? Display.IDENTIFIED : confidence >= LIKELY ? Display.LIKELY : Display.POSSIBLE;
        }

        /** Incerto o bastante para pedir revisão humana (ou foto). */
        public boolean needsReview() {
            return display() == Display.POSSIBLE || (display() == Display.LIKELY && confidence < 0.80);
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("level", level.name());
            m.put("value", value);
            m.put("confidence", Math.round(confidence * 1000) / 1000.0);
            m.put("display", display().name());
            m.put("needsReview", needsReview());
            m.put("alternatives", alternatives.stream().map(a -> Map.<String, Object>of("value", a.value(),
                    "confidence", Math.round(a.confidence() * 1000) / 1000.0)).toList());
            m.put("source", source);
            return m;
        }
    }

    private final Map<IdentificationLevel, Level> levels = new EnumMap<>(IdentificationLevel.class);

    public IdentificationHierarchy put(IdentificationLevel level, String value, double confidence, List<Alternative> alternatives,
                                       String source) {
        levels.put(level, new Level(level, value, clamp(confidence), alternatives == null ? List.of() : List.copyOf(alternatives), source));
        return this;
    }

    public Level get(IdentificationLevel level) {
        return levels.getOrDefault(level, new Level(level, null, 0, List.of(), null));
    }

    /**
     * Consistência entre níveis: um nível mais específico que implica o mais geral não pode deixar o geral menos
     * certo (modelo "Air Max 90" a 0,9 implica Nike ≥ ~0,88). O inverso não vale: marca certa não sobe o modelo.
     */
    public IdentificationHierarchy reconcile() {
        IdentificationLevel[] order = {IdentificationLevel.VARIANT, IdentificationLevel.MODEL, IdentificationLevel.PRODUCT_LINE, IdentificationLevel.BRAND};
        double floor = 0;
        for (IdentificationLevel l : order) {
            Level lv = levels.get(l);
            if (lv == null || lv.value() == null) {
                continue;
            }
            if (lv.confidence() < floor) {
                lv = new Level(lv.level(), lv.value(), floor, lv.alternatives(), lv.source());
                levels.put(l, lv);
            }
            floor = Math.max(floor, lv.confidence() * 0.98);
        }
        return this;
    }

    public List<Level> levels() {
        List<Level> out = new ArrayList<>();
        for (IdentificationLevel l : IdentificationLevel.values()) {
            out.add(get(l));
        }
        return out;
    }

    public List<Map<String, Object>> toList() {
        return levels().stream().map(Level::toMap).toList();
    }

    private static double clamp(double v) {
        return Double.isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
    }
}
