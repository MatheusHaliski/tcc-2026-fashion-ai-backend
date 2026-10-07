package br.com.fashionai.application.taxonomy;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Taxonomia oficial — códigos destinados ao banco e à API (docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md). Categorias,
 * subcategorias ATIVAS, variações e dimensões de atributo vêm do {@link TaxonomyRegistry} (taxonomy/taxonomy.json);
 * cores, estilos, ocasiões, sexos e tamanhos continuam aqui. O frontend lê tudo por GET /api/taxonomy (lib/api/taxonomy.ts).
 * Valida categoria/subcategoria/variação, atributos, cor, tamanho, material, mercado, ocasião e estilo, incluindo os
 * tetos de cardinalidade (peça ≤ 2 estilos e ≤ 2 ocasiões; esquema ≤ 3).
 */
public final class Taxonomy {
    /** categoria → subcategorias ATIVAS (as LEGACY, como bermuda_shorts, continuam válidas: ver {@link #isSubcategoryOf}). */
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
    /** Materiais oferecidos (formulário, IA); SYNTHETIC e BLEND são legado: aceitos nos dados, fora das listas. */
    public static final List<String> MATERIALS = TaxonomyRegistry.get().dimension("MATERIAL").orElseThrow().values().stream()
            .filter(v -> !v.legacy()).map(TaxonomyRegistry.Value::code).toList();
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
        SUBCATEGORIES.putAll(TaxonomyRegistry.get().activeSubcategories());

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

    /** Categoria de uma subcategoria ativa ou LEGACY (null se o código não existe). */
    public static String categoryOf(String subcategory) {
        return TaxonomyRegistry.get().categoryOf(subcategory);
    }

    /** Subcategoria (ativa ou LEGACY) da categoria — dado antigo com código legado continua válido. */
    public static boolean isSubcategoryOf(String category, String subcategory) {
        return category != null && subcategory != null && category.equals(categoryOf(subcategory));
    }

    /** Subcategoria no padrão novo: LEGACY → a que a substitui (bermuda_shorts → shorts); ativa ou desconhecida → ela mesma. */
    public static String activeSubcategory(String subcategory) {
        TaxonomyRegistry.Resolved r = TaxonomyRegistry.get().resolve(subcategory);
        return r == null ? subcategory : r.subcategory();
    }

    /** Código de subcategoria conhecido (ativo ou LEGACY). */
    public static boolean isSubcategory(String subcategory) {
        return categoryOf(subcategory) != null;
    }

    /** Material conhecido, inclusive os de legado (SYNTHETIC, BLEND). */
    public static boolean isMaterial(String material) {
        return TaxonomyRegistry.get().dimension("MATERIAL").flatMap(d -> d.value(material)).isPresent();
    }

    public static void requirePiece(String category, String subcategory, String sex, String color, String material,
                                    String size, List<String> occasions, List<String> styles) {
        Map<String, Object> errors = pieceErrors(category, subcategory, sex, color, material, size, occasions, styles);
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
    }

    /** Todos os erros de taxonomia da peça de uma vez (o serviço junta com nome e preço numa só resposta). */
    public static Map<String, Object> pieceErrors(String category, String subcategory, String sex, String color, String material,
                                                  String size, List<String> occasions, List<String> styles) {
        Map<String, Object> errors = new LinkedHashMap<>();
        if (!isValidCategory(category)) {
            errors.put("category", Msg.t("taxonomy.categoria_invalida"));
        } else if (!isSubcategoryOf(category, subcategory)) {
            errors.put("subcategory", Msg.t("taxonomy.subcategoria_nao_pertence_a_categoria"));
        }
        if (sex == null || !SEXES.contains(sex)) {
            errors.put("sex", Msg.t("taxonomy.campo_sexo_e_obrigatorio_masculino"));
        }
        if (color == null || !COLORS.containsKey(color)) {
            errors.put("color", Msg.t("taxonomy.selecione_uma_cor_da_paleta"));
        }
        if (material == null || !isMaterial(material)) {
            errors.put("material", Msg.t("taxonomy.selecione_um_material_valido"));
        }
        if (size == null || !SIZES.contains(size)) {
            errors.put("size", Msg.t("taxonomy.selecione_um_tamanho_valido"));
        }
        requireTags("occasion", occasions, allowedOccasions(category), MAX_PIECE_TAGS, errors, "peca", category);
        requireTags("style", styles, STYLES, MAX_PIECE_TAGS, errors, "peca", category);
        return errors;
    }

    /** Dimensões que a peça guarda em colunas/campos próprios (não entram no mapa de atributos). */
    public static final java.util.Set<String> FIELD_DIMENSIONS = java.util.Set.of("COLOR", "MATERIAL", "GENDER", "STYLE", "OCCASION");

