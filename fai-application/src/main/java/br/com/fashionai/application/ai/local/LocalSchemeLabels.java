package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.WardrobeItem;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Rótulos de uma composição do Scheme Composer local: selos sugeridos, humor e título a partir de estilos e ocasiões. */
final class LocalSchemeLabels {
    private LocalSchemeLabels() {
    }

    static List<String> seals(List<WardrobeItem> pieces, List<String> styles, List<String> occasions, BigDecimal total) {
        List<String> seals = new ArrayList<>();
        if (total.compareTo(BigDecimal.valueOf(150)) <= 0 && total.signum() > 0) {
            seals.add("affordable-chic");
        }
        if (total.compareTo(BigDecimal.valueOf(500)) >= 0) {
            seals.add("premium-look");
        }
        long natural = pieces.stream().filter(p -> Set.of("COTTON", "WOOL", "SILK").contains(p.getMaterial())).count();
        if (natural * 2 > pieces.size()) {
            seals.add("eco-conscious");
        }
        if (styles.stream().anyMatch(s -> Set.of("streetwear", "y2k", "statement", "futuristic", "techwear").contains(s))) {
            seals.add("trendy-combo");
        }
        if (occasions.contains("casual") && styles.stream().anyMatch(s -> Set.of("chic", "classic", "minimalist").contains(s))) {
            seals.add("casual-elegance");
        }
        return seals.stream().limit(4).toList();
    }

    static String mood(List<String> styles, List<String> occasions) {
        if (occasions.stream().anyMatch(o -> Set.of("gym", "sport", "festival", "party").contains(o))) {
            return "ENERGETIC";
        }
        if (occasions.stream().anyMatch(o -> Set.of("formal", "wedding", "ceremony").contains(o))
                || styles.stream().anyMatch(s -> Set.of("luxury", "glam").contains(s))) {
            return "ELEGANT";
        }
        if (styles.stream().anyMatch(s -> Set.of("chic", "tailored", "classic", "minimalist").contains(s))) {
            return "SOPHISTICATED";
        }
        return "COMFORTABLE";
    }

    static String title(List<String> styles, List<String> occasions, String season) {
        String s = styles.isEmpty() ? "Essencial" : cap(styles.get(0).replace('_', ' '));
        String o = occasions.isEmpty() ? Msg.t("localSchemeComposer.dia_a_dia") : occasions.get(0).replace('_', ' ');
        String se = season == null ? "" : switch (season.toUpperCase(Locale.ROOT)) {
            case "SUMMER" -> Msg.t("localSchemeComposer.de_verao");
            case "WINTER" -> " de inverno";
            case "AUTUMN" -> " de outono";
            case "SPRING" -> " de primavera";
            default -> "";
        };
        return "Look " + s + " para " + o + se;
    }

    private static String cap(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
