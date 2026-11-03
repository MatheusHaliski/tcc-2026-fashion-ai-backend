package br.com.fashionai.application.service;

import java.text.Normalizer;
import java.util.Locale;

/** Comparação de texto do Copilot: sem acento, por palavra inteira ou por prefixo de palavra. */
final class CopilotText {
    private CopilotText() {
    }

    static String normalized(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replace('_', ' ').replace('-', ' ').replaceAll("\\s+", " ").trim();
    }

    static boolean mentions(String text, String phrase) {
        String value = normalized(text);
        String target = normalized(phrase).trim();
        return !target.isEmpty() && (" " + value.replaceAll("[^a-z0-9]+", " ") + " ").contains(" " + target + " ");
    }

    static boolean startsWithWord(String text, String prefix) {
        String wanted = normalized(prefix);
        if (wanted.contains(" ")) return mentions(text, wanted);
        return java.util.Arrays.stream(normalized(text).split("\\s+")).anyMatch(word -> word.startsWith(wanted));
    }
}
