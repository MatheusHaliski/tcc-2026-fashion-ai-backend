package br.com.fashionai.application.taxonomy;

import br.com.fashionai.application.common.Msg;
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

    /**
     * RF4.CA09 / RF5.CA07 — wearstyles restritos por parte do corpo (04-telas-artefatos-e-pranchas.md, artefato #7,
     * "proposta a validar"). Cada wearstyle agrupa códigos de ocasião da taxonomia §01.
     */
    public static final Map<String, List<String>> WEARSTYLE_GROUPS = new LinkedHashMap<>();
    public static final Map<String, List<String>> WEARSTYLES_BY_PART = new LinkedHashMap<>();

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

        WEARSTYLE_GROUPS.put("casual", List.of("casual", "home", "school", "university", "travel", "outdoor", "vacation"));
        WEARSTYLE_GROUPS.put("social", List.of("social", "formal", "business", "wedding", "ceremony", "date"));
        WEARSTYLE_GROUPS.put("esporte", List.of("sport", "gym", "outdoor"));
        WEARSTYLE_GROUPS.put("festa", List.of("party", "night_out", "festival", "date"));
        WEARSTYLE_GROUPS.put("trabalho", List.of("work", "business"));
        WEARSTYLE_GROUPS.put("praia", List.of("beach", "vacation", "travel"));
        WEARSTYLES_BY_PART.put("accessory_piece", List.of("casual", "esporte", "praia", "festa"));
        WEARSTYLES_BY_PART.put("upper_piece", List.of("casual", "social", "esporte", "festa", "trabalho", "praia"));
        WEARSTYLES_BY_PART.put("lower_piece", List.of("casual", "social", "esporte", "trabalho", "praia"));
        WEARSTYLES_BY_PART.put("shoes_piece", List.of("casual", "social", "esporte", "festa", "praia"));
        WEARSTYLES_BY_PART.put("full_body_piece", List.of("casual", "social", "esporte", "festa", "trabalho", "praia"));

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
        return category != null && SUBCATEGORIES.containsKey(category);
    }

    public static String categoryOf(String subcategory) {
        return SUBCATEGORIES.entrySet().stream().filter(e -> e.getValue().contains(subcategory)).map(Map.Entry::getKey)
                .findFirst().orElse(null);
    }

    public static void requirePiece(String category, String subcategory, String sex, String color, String material,
                                    String size, List<String> occasions, List<String> styles) {
        Map<String, Object> errors = new LinkedHashMap<>();
        if (!isValidCategory(category)) {
            errors.put("category", Msg.t("taxonomy.categoria_invalida"));
        } else if (subcategory == null || !SUBCATEGORIES.get(category).contains(subcategory)) {
            errors.put("subcategory", Msg.t("taxonomy.subcategoria_nao_pertence_a_categoria"));
        }
        if (sex == null || !SEXES.contains(sex)) {
            errors.put("sex", Msg.t("taxonomy.campo_sexo_e_obrigatorio_masculino"));
        }
        if (color == null || !COLORS.containsKey(color)) {
            errors.put("color", Msg.t("taxonomy.selecione_uma_cor_da_paleta"));
        }
        if (material == null || !MATERIALS.contains(material)) {
            errors.put("material", Msg.t("taxonomy.selecione_um_material_valido"));
        }
        if (size == null || !SIZES.contains(size)) {
            errors.put("size", Msg.t("taxonomy.selecione_um_tamanho_valido"));
        }
        requireTags("occasion", occasions, allowedOccasions(category), 2, errors);
        requireTags("style", styles, STYLES, 2, errors);
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
    }

    public static void requireTags(String field, List<String> values, List<String> allowed, int max, Map<String, Object> errors) {
        if (values == null || values.isEmpty()) {
            errors.put(field, Msg.t("taxonomy.informe_ao_menos_1_valor"));
            return;
        }
        if (values.size() > max) {
            errors.put(field, Msg.t("taxonomy.maximo_de_valores_taxonomia_01", max));
            return;
        }
        for (String v : values) {
            if (!allowed.contains(v)) {
                errors.put(field, Msg.t("taxonomy.valor_fora_da_taxonomia", v));
                return;
            }
        }
    }

    /** Ocasiões permitidas para a parte do corpo (união dos grupos dos wearstyles permitidos). */
    public static List<String> allowedOccasions(String category) {
        List<String> parts = WEARSTYLES_BY_PART.get(category);
        if (parts == null) {
            return OCCASIONS;
        }
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        parts.forEach(w -> out.addAll(WEARSTYLE_GROUPS.get(w)));
        return OCCASIONS.stream().filter(out::contains).toList();
    }

    /** Wearstyle (rótulo de uso) de cada ocasião, para exibição no card. */
    public static List<String> wearstylesOf(String category, List<String> occasions) {
        List<String> allowed = WEARSTYLES_BY_PART.getOrDefault(category, List.copyOf(WEARSTYLE_GROUPS.keySet()));
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        for (String o : occasions == null ? List.<String>of() : occasions) {
            for (String w : allowed) {
                if (WEARSTYLE_GROUPS.get(w).contains(o)) {
                    out.add(w);
                    break;
                }
            }
        }
        return List.copyOf(out);
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