    /**
     * Variação e atributos da peça (docs/taxonomia, C.6–C.7), com a subcategoria já no padrão novo. A variação tem de ser
     * da subcategoria; cada dimensão tem de valer para a peça, com valores do vocabulário e no máximo o teto da dimensão;
     * salto incoerente com a subcategoria (salto rasteiro em "heels", salto alto em "flats") é recusado.
     */
    public static Map<String, Object> variationErrors(String category, String subcategory, String variation,
                                                      Map<String, List<String>> attributes) {
        Map<String, Object> errors = new LinkedHashMap<>();
        TaxonomyRegistry reg = TaxonomyRegistry.get();
        if (variation != null && !reg.isVariationOf(subcategory, variation)) {
            errors.put("variation", Msg.t("taxonomy.variacao_nao_pertence", label(variation), label(subcategory)));
        }
        Map<String, Object> attrErrors = new LinkedHashMap<>();
        (attributes == null ? Map.<String, List<String>>of() : attributes).forEach((dim, values) -> {
            TaxonomyRegistry.Dimension d = reg.dimension(dim).orElse(null);
            List<String> distinct = values == null ? List.of() : values.stream().filter(java.util.Objects::nonNull).distinct().toList();
            if (d == null || FIELD_DIMENSIONS.contains(dim)) {
                attrErrors.put(dim, Msg.t("taxonomy.atributo_desconhecido", dim));
            } else if (!reg.applies(d, category, subcategory)) {
                attrErrors.put(dim, Msg.t("taxonomy.atributo_nao_se_aplica", label(dim), label(subcategory)));
            } else if (distinct.size() > d.maxPerPiece()) {
                attrErrors.put(dim, Msg.t("taxonomy.atributo_maximo", label(dim), d.maxPerPiece()));
            } else {
                distinct.stream().filter(v -> !reg.isAllowed(dim, v, category, subcategory)).findFirst()
                        .ifPresent(v -> attrErrors.put(dim, Msg.t("taxonomy.atributo_valor_invalido", v, label(dim))));
            }
        });
        List<String> heel = attributes == null ? null : attributes.get("HEEL_HEIGHT");
        if (heel != null && !attrErrors.containsKey("HEEL_HEIGHT")
                && (("heels".equals(subcategory) && heel.contains("FLAT")) || ("flats".equals(subcategory) && !heel.isEmpty() && !heel.contains("FLAT")))) {
            attrErrors.put("HEEL_HEIGHT", Msg.t("taxonomy.salto_incoerente", label(subcategory)));
        }
        if (!attrErrors.isEmpty()) {
            errors.put("attributes", attrErrors);
        }
        return errors;
    }

    /** Peça (ClothesPiece): até 2 ocasiões e até 2 estilos. Esquema de vestimenta (look): até 3 de cada. */
    public static final int MAX_PIECE_TAGS = 2;
    public static final int MAX_SCHEME_TAGS = 3;

    /** Versão genérica (esquemas de vestimenta). */
    public static void requireTags(String field, List<String> values, List<String> allowed, int max, Map<String, Object> errors) {
        requireTags(field, values, allowed, max, errors, "look", null);
    }

    /**
     * Valida uma lista de códigos (ocasião ou estilo) com mensagens que a pessoa entende e consegue corrigir — nunca
     * "valor fora da taxonomia". Duplicatas contam uma vez. `context` = "peca" ou "look" (limites e textos diferentes).
     * Quando o valor pertence ao OUTRO campo (ex.: "casual", que é ocasião, enviado como estilo), a mensagem diz isso.
     */
    public static void requireTags(String field, List<String> values, List<String> allowed, int max, Map<String, Object> errors,
                                   String context, String category) {
        List<String> distinct = canonicalTags(values);
        boolean style = "style".equals(field);
        String base = "taxonomy." + context + "." + (style ? "estilo" : "ocasiao");
        if (distinct.isEmpty()) {
            errors.put(field, Msg.t(base + ".obrigatorio", max));
            return;
        }
        if (distinct.size() > max) {
            errors.put(field, Msg.t(base + ".maximo", max));
            return;
        }
        for (String v : distinct) {
            if (allowed.contains(v)) {
                continue;
            }
            if (style && OCCASIONS.contains(v)) {
                errors.put(field, Msg.t("taxonomy.e_ocasiao_nao_estilo", label(v)));
            } else if (!style && STYLES.contains(v)) {
                errors.put(field, Msg.t("taxonomy.e_estilo_nao_ocasiao", label(v)));
            } else if (!style && OCCASIONS.contains(v) && category != null) {
                errors.put(field, Msg.t("taxonomy.ocasiao_fora_da_categoria", label(v), label(category)));
            } else {
                errors.put(field, Msg.t(style ? "taxonomy.estilo_desconhecido" : "taxonomy.ocasiao_desconhecida", v));
            }
            return;
        }
    }

    /** Códigos canônicos: sem espaços, minúsculos, sem vazios e sem repetição (a ordem da pessoa é mantida). */
    public static List<String> canonicalTags(List<String> values) {
        if (values == null) {
            return List.of();
        }
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                out.add(v.trim().toLowerCase(java.util.Locale.ROOT));
            }
        }
        return List.copyOf(out);
    }

    /**
     * Lista de ocasiões/estilos como a tela manda: tira espaços, vazios e repetidos e passa para minúsculas (os códigos da
     * taxonomia são minúsculos). Não inventa nem descarta códigos desconhecidos — a validação continua apontando-os.
     */
    public static List<String> normalizeTags(List<String> values) {
        return canonicalTags(values);
    }

    /** Só os códigos permitidos, na ordem recebida, até {@code max} (palpites da IA: nada fora da taxonomia entra). */
    public static List<String> keepAllowed(List<String> values, List<String> allowed, int max) {
        return canonicalTags(values).stream().filter(allowed::contains).limit(max).toList();
    }

    /**
     * Rótulo do código na língua de quem lê: messages*.properties (taxonomy.&lt;código&gt;), senão o rótulo da taxonomia
     * (variações e valores novos), senão o próprio código.
     */
    public static String label(String code) {
        String key = "taxonomy." + code;
        String l = Msg.t(key);
        if (!key.equals(l)) {
            return l;
        }
        return TaxonomyRegistry.get().label(code, Msg.locale()).orElse(code);
    }

    /**
     * Ocasiões da peça: as 20, em qualquer categoria (seção I.11 da auditoria). A restrição por parte do corpo bloqueava
     * usos legítimos (gravata no trabalho, calça na festa); o parâmetro fica para compatibilidade.
     */
    public static List<String> allowedOccasions(String category) {
        return OCCASIONS;
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
