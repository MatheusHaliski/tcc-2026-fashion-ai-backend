package br.com.fashionai.application.service;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Regras do Vista-me por ocasião (códigos de Taxonomy.OCCASIONS) e por humor, sobre as subcategorias da taxonomia: o que
 * cada ocasião prefere (bônus) e o que ela não aceita (academia sem blazer nem sapato social, praia sem casaco, trabalho
 * sem chinelo nem moletom...). Usadas por MirrorLookComposer. Puro.
 */
final class MirrorOccasionProfiles {
    private MirrorOccasionProfiles() {
    }

    static final Set<String> FORMAL = Set.of("blazer", "tailored_pants", "oxford_shoes", "derby_shoes", "heels", "tie", "bow_tie",
            "loafers", "moccasins", "clutch");
    static final Set<String> SPORT = Set.of("running_shoes", "training_shoes", "basketball_shoes", "leggings", "jogger_pants",
            "sweatpants", "tank_top", "shorts", "cap", "socks");
    static final Set<String> BEACH = Set.of("sandals", "flip_flops", "espadrilles", "shorts", "denim_shorts", "bermuda_shorts",
            "tank_top", "crop_top", "sunglasses", "hat", "kimono");
    static final Set<String> COLD = Set.of("coat", "parka", "sweater", "sweatshirt", "hoodie", "cardigan", "combat_boots",
            "ankle_boots", "beanie", "scarf", "gloves");
    static final Set<String> WARM = Set.of("shorts", "bermuda_shorts", "denim_shorts", "tank_top", "crop_top", "sandals", "flip_flops",
            "espadrilles", "skirt", "skort");
    static final Set<String> VERY_CASUAL = Set.of("flip_flops", "sweatpants", "jogger_pants", "tank_top", "crop_top", "hoodie", "shorts",
            "denim_shorts", "leggings", "skate_shoes", "running_shoes", "training_shoes", "basketball_shoes", "cap");

    /** O que cada ocasião prefere (bônus) e o que ela não aceita. */
    record Profile(Set<String> prefer, double bonus, Set<String> exclude) {
    }

    static final Map<String, Profile> PROFILES = profiles();

    private static Map<String, Profile> profiles() {
        Map<String, Profile> p = new LinkedHashMap<>();
        Set<String> notForSport = union(FORMAL, Set.of("jeans", "dress", "skirt", "flats", "sandals", "flip_flops", "coat", "parka",
                "shirt", "blouse", "handbag", "jumpsuit"));
        p.put("gym", new Profile(SPORT, 3, notForSport));
        p.put("sport", new Profile(SPORT, 3, notForSport));
        Set<String> notForBeach = union(FORMAL, Set.of("coat", "parka", "combat_boots", "ankle_boots", "sweater", "gloves", "beanie",
                "scarf", "tailored_pants", "running_shoes", "training_shoes"));
        p.put("beach", new Profile(BEACH, 3, notForBeach));
        p.put("vacation", new Profile(BEACH, 2, notForBeach));
        p.put("home", new Profile(Set.of("sweatpants", "jogger_pants", "hoodie", "sweatshirt", "t_shirt", "leggings", "socks",
                "flip_flops"), 2, union(FORMAL, Set.of("combat_boots"))));
        Profile office = new Profile(Set.of("blazer", "shirt", "polo_shirt", "blouse", "chino_pants", "tailored_pants", "loafers",
                "flats", "oxford_shoes", "derby_shoes", "dress", "skirt", "cardigan"), 2, VERY_CASUAL);
        for (String o : List.of("work", "business", "formal", "wedding", "ceremony")) {
            p.put(o, office);
        }
        Profile study = new Profile(Set.of("t_shirt", "jeans", "casual_sneakers", "backpack", "hoodie", "sweatshirt", "casual_pants",
                "cargo_pants"), 1.5, Set.of("heels", "tie", "bow_tie", "clutch"));
        p.put("university", study);
        p.put("school", study);
        Profile night = new Profile(Set.of("dress", "blouse", "shirt", "heels", "jeans", "skirt", "loafers", "clutch", "earrings",
                "necklace", "bodysuit"), 1.5, Set.of("running_shoes", "training_shoes", "basketball_shoes", "sweatpants", "jogger_pants",
                "flip_flops", "leggings", "socks"));
        for (String o : List.of("date", "social", "party", "night_out", "festival")) {
            p.put(o, night);
        }
        p.put("travel", new Profile(Set.of("jeans", "t_shirt", "casual_sneakers", "jacket", "backpack", "cardigan", "jogger_pants",
                "crossbody_bag"), 1.5, Set.of("heels", "tie", "bow_tie", "clutch")));
        Profile easy = new Profile(Set.of("t_shirt", "jeans", "casual_sneakers", "shorts", "cap", "polo_shirt"), 1, Set.of("tie", "bow_tie"));
        p.put("casual", easy);
        p.put("outdoor", easy);
        return Map.copyOf(p);
    }

    /** Estilos que o humor pede (as células mandam Confortável/Elegante). */
    static List<String> moodStyles(String mood) {
        if (mood == null) {
            return List.of();
        }
        return switch (mood) {
            case "ELEGANT" -> List.of("chic", "classic", "tailored", "glam", "luxury");
            case "COMFORTABLE" -> List.of("basic", "athleisure", "sporty", "minimalist");
            case "SOPHISTICATED" -> List.of("chic", "minimalist", "classic", "tailored");
            case "ENERGETIC" -> List.of("streetwear", "sporty", "statement", "y2k");
            default -> List.of();
        };
    }

    @SafeVarargs
    private static Set<String> union(Set<String>... sets) {
        Set<String> u = new HashSet<>();
        for (Set<String> s : sets) {
            u.addAll(s);
        }
        return Set.copyOf(u);
    }
}
