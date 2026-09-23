package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.StyleArchetype;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * DNA Synthesizer local (#4): arquétipo Kibbe por mapeamento de estilos, índice de ousadia 0–100 pela
 * saturação e pelos estilos "statement", paleta de 5 cores por k-means (sempre local — RNF6) e frase de
 * identidade por template. A frase precisa SINTETIZAR, não listar (HU20, Critério 2).
 */
public final class LocalDnaSynthesizer {
    private static final Map<StyleArchetype, Set<String>> ARCHETYPE_STYLES = new EnumMap<>(StyleArchetype.class);

    static {
        ARCHETYPE_STYLES.put(StyleArchetype.ROMANTIC, Set.of("romantic", "glam", "boho", "vintage"));
        ARCHETYPE_STYLES.put(StyleArchetype.DRAMATIC, Set.of("edgy", "avant_garde", "statement", "luxury", "futuristic"));
        ARCHETYPE_STYLES.put(StyleArchetype.CLASSIC, Set.of("classic", "tailored", "minimalist", "chic", "preppy", "modern"));
        ARCHETYPE_STYLES.put(StyleArchetype.NATURAL, Set.of("basic", "utility", "resort", "athleisure", "sporty"));
        ARCHETYPE_STYLES.put(StyleArchetype.GAMINE, Set.of("streetwear", "y2k", "grunge", "urban", "techwear"));
    }

    private LocalDnaSynthesizer() {
    }

    public record Synthesis(StyleArchetype archetype, int boldnessIndex, String identityPhrase, List<String> palette,
                            List<String> styleKeywords, List<String> occasionKeywords, String iconPieceName,
                            UUID iconSchemeId, double versatility) {
    }

    public static Synthesis synthesize(List<Scheme> schemes, Map<UUID, List<SchemeItem>> itemsByScheme,
                                       Collection<WardrobeItem> wardrobe) {
        Map<String, Integer> styles = new LinkedHashMap<>();
        Map<String, Integer> occasions = new LinkedHashMap<>();
        Map<UUID, Integer> pieceUse = new LinkedHashMap<>();
        Map<UUID, WardrobeItem> pieces = new LinkedHashMap<>();
        List<String> hexes = new ArrayList<>();
        for (Scheme s : schemes) {
            Json.csv(s.getStyle()).forEach(v -> styles.merge(v, 2, Integer::sum));
            Json.csv(s.getOccasion()).forEach(v -> occasions.merge(v, 2, Integer::sum));
            for (SchemeItem si : itemsByScheme.getOrDefault(s.getId(), List.of())) {
                WardrobeItem w = si.getWardrobeItem();
                pieces.put(w.getId(), w);
                pieceUse.merge(w.getId(), 1, Integer::sum);
                Json.csv(w.getStyleTags()).forEach(v -> styles.merge(v, 1, Integer::sum));
                Json.csv(w.getOccasionTags()).forEach(v -> occasions.merge(v, 1, Integer::sum));
                hexes.add(Taxonomy.hex(w.getColor()));
            }
        }
        if (schemes.isEmpty()) {
            for (WardrobeItem w : wardrobe) {
                Json.csv(w.getStyleTags()).forEach(v -> styles.merge(v, 1, Integer::sum));
                Json.csv(w.getOccasionTags()).forEach(v -> occasions.merge(v, 1, Integer::sum));
                hexes.add(Taxonomy.hex(w.getColor()));
                pieces.put(w.getId(), w);
            }
        }
        StyleArchetype archetype = StyleArchetype.CLASSIC;
        int bestScore = -1;
        for (Map.Entry<StyleArchetype, Set<String>> e : ARCHETYPE_STYLES.entrySet()) {
            int score = e.getValue().stream().mapToInt(v -> styles.getOrDefault(v, 0)).sum();
            if (score > bestScore) {
                bestScore = score;
                archetype = e.getKey();
            }
        }
        double avgSat = hexes.stream().mapToDouble(h -> ColorMath.saturation(ColorMath.parseHex(h))).average().orElse(0.2);
        int statement = styles.entrySet().stream()
                .filter(e -> Set.of("statement", "edgy", "avant_garde", "glam", "y2k", "futuristic").contains(e.getKey()))
                .mapToInt(Map.Entry::getValue).sum();
        int totalStyles = Math.max(1, styles.values().stream().mapToInt(Integer::intValue).sum());
        int boldness = (int) Math.round(Math.min(100, avgSat * 60 + statement * 40.0 / totalStyles));
        List<String> topStyles = top(styles, 3);
        List<String> topOcc = top(occasions, 3);
        List<String> palette = ColorMath.palette(hexes, 5);
        UUID iconId = pieceUse.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
        String iconName = iconId == null ? (pieces.isEmpty() ? null : pieces.values().iterator().next().getName())
                : pieces.get(iconId).getName();
        UUID iconScheme = schemes.stream().max((a, b) -> Long.compare(a.getLikeCount(), b.getLikeCount()))
                .map(Scheme::getId).orElse(null);
        double versatility = pieces.isEmpty() ? 0 : schemes.size() / (double) pieces.size();
        return new Synthesis(archetype, boldness, phrase(archetype, topStyles, topOcc, boldness), palette, topStyles,
                topOcc, iconName, iconScheme, Math.round(versatility * 100) / 100.0);
    }

    static String phrase(StyleArchetype archetype, List<String> styles, List<String> occasions, int boldness) {
        String essence = switch (archetype) {
            case ROMANTIC -> "delicadeza que conta histórias";
            case DRAMATIC -> "presença que ocupa a sala";
            case CLASSIC -> "elegância que atravessa estações";
            case NATURAL -> "conforto com intenção";
            case GAMINE -> "energia urbana em movimento";
        };
        String intensity = boldness >= 65 ? "sem medo de arriscar" : boldness >= 35 ? "com toques de ousadia" : "em tom sereno";
        String context = occasions.isEmpty() ? "do dia a dia" : switch (occasions.get(0)) {
            case "work", "business" -> "do trabalho à noite";
            case "party", "night_out" -> "feita para a noite";
            case "gym", "sport" -> "que acompanha o ritmo";
            case "formal", "wedding", "ceremony" -> "para os grandes momentos";
            case "travel", "vacation", "beach" -> "pronta para viajar";
            default -> "do dia a dia";
        };
        return capitalize(essence) + ", " + intensity + " — " + context + ".";
    }

    private static String capitalize(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static List<String> top(Map<String, Integer> map, int n) {
        return map.entrySet().stream().sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .map(Map.Entry::getKey).limit(n).toList();
    }
}
