package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pontuação do Scheme Composer local: aderência da peça ao pedido (ocasião, estilo, estação, palavras do texto livre,
 * favorita), nota da combinação (harmonia de cores, sexos coerentes) e normalização do texto livre.
 */
final class LocalSchemeScoring {
    private LocalSchemeScoring() {
    }

    static double score(WardrobeItem w, List<String> occasions, List<String> styles, String season, Set<String> words) {
        double s = 0;
        List<String> occ = Json.csv(w.getOccasionTags());
        List<String> sty = Json.csv(w.getStyleTags());
        if (occasions != null) {
            s += 2 * occasions.stream().filter(occ::contains).count();
        }
        if (styles != null) {
            s += 1.5 * styles.stream().filter(sty::contains).count();
        }
        s += seasonFit(w, season);
        for (String word : words) {
            if (word.equals(w.getColor()) || word.equals(w.getSubcategory()) || (w.getName() != null
                    && normalize(w.getName()).contains(word))) {
                s += 1.2;
            }
        }
        if (w.isFavorite()) {
            s += 0.3;
        }
        return s;
    }

    static double seasonFit(WardrobeItem w, String season) {
        if (season == null) {
            return 0;
        }
        String sub = w.getSubcategory() == null ? "" : w.getSubcategory();
        Set<String> warm = Set.of("shorts", "bermuda_shorts", "denim_shorts", "tank_top", "crop_top", "top", "sandals",
                "flip_flops", "espadrilles", "skirt", "skort");
        Set<String> cold = Set.of("coat", "parka", "sweater", "sweatshirt", "hoodie", "cardigan", "long_boots",
                "ankle_boots", "combat_boots", "boots", "beanie", "scarf", "gloves");
        return switch (season.toUpperCase(Locale.ROOT)) {
            case "SUMMER" -> warm.contains(sub) ? 1.0 : cold.contains(sub) || "WOOL".equals(w.getMaterial()) ? -1.5 : 0;
            case "WINTER" -> cold.contains(sub) || "WOOL".equals(w.getMaterial()) ? 1.0 : warm.contains(sub) ? -1.5 : 0;
            case "AUTUMN" -> Set.of("jacket", "cardigan", "ankle_boots", "boots", "blazer").contains(sub) ? 0.8 : 0;
            case "SPRING" -> Set.of("blouse", "t_shirt", "shirt", "flats", "loafers").contains(sub) ? 0.8 : 0;
            default -> 0;
        };
    }

    static double comboScore(List<WardrobeItem> combo, List<String> occasions, List<String> styles, String season,
                             Set<String> words) {
        double s = combo.stream().mapToDouble(w -> score(w, occasions, styles, season, words)).sum();
        s += 1.5 * harmony(combo, null);
        Set<String> sexes = combo.stream().map(WardrobeItem::getSex).filter(x -> !"UNISSEX".equals(x)).collect(Collectors.toSet());
        if (sexes.size() > 1) {
            s -= 2;
        }
        return s;
    }

    /** +1 base neutra com até 1 família de acento; negativo quando há 3+ famílias de acento. */
    static double harmony(List<WardrobeItem> combo, WardrobeItem extra) {
        List<WardrobeItem> all = new ArrayList<>(combo);
        if (extra != null) {
            all.add(extra);
        }
        Set<String> accents = new HashSet<>();
        int neutrals = 0;
        for (WardrobeItem w : all) {
            if (ColorMath.isNeutral(w.getColor())) {
                neutrals++;
            } else {
                accents.add(Taxonomy.COLOR_FAMILY.getOrDefault(w.getColor(), "Especiais"));
            }
        }
        if (accents.size() <= 1 && neutrals >= 1) {
            return 1;
        }
        if (accents.size() == 2) {
            return 0;
        }
        return accents.size() >= 3 ? -1 : 0.5;
    }

    static Set<String> words(String text) {
        Set<String> set = new HashSet<>();
        if (text == null) {
            return set;
        }
        for (String w : normalize(text).split("[^a-z0-9_]+")) {
            if (w.length() > 2) {
                set.add(w);
            }
        }
        return set;
    }

    static String normalize(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFKD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }
}
