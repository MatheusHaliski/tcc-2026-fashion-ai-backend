package br.com.fashionai.application.flair;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Context;
import br.com.fashionai.application.flair.CbcRules.Interpretation;
import br.com.fashionai.application.flair.CbcRules.Slot;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.Set;

import static br.com.fashionai.application.flair.CbcRules.ANY;
import static br.com.fashionai.application.flair.CbcValues.intersects;

/**
 * Sintonia por vaga do {@link CbcRules}: posição, vizinhança (marca, estilo, harmonia de cores) e tema em qualquer
 * leitura ou na escolhida (P1/P3), além dos dias sem uso (redescoberta) e da leitura sugerida.
 */
final class CbcSintonia {
    private CbcSintonia() {
    }

    // ================================================================== sintonia
    static boolean positionOk(Slot s, Card c) {
        return s.position() == null || ANY.equals(s.position()) || s.position().equals(c.position());
    }

    /** +1 vizinhança: mesma marca, um estilo em comum ou cores em harmonia com a carta da vaga ao lado. */
    static boolean harmonious(Card a, Card b) {
        if (a == null || b == null) {
            return false;
        }
        if (a.brand() != null && b.brand() != null && !a.brand().isBlank() && a.brand().trim().equalsIgnoreCase(b.brand().trim())) {
            return true;
        }
        if (intersects(a.styles(), b.styles())) {
            return true;
        }
        for (String x : a.colors()) {
            for (String y : b.colors()) {
                if (colorHarmony(x, y)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Roda de famílias da taxonomia: neutros combinam com tudo; mesma família, vizinhas e complementares combinam. */
    static final List<String> WHEEL = List.of("Vermelho", "Laranja", "Amarelo", "Verde", "Azul", "Roxo", "Rosa");
    static final Set<Set<String>> COMPLEMENTS = Set.of(Set.of("Azul", "Laranja"), Set.of("Vermelho", "Verde"), Set.of("Roxo", "Amarelo"));

    public static boolean colorHarmony(String x, String y) {
        if (x == null || y == null) {
            return false;
        }
        if (x.equals(y) || ColorMath.isNeutral(x) || ColorMath.isNeutral(y)) {
            return true;
        }
        String fx = Taxonomy.COLOR_FAMILY.get(x);
        String fy = Taxonomy.COLOR_FAMILY.get(y);
        if (fx == null || fy == null) {
            return false;
        }
        if ("Especiais".equals(fx) || "Especiais".equals(fy) || fx.equals(fy)) {
            return true;
        }
        int ix = WHEEL.indexOf(fx);
        int iy = WHEEL.indexOf(fy);
        if (ix >= 0 && iy >= 0) {
            int d = Math.abs(ix - iy);
            if (d == 1 || d == WHEEL.size() - 1) {
                return true;
            }
        }
        return COMPLEMENTS.contains(Set.of(fx, fy));
    }

    /** Cor da carta conta como a do tema quando é a mesma ou da mesma família ("grafite" vale como "preto"). */
    static boolean colorMatch(String cardColor, String tagColor) {
        if (cardColor == null || tagColor == null) {
            return false;
        }
        if (cardColor.equals(tagColor)) {
            return true;
        }
        String fc = Taxonomy.COLOR_FAMILY.get(cardColor);
        return fc != null && !"Especiais".equals(fc) && fc.equals(Taxonomy.COLOR_FAMILY.get(tagColor));
    }

    static boolean colorsMatch(Set<String> cardColors, Set<String> tagColors) {
        for (String c : cardColors) {
            for (String t : tagColors) {
                if (colorMatch(c, t)) {
                    return true;
                }
            }
        }
        return false;
    }

    static boolean matchesInterpretation(Card c, Interpretation i) {
        return intersects(c.styles(), i.styles()) || colorsMatch(c.colors(), i.colors());
    }

    /** Tema em "qualquer leitura": alguma interpretação, ou as tags do Momento e do desafio. */
    public static boolean themeAny(Card c, Context ctx) {
        if (ctx == null || !ctx.hasTheme()) {
            return false;
        }
        for (Interpretation i : ctx.interpretations()) {
            if (matchesInterpretation(c, i)) {
                return true;
            }
        }
        return intersects(c.styles(), ctx.styles()) || colorsMatch(c.colors(), ctx.colors()) || intersects(c.occasions(), ctx.occasions());
    }

    /** +1 tema da sintonia: com leitura escolhida, a interpretação dela (ou as tags do próprio desafio); senão, qualquer uma. */
    static boolean themeFocus(Card c, Context ctx) {
        Interpretation chosen = ctx == null ? null : ctx.chosenInterpretation();
        if (chosen == null) {
            return themeAny(c, ctx);
        }
        return matchesInterpretation(c, chosen) || intersects(c.styles(), ctx.styles()) || colorsMatch(c.colors(), ctx.colors());
    }

    static boolean tagMatch(Card c, String field, Set<String> wanted) {
        return switch (field) {
            case "color" -> colorsMatch(c.colors(), wanted);
            case "occasion" -> intersects(c.occasions(), wanted);
            case "material" -> intersects(c.materials(), wanted);
            default -> intersects(c.styles(), wanted);
        };
    }

    /** Dias sem uso: desde o último uso; nunca usada, desde que entrou no guarda-roupa; peça removida = 0. */
    public static long idleDays(Card c, LocalDate today) {
        if (today == null) {
            return 0;
        }
        if (c.pieceLastWorn() != null) {
            return ChronoUnit.DAYS.between(c.pieceLastWorn(), today);
        }
        if (c.pieceAddedAt() != null) {
            return ChronoUnit.DAYS.between(c.pieceAddedAt().atZone(ZoneOffset.UTC).toLocalDate(), today);
        }
        return 0;
    }

    /** A interpretação que mais combina com as cartas da pessoa (sugestão, nunca obrigação). */
    public static String suggestInterpretation(Collection<Card> cards, List<Interpretation> interpretations) {
        String best = null;
        int bestCount = 0;
        for (Interpretation i : interpretations) {
            int n = (int) cards.stream().filter(c -> matchesInterpretation(c, i)).count();
            if (n > bestCount) {
                best = i.key();
                bestCount = n;
            }
        }
        return best;
    }
}
