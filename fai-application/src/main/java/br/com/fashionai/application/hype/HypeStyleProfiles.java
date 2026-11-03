package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Perfis de estilo (estilos, cores com a família da taxonomia e ocasiões) do DNA, da peça e do look — a régua da
 * compatibilidade pessoal, que nunca entra no Hype. Reusados pelo Copilot, pela Lente, pelo Espelho e pelos Momentos.
 */
final class HypeStyleProfiles {
    private HypeStyleProfiles() {
    }

    static StyleCompatibility.Profile profileOf(StyleDna d) {
        return StyleCompatibility.profile(Json.csv(d.getStyleKeywords()), Json.csv(d.getColorPalette()), Json.csv(d.getOccasionKeywords()));
    }

    static StyleCompatibility.Profile profileOf(WardrobeItem w) {
        return StyleCompatibility.profile(Json.csv(w.getStyleTags()), colorsOf(w), Json.csv(w.getOccasionTags()));
    }

    static StyleCompatibility.Profile profileOf(Scheme s, List<SchemeItem> items) {
        Set<String> styles = new LinkedHashSet<>(Json.csv(s.getStyle()));
        Set<String> colors = new LinkedHashSet<>();
        items.forEach(si -> {
            styles.addAll(Json.csv(si.getWardrobeItem().getStyleTags()));
            colors.addAll(colorsOf(si.getWardrobeItem()));
        });
        return StyleCompatibility.profile(styles, colors, Json.csv(s.getOccasion()));
    }

    static List<String> colorsOf(WardrobeItem w) {
        List<String> out = new ArrayList<>();
        if (w.getColor() != null) {
            out.add(w.getColor());
            String family = Taxonomy.COLOR_FAMILY.get(w.getColor());
            if (family != null) {
                out.add(family);
            }
        }
        return out;
    }
}
