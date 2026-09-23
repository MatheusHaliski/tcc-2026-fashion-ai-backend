package br.com.fashionai.application.taxonomy;

import br.com.fashionai.application.common.ApiException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Taxonomia oficial (taxonomias_fashion_ai_v5.html, v3.7) — códigos destinados ao banco e à API.
 * Espelhada no frontend em lib/taxonomy.ts. Valida categoria/subcategoria, cor, tamanho, material,
 * mercado, ocasião e estilo, incluindo os tetos de cardinalidade da §01.
 */
public final class Taxonomy {
    public static final Map<String, List<String>> SUBCATEGORIES = new LinkedHashMap<>();
    public static final Set<String> SNEAKERS = Set.of("casual_sneakers", "running_shoes", "training_shoes",
            "basketball_shoes", "skate_shoes", "high_top_sneakers");
    /** Subcategorias rígidas — nunca vão ao FASHN.ai, vão ao Category Fallback Compositor (RF18 #18). */
    public static final Set<String> RIGID_SUBCATEGORIES = Set.of("handbag", "crossbody_bag", "tote_bag", "clutch",
            "backpack", "sunglasses", "eyeglasses", "necklace", "bracelet", "earrings", "ring", "watch", "hat", "cap");
    public static final List<String> OCCASIONS = List.of("casual", "work", "business", "formal", "party", "night_out",
            "date", "wedding", "ceremony", "sport", "gym", "travel", "beach", "vacation", "school", "university",
            "social", "home", "outdoor", "festival");
    public static final List<String> STYLES = List.of("classic", "minimalist", "modern", "chic", "streetwear", "sporty",
            "athleisure", "preppy", "romantic", "boho", "vintage", "grunge", "edgy", "glam", "luxury", "avant_garde",
            "y2k", "utility", "techwear", "tailored", "urban", "resort", "basic", "statement", "futuristic");
    public static final List<String> MATERIALS = List.of("COTTON", "POLYESTER", "WOOL", "SILK", "LEATHER", "SYNTHETIC", "BLEND");
    public static final List<String> SEXES = List.of("MASCULINO", "FEMININO", "UNISSEX");
    public static final Map<String, String> COLORS = new LinkedHashMap<>();
    public static final Map<String, String> COLOR_FAMILY = new LinkedHashMap<>();
    public static final List<String> SIZES = List.of("xs", "s", "m", "l", "xl", "xxl", "br_34", "br_36", "br_38", "br_40",
            "br_42", "br_44", "br_46", "br_48", "br_50", "br_52", "shoe_33", "shoe_34", "shoe_35", "shoe_36", "shoe_37",
            "shoe_38", "shoe_39", "shoe_40", "shoe_41", "shoe_42", "shoe_43", "shoe_44", "shoe_45", "shoe_46", "one_size");
    public static final List<String> MARKET_SEASONS = List.of("spring", "summer", "autumn", "winter");
    public static final List<String> MARKET_GENDERS = List.of("male", "female", "unisex");

    static {
        SUBCATEGORIES.put("upper_piece", List.of("t_shirt", "shirt", "blouse", "tank_top", "crop_top", "polo_shirt",
                "bodysuit", "sweater", "sweatshirt", "hoodie", "cardigan", "vest", "blazer", "jacket", "coat", "parka",
                "windbreaker", "kimono"));
        SUBCATEGORIES.put("lower_piece", List.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants",
                "jogger_pants", "sweatpants", "leggings", "culottes", "shorts", "bermuda_shorts", "denim_shorts", "skirt", "skort"));
        SUBCATEGORIES.put("shoes_piece", List.of("casual_sneakers", "running_shoes", "training_shoes", "basketball_shoes",
                "skate_shoes", "high_top_sneakers", "loafers", "moccasins", "oxford_shoes", "derby_shoes", "ankle_boots",
                "long_boots", "combat_boots", "sandals", "flip_flops", "heels", "flats", "espadrilles"));
        SUBCATEGORIES.put("accessory_piece", List.of("handbag", "crossbody_bag", "tote_bag", "clutch", "backpack", "belt",
                "cap", "hat", "beanie", "scarf", "tie", "bow_tie", "sunglasses", "eyeglasses", "necklace", "bracelet",
                "earrings", "ring", "watch", "gloves", "socks", "hair_accessory"));
        SUBCATEGORIES.put("full_body_piece", List.of("dress", "jumpsuit", "romper", "matching_set", "overalls"));

