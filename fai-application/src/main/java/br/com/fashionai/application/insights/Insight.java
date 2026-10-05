package br.com.fashionai.application.insights;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Um insight: código estável, tom, título e frase já traduzidos, número em destaque, ação e a base de dados de onde veio.
 * Texto descritivo ("apresenta forte crescimento de saves"), nunca juízo de valor ("é uma peça boa").
 *
 * @param relevance só para ordenar (não sai na resposta)
 */
public record Insight(String code, Tone tone, String title, String text, Metric metric, Action action, List<String> basis, double relevance) {

    public enum Tone { POSITIVE, NEUTRAL, ATTENTION }

    /** Bases citadas em {@code basis}. */
    public static final String HYPE_V2 = "HYPE_V2";
    public static final String PUBLIC_RANKING = "PUBLIC_RANKING";
    public static final String PUBLIC_AGGREGATES = "PUBLIC_AGGREGATES";
    public static final String WARDROBE_USAGE = "WARDROBE_USAGE";
    public static final String STYLE_DNA = "STYLE_DNA";
    public static final String CAPSULE = "CAPSULE";
    public static final String INVENTORY_COMBOS = "INVENTORY_COMBOS";

    /** @param unit "%", "pts", "dias", "looks", "peças" ou nulo */
    public record Metric(String label, Number value, String unit) {
    }

    public record Action(String label, String href) {
    }

    public Insight withText(String newText) {
        return new Insight(code, tone, title, newText, metric, action, basis, relevance);
    }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code);
        m.put("tone", tone.name());
        m.put("title", title);
        m.put("text", text);
        if (metric == null) {
            m.put("metric", null);
        } else {
            Map<String, Object> x = new LinkedHashMap<>();
            x.put("label", metric.label());
            x.put("value", metric.value());
            x.put("unit", metric.unit());
            m.put("metric", x);
        }
        m.put("action", action == null ? null : Map.of("label", action.label(), "href", action.href()));
        m.put("basis", new ArrayList<>(basis));
        return m;
    }
}
