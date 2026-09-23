package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeSlot;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Scheme Composer local (#3) — composição por regras quando a IA externa está indisponível ou sem
 * consentimento. Restrição rígida (RF5.CA04 / RF30.CA02): usa SÓ peças do acervo do usuário. Sintetiza
 * ocasião/estilo (máx. 3, por frequência ponderada — nunca concatena) e sugere até 4 selos.
 */
public final class LocalSchemeComposer {
    private LocalSchemeComposer() {
    }

    public record Pick(UUID wardrobeItemId, SchemeSlot slot) {
    }

    public record Composition(String title, List<Pick> items, List<String> occasions, List<String> styles,
                              String season, String mood, List<String> seals, BigDecimal totalPrice, double score,
                              String rationale) {
    }

    public static List<Composition> compose(List<WardrobeItem> wardrobe, List<String> occasions, List<String> styles,
                                            String season, String freeText, int count) {
        List<WardrobeItem> usable = wardrobe.stream()
                .filter(WardrobeItem::isDisponivel)
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> w.getModerationStatus() != ModerationStatus.REJECTED_POLICY
                        && w.getModerationStatus() != ModerationStatus.REJECTED_NOT_CLOTHING)
                .toList();
        Set<String> words = words(freeText);
        Map<String, List<WardrobeItem>> byCat = new LinkedHashMap<>();
        for (WardrobeItem w : usable) {
            byCat.computeIfAbsent(w.getCategory(), k -> new ArrayList<>()).add(w);
        }
        Comparator<WardrobeItem> byScore = Comparator.comparingDouble(
                (WardrobeItem w) -> score(w, occasions, styles, season, words)).reversed();
        byCat.values().forEach(list -> list.sort(byScore));

        List<List<WardrobeItem>> candidates = new ArrayList<>();
        List<WardrobeItem> tops = top(byCat, "upper_piece");
        List<WardrobeItem> bottoms = top(byCat, "lower_piece");
        List<WardrobeItem> shoes = top(byCat, "shoes_piece");
        List<WardrobeItem> full = top(byCat, "full_body_piece");
        for (WardrobeItem t : tops.isEmpty() ? nullList() : tops) {
            for (WardrobeItem b : bottoms.isEmpty() ? nullList() : bottoms) {
                for (WardrobeItem s : shoes.isEmpty() ? nullList() : shoes) {
                    List<WardrobeItem> combo = new ArrayList<>();
                    if (t != null) {
                        combo.add(t);
                    }
                    if (b != null) {
                        combo.add(b);
                    }
                    if (s != null) {
                        combo.add(s);
                    }
                    if (combo.size() >= 2) {
                        candidates.add(combo);
                    }
                }
            }
        }
        for (WardrobeItem f : full) {
            for (WardrobeItem s : shoes.isEmpty() ? nullList() : shoes) {
                List<WardrobeItem> combo = new ArrayList<>(List.of(f));
                if (s != null) {
                    combo.add(s);
                }
                candidates.add(combo);
            }
        }
        if (candidates.isEmpty() && usable.size() >= 2) {
            candidates.add(usable.subList(0, Math.min(3, usable.size())));
        }
        List<WardrobeItem> accessories = top(byCat, "accessory_piece");
        List<Composition> result = new ArrayList<>();
        candidates.sort(Comparator.comparingDouble(
                (List<WardrobeItem> c) -> comboScore(c, occasions, styles, season, words)).reversed());
        Set<Set<UUID>> used = new HashSet<>();
        for (List<WardrobeItem> combo : candidates) {
            Set<UUID> key = combo.stream().map(WardrobeItem::getId).collect(Collectors.toSet());
            boolean tooSimilar = used.stream().anyMatch(u -> overlap(u, key) >= key.size());
            if (tooSimilar) {
                continue;
            }
            used.add(key);
            List<WardrobeItem> pieces = new ArrayList<>(combo);
            for (WardrobeItem acc : accessories) {
                if (score(acc, occasions, styles, season, words) > 0 && pieces.stream().noneMatch(p -> p.getId().equals(acc.getId()))
                        && harmony(pieces, acc) >= 0) {
                    pieces.add(acc);
                    break;
                }
            }
            result.add(toComposition(pieces, occasions, styles, season, comboScore(combo, occasions, styles, season, words)));
            if (result.size() >= count) {
                break;
            }
        }
        return result;
    }

    public static Composition toComposition(List<WardrobeItem> pieces, List<String> occasions, List<String> styles,
                                            String season, double score) {
        List<Pick> picks = pieces.stream().map(p -> new Pick(p.getId(), slotOf(p))).toList();
        List<String> occ = synthesize(pieces.stream().flatMap(p -> Json.csv(p.getOccasionTags()).stream()).toList(), occasions, 3);
        List<String> sty = synthesize(pieces.stream().flatMap(p -> Json.csv(p.getStyleTags()).stream()).toList(), styles, 3);
        BigDecimal total = pieces.stream().map(WardrobeItem::getPrice).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<String> seals = seals(pieces, sty, occ, total);
        String mood = mood(sty, occ);
        String title = title(sty, occ, season);
        String rationale = "Combinação de " + pieces.size() + " peças do seu acervo com " +
                (occ.isEmpty() ? "ocasião livre" : "ocasião " + String.join("/", occ)) +
                (sty.isEmpty() ? "" : " e estilo " + String.join("/", sty)) + "; cores harmonizadas a partir de uma base neutra.";
        return new Composition(title, picks, occ, sty, season, mood, seals, total, score, rationale);
    }

    public static SchemeSlot slotOf(WardrobeItem item) {
        return switch (item.getCategory() == null ? "" : item.getCategory()) {
            case "upper_piece" -> Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono")
                    .contains(item.getSubcategory()) ? SchemeSlot.OUTERWEAR : SchemeSlot.TOP;
            case "lower_piece" -> SchemeSlot.BOTTOM;
            case "shoes_piece" -> SchemeSlot.SHOES;
            case "full_body_piece" -> SchemeSlot.FULL_BODY;
            default -> SchemeSlot.ACCESSORY;
        };
    }

    /** Síntese por frequência ponderada: pedidos do usuário pesam 2, tags das peças pesam 1 — top N. */
    public static List<String> synthesize(List<String> itemTags, List<String> requested, int max) {
        Map<String, Double> weight = new LinkedHashMap<>();
        if (requested != null) {
            requested.forEach(r -> weight.merge(r, 2.0, Double::sum));
        }
        itemTags.forEach(t -> weight.merge(t, 1.0, Double::sum));
        return weight.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(Map.Entry::getKey).limit(max).toList();
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
        Set<String> warm = Set.of("shorts", "bermuda_shorts", "denim_shorts", "tank_top", "crop_top", "sandals",
                "flip_flops", "espadrilles", "skirt", "skort");
        Set<String> cold = Set.of("coat", "parka", "sweater", "sweatshirt", "hoodie", "cardigan", "long_boots",
                "ankle_boots", "combat_boots", "beanie", "scarf", "gloves");
        return switch (season.toUpperCase(Locale.ROOT)) {
            case "SUMMER" -> warm.contains(sub) ? 1.0 : cold.contains(sub) || "WOOL".equals(w.getMaterial()) ? -1.5 : 0;
            case "WINTER" -> cold.contains(sub) || "WOOL".equals(w.getMaterial()) ? 1.0 : warm.contains(sub) ? -1.5 : 0;
            case "AUTUMN" -> Set.of("jacket", "cardigan", "ankle_boots", "blazer").contains(sub) ? 0.8 : 0;
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
        String o = occasions.isEmpty() ? "dia a dia" : occasions.get(0).replace('_', ' ');
        String se = season == null ? "" : switch (season.toUpperCase(Locale.ROOT)) {
            case "SUMMER" -> " de verão";
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

    private static List<WardrobeItem> top(Map<String, List<WardrobeItem>> byCat, String cat) {
        List<WardrobeItem> list = byCat.getOrDefault(cat, List.of());
        return list.subList(0, Math.min(5, list.size()));
    }

    private static List<WardrobeItem> nullList() {
        List<WardrobeItem> l = new ArrayList<>();
        l.add(null);
        return l;
    }

    private static long overlap(Set<UUID> a, Set<UUID> b) {
        return a.stream().filter(b::contains).count();
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