        Object[][] colors = {
                {"Preto", "black", "#12100F"}, {"Preto", "charcoal", "#36373B"}, {"Preto", "washed_black", "#2E2B2A"},
                {"Branco", "white", "#FFFFFF"}, {"Branco", "off_white", "#F3EFE7"}, {"Branco", "ivory", "#FAF4E4"}, {"Branco", "cream", "#F0E4CB"},
                {"Cinza", "light_gray", "#D5D2CD"}, {"Cinza", "gray", "#8C8A87"}, {"Cinza", "dark_gray", "#54524F"}, {"Cinza", "silver", "#C3C6C9"},
                {"Azul", "blue", "#2A5FA8"}, {"Azul", "navy", "#1B2A4A"}, {"Azul", "light_blue", "#A9C7E4"}, {"Azul", "sky_blue", "#7EC0E8"},
                {"Azul", "cobalt", "#0B4FC4"}, {"Azul", "denim", "#4A6A8C"}, {"Azul", "teal", "#16666B"},
                {"Vermelho", "red", "#C62B28"}, {"Vermelho", "crimson", "#D6244A"}, {"Vermelho", "burgundy", "#6B1220"},
                {"Vermelho", "maroon", "#87313F"}, {"Vermelho", "rust", "#B05330"},
                {"Rosa", "pink", "#EFA8BC"}, {"Rosa", "hot_pink", "#E0367E"}, {"Rosa", "rose", "#D79A9A"}, {"Rosa", "coral", "#F07F63"}, {"Rosa", "salmon", "#F2A18B"},
                {"Laranja", "orange", "#E8722A"}, {"Laranja", "terracotta", "#C4674A"}, {"Laranja", "amber", "#D99418"}, {"Laranja", "apricot", "#F2C09A"},
                {"Amarelo", "yellow", "#E8C93C"}, {"Amarelo", "mustard", "#B8912A"}, {"Amarelo", "gold", "#C9A227"}, {"Amarelo", "butter", "#F2E5A8"},
                {"Verde", "green", "#2F7A45"}, {"Verde", "olive", "#6E7A3C"}, {"Verde", "military_green", "#4A5340"}, {"Verde", "forest_green", "#1C4429"},
                {"Verde", "mint", "#A9DFC2"}, {"Verde", "sage", "#A3B191"}, {"Verde", "emerald", "#187A5F"},
                {"Roxo", "purple", "#6B3F9E"}, {"Roxo", "violet", "#8046D6"}, {"Roxo", "lilac", "#C4A5D6"}, {"Roxo", "lavender", "#DCD5EC"}, {"Roxo", "plum", "#6E3552"},
                {"Marrom", "brown", "#5B3B28"}, {"Marrom", "chocolate", "#4A2C1A"}, {"Marrom", "camel", "#B98E5E"}, {"Marrom", "tan", "#C7A175"},
                {"Marrom", "beige", "#DFCDB0"}, {"Marrom", "taupe", "#7A6B5D"},
                {"Especiais", "metallic_gold", "#C8A64B"}, {"Especiais", "metallic_silver", "#B8BCC0"}, {"Especiais", "bronze", "#9C6B3C"},
                {"Especiais", "multicolor", "#9A9A9A"}, {"Especiais", "print", "#8A8A8A"}};
        for (Object[] c : colors) {
            COLORS.put((String) c[1], (String) c[2]);
            COLOR_FAMILY.put((String) c[1], (String) c[0]);
        }
    }

    private Taxonomy() {
    }

    public static boolean isValidCategory(String category) {
        return SUBCATEGORIES.containsKey(category);
    }

    public static String categoryOf(String subcategory) {
        return SUBCATEGORIES.entrySet().stream().filter(e -> e.getValue().contains(subcategory)).map(Map.Entry::getKey)
                .findFirst().orElse(null);
    }

    public static void requirePiece(String category, String subcategory, String sex, String color, String material,
                                    String size, List<String> occasions, List<String> styles) {
        Map<String, Object> errors = new LinkedHashMap<>();
        if (!isValidCategory(category)) {
            errors.put("category", "Categoria inválida.");
        } else if (!SUBCATEGORIES.get(category).contains(subcategory)) {
            errors.put("subcategory", "Subcategoria não pertence à categoria escolhida.");
        }
        if (!SEXES.contains(sex)) {
            errors.put("sex", "Campo sexo é obrigatório (Masculino, Feminino ou Unissex).");
        }
        if (!COLORS.containsKey(color)) {
            errors.put("color", "Selecione uma cor da paleta oficial.");
        }
        if (!MATERIALS.contains(material)) {
            errors.put("material", "Selecione um material válido.");
        }
        if (size == null || !SIZES.contains(size)) {
            errors.put("size", "Selecione um tamanho válido.");
        }
        requireTags("occasion", occasions, OCCASIONS, 2, errors);
        requireTags("style", styles, STYLES, 2, errors);
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", "Corrija os campos destacados.", errors);
        }
    }

    public static void requireTags(String field, List<String> values, List<String> allowed, int max, Map<String, Object> errors) {
        if (values == null || values.isEmpty()) {
            errors.put(field, "Informe ao menos 1 valor.");
            return;
        }
        if (values.size() > max) {
            errors.put(field, "Máximo de " + max + " valores (taxonomia §01).");
            return;
        }
        for (String v : values) {
            if (!allowed.contains(v)) {
                errors.put(field, "Valor fora da taxonomia: " + v);
                return;
            }
        }
    }

    public static boolean isValidMarket(String market) {
        if (market == null) {
            return true;
        }
        String[] parts = market.split("_");
        return parts.length == 2 && MARKET_SEASONS.contains(parts[0]) && MARKET_GENDERS.contains(parts[1]);
    }

    public static String hex(String color) {
        return COLORS.getOrDefault(color, "#999999");
    }
}
