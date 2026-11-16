package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;

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

    /**
     * Explicação do look com as peças pelo nome: cada look diz o seu (antes os três vinham com a mesma frase, palavra por
     * palavra, quando dividiam ocasião e estilo).
     */
    static String rationale(List<WardrobeItem> pieces, List<String> occ, List<String> sty) {
        String ocasiao = occ.isEmpty() ? Msg.t("localSchemeComposer.ocasiao_livre") : Msg.t("localSchemeComposer.ocasiao", spoken(occ));
        String estilo = sty.isEmpty() ? "" : Msg.t("localSchemeComposer.e_estilo", spoken(sty));
        List<String> nomes = pieces.stream().map(WardrobeItem::getName).filter(n -> n != null && !n.isBlank()).toList();
        return nomes.isEmpty() ? Msg.t("localSchemeComposer.combinacao_de_pecas_do_seu", pieces.size(), ocasiao, estilo)
                : Msg.t("localSchemeComposer.combinacao_das_pecas", String.join(" + ", nomes), ocasiao, estilo);
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
