package br.com.fashionai.application.service;


import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * RF25 — leitura tolerante dos valores do JSON da política (texto, maiúsculas, lista de textos). Compartilhada pela
 * validação ({@link SealPolicyNormalizer}) e pela leitura do que foi gravado ({@link SealPolicyParser}). Extraído de
 * {@link SealPolicies} (R80).
 */
final class SealPolicyValues {
    private SealPolicyValues() {
    }

    static List<String> strings(Object o) {
        List<String> out = new ArrayList<>();
        if (o instanceof Collection<?> c) {
            for (Object x : c) {
                if (x != null && !String.valueOf(x).isBlank()) {
                    out.add(String.valueOf(x).trim());
                }
            }
        }
        return out;
    }

    static String text(Object o) {
        if (o == null) {
            return null;
        }
        String s = String.valueOf(o).trim();
        return s.isEmpty() || "null".equals(s) ? null : s;
    }

    static String upper(Object o, String dflt) {
        String s = text(o);
        return s == null ? dflt : s.toUpperCase(Locale.ROOT);
    }
}
