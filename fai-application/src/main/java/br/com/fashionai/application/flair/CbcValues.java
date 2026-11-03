package br.com.fashionai.application.flair;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Leitura tolerante dos valores dos requisitos e das tags do {@link CbcRules} (nível, inteiro, lista de textos) e
 * operações de conjunto sobre tags normalizadas.
 */
final class CbcValues {
    private CbcValues() {
    }

    // ================================================================== apoio
    static String tier(Object v) {
        return v == null ? "BRONZE" : String.valueOf(v).toUpperCase(Locale.ROOT);
    }

    static int intOf(Object v, int def) {
        return v instanceof Number n ? n.intValue() : def;
    }

    @SuppressWarnings("unchecked")
    static List<String> strings(Object v) {
        if (v instanceof Collection<?> c) {
            return c.stream().filter(Objects::nonNull).map(String::valueOf).toList();
        }
        return List.of();
    }

    static boolean intersects(Set<String> a, Set<String> b) {
        if (a == null || b == null || a.isEmpty() || b.isEmpty()) {
            return false;
        }
        for (String x : a) {
            if (b.contains(x)) {
                return true;
            }
        }
        return false;
    }

    public static Set<String> norm(Collection<String> values) {
        Set<String> out = new LinkedHashSet<>();
        if (values != null) {
            for (String v : values) {
                if (v != null && !v.isBlank()) {
                    out.add(v.trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        return out;
    }
}
