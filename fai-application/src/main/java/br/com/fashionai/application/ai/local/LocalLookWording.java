package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Palavras dos looks montados pelo motor local: o título e a explicação saem com o nome de cada estilo e ocasião no
 * idioma de quem pediu ("Look Básico para encontro"), nunca com o código da taxonomia ("Look Basic para date").
 */
final class LocalLookWording {
    private LocalLookWording() {
    }

    static String title(List<String> styles, List<String> occasions, String season) {
        String s = styles.isEmpty() ? "Essencial" : cap(Taxonomy.label(styles.get(0)));
        String o = occasions.isEmpty() ? Msg.t("localSchemeComposer.dia_a_dia") : spoken(occasions.get(0));
        String se = season == null ? "" : switch (season.toUpperCase(Locale.ROOT)) {
            case "SUMMER" -> Msg.t("localSchemeComposer.de_verao");
            case "WINTER" -> " de inverno";
            case "AUTUMN" -> " de outono";
            case "SPRING" -> " de primavera";
            default -> "";
        };
        return "Look " + s + " para " + o + se;
    }

    /** Código da taxonomia como a pessoa lê no meio da frase ("date" → "encontro"), no idioma de quem pediu. */
    static String spoken(String code) {
        return Taxonomy.label(code).toLowerCase(Msg.locale());
    }

    static String spoken(List<String> codes) {
        return codes.stream().map(LocalLookWording::spoken).collect(Collectors.joining("/"));
    }

    private static String cap(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
