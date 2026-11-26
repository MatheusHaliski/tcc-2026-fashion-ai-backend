package br.com.fashionai.application.garmentdelivery;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

/** Texto livre da ficha (pt, en, es) reduzido a palavras sem acento, para as regras de reconhecimento. */
final class GarmentText {
    private GarmentText() {
    }

    /** "Calça-Jeans, 98% Algodão" → " calca jeans 98% algodao " (espaços nas pontas para casar palavras inteiras). */
    static String normalize(String text) {
        if (text == null) {
            return " ";
        }
        String plain = Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return " " + plain.replaceAll("[^a-z0-9%.,]+", " ").replaceAll("[.,](?![0-9])", " ").trim() + " ";
    }

    /** A palavra (ou expressão) aparece começando uma palavra do texto normalizado. */
    static boolean has(String normalized, String keyword) {
        return normalized.contains(" " + keyword);
    }

    static boolean hasAny(String normalized, List<String> keywords) {
        for (String keyword : keywords) {
            if (has(normalized, keyword)) {
                return true;
            }
        }
        return false;
    }

    /** Posição da primeira ocorrência de qualquer palavra da lista, ou -1. */
    static int firstIndex(String normalized, List<String> keywords) {
        int best = -1;
        for (String keyword : keywords) {
            int at = normalized.indexOf(" " + keyword);
            if (at >= 0 && (best < 0 || at < best)) {
                best = at;
            }
        }
        return best;
    }

    static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
