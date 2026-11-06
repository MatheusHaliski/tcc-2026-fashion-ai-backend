package br.com.fashionai.application.piece3d;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Catálogo das peças base por categoria/subcategoria. Espelha {@code lib/atelier3d/base-pieces.ts}: cada subcategoria
 * tem uma base (GLB publicado em {@code public/garment-templates/<subcategoria>.glb} ou base procedural). A pessoa
 * modela a edição por cima da base; a chave {@code template:<subcategoria>@<versão>} identifica a base usada.
 */
public final class BasePieceCatalog {
    public static final int VERSION = 1;
    private static final Pattern KEY = Pattern.compile("template:([a-z_]+)@(\\d+)");
    private static final Map<String, List<String>> SUBCATEGORIES = Map.of(
            "upper_piece", List.of("t_shirt", "shirt", "blouse", "tank_top", "top", "crop_top", "polo_shirt", "bodysuit", "sweater", "sweatshirt",
                    "hoodie", "cardigan", "vest", "blazer", "jacket", "coat", "parka", "windbreaker", "kimono"),
            "lower_piece", List.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants", "leggings",
                    "culottes", "shorts", "bermuda_shorts", "denim_shorts", "skirt", "skort"),
            "full_body_piece", List.of("dress", "jumpsuit", "romper", "matching_set", "overalls"),
            "shoes_piece", List.of("casual_sneakers", "high_top_sneakers", "running_shoes", "training_shoes", "basketball_shoes", "skate_shoes", "loafers",
                    "moccasins", "oxford_shoes", "derby_shoes", "boots", "ankle_boots", "long_boots", "combat_boots", "sandals", "flip_flops", "heels", "flats", "espadrilles"),
            "accessory_piece", List.of("handbag", "tote_bag", "clutch", "backpack", "crossbody_bag", "belt", "cap", "hat", "beanie", "scarf", "tie", "bow_tie",
                    "sunglasses", "eyeglasses", "necklace", "bracelet", "earrings", "ring", "watch", "wallet", "gloves", "socks", "hair_accessory"));
    private static final Map<String, String> DEFAULTS = Map.of("upper_piece", "t_shirt", "lower_piece", "casual_pants", "full_body_piece", "dress",
            "shoes_piece", "casual_sneakers", "accessory_piece", "handbag");

    private BasePieceCatalog() { }

    /** Subcategoria base efetiva: a própria quando tem base; senão a padrão da categoria; vazio se a categoria não tem bases. */
    public static Optional<String> resolve(String category, String subcategory) {
        String cat = category == null ? "" : category.toLowerCase(Locale.ROOT);
        List<String> list = SUBCATEGORIES.get(cat);
        if (list == null) return Optional.empty();
        String sub = subcategory == null ? "" : subcategory.toLowerCase(Locale.ROOT);
        return Optional.of(list.contains(sub) ? sub : DEFAULTS.get(cat));
    }

    public static String key(String subcategory) {
        return "template:" + subcategory + "@" + VERSION;
    }

    public static boolean isKey(String value) {
        return value != null && KEY.matcher(value).matches();
    }

    public static List<String> subcategories(String category) {
        return SUBCATEGORIES.getOrDefault(category, List.of());
    }
}
