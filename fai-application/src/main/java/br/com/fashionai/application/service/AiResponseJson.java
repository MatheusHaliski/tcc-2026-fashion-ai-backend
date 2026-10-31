package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;

import java.util.List;
import java.util.Map;

/** Leitura tolerante do JSON devolvido pelos modelos de IA: objeto embutido no texto, strings, listas e caixas. */
final class AiResponseJson {
    private AiResponseJson() {
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> extractJson(String text) {
        if (text == null) {
            return Map.of();
        }
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Map.of();
        }
        Map<String, Object> m = Json.map(text.substring(start, end + 1));
        return m == null ? Map.of() : m;
    }

    static String str(Object o) {
        return o == null ? null : String.valueOf(o).trim();
    }

    static List<String> strings(Object o) {
        if (o instanceof List<?> l) {
            return l.stream().filter(java.util.Objects::nonNull).map(String::valueOf).toList();
        }
        return o instanceof String s && !s.isBlank() ? List.of(s) : List.of();
    }

    /** O valor, se for um dos permitidos (null-safe). */
    static String oneOf(String value, java.util.Collection<String> allowed) {
        return value != null && allowed.contains(value) ? value : null;
    }

    static double[] boxOf(Object logo) {
        if (logo instanceof Map<?, ?> m && m.get("box") instanceof List<?> l && l.size() == 4) {
            double[] b = new double[4];
            for (int i = 0; i < 4; i++) {
                if (!(l.get(i) instanceof Number n)) {
                    return null;
                }
                b[i] = n.doubleValue();
            }
            return b;
        }
        return null;
    }

    /** Caixa do logo devolvida pela IA (0–1000), validada: 4 números em ordem, com área mínima. */
    static double[] logoBox(Object logo) {
        if (!(logo instanceof Map<?, ?> lm) || Boolean.FALSE.equals(lm.get("visible")) || !(lm.get("box") instanceof List<?> b) || b.size() != 4) {
            return null;
        }
        double[] v = new double[4];
        for (int i = 0; i < 4; i++) {
            if (!(b.get(i) instanceof Number n)) {
                return null;
            }
            v[i] = Math.max(0, Math.min(1000, n.doubleValue()));
        }
        return v[2] - v[0] >= 8 && v[3] - v[1] >= 8 ? v : null;
    }
}
