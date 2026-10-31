package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.application.service.WardrobeService.Prefill;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Pré-preenchimento do formulário da peça (RF4) a partir do palpite da análise, com os padrões da taxonomia. */
final class PiecePrefill {
    private PiecePrefill() {
    }

    /**
     * RF4 — "Analisar peça" preenche TODOS os campos, sem exceção: o que a IA reconheceu com confiança entra como está;
     * o resto entra com o melhor palpite dela ou com o padrão da taxonomia (categoria pela subcategoria, ocasião e
     * estilo pelo tipo da peça, tamanho M, preço estimado pelo tipo). Nada fica em branco; a pessoa confere antes de salvar.
     * Ocasião e estilo saem sempre de dentro da taxonomia — o que a IA sugeriu (já filtrado) ou o padrão do tipo.
     */
    static Prefill prefill(LocalVision.PieceGuess g, Map<String, Object> logo) {
        return prefill(g, logo, List.of(), null, List.of());
    }

    static Prefill prefill(LocalVision.PieceGuess g, Map<String, Object> logo, List<Map<String, Object>> candidates,
                           Map<String, Object> brandSearch, List<Map<String, Object>> photoChecks) {
        Map<String, Double> c = g.confidence() == null ? Map.of() : g.confidence();
        boolean manual = g.overall() < LocalVision.PREFILL_CONFIDENCE;
        String sub = firstNonBlank(keep(g.subcategory(), c.get("subcategory")), g.subcategory());
        String category = firstNonBlank(keep(g.category(), c.get("category")), g.category(), sub == null ? null : Taxonomy.categoryOf(sub));
        if (category == null || !Taxonomy.SUBCATEGORIES.containsKey(category)) {
            category = "upper_piece";
        }
        if (sub == null || !Taxonomy.SUBCATEGORIES.get(category).contains(sub)) {
            sub = Taxonomy.SUBCATEGORIES.get(category).get(0);
        }
        String color = firstNonBlank(keep(g.color(), c.get("color")), g.color(),
                g.palette() == null || g.palette().isEmpty() ? null : g.palette().get(0), "black");
        if (!Taxonomy.COLORS.containsKey(color)) {
            color = "black";
        }
        String material = firstNonBlank(keep(g.material(), c.get("material")), g.material(), defaultMaterial(category, sub));
        String brand = firstNonBlank(keep(g.brand(), c.get("brand")), g.brand(), Msg.t("wardrobe.sem_marca"));
        String sex = g.sex() != null && Taxonomy.SEXES.contains(g.sex()) ? g.sex() : "UNISSEX";
        LocalVision.Insights seen = g.insights();
        String name = firstNonBlank(seen.name(), pieceName(sub, color));
        List<String> allowedOccasions = Taxonomy.allowedOccasions(category);
        List<String> occasion = Taxonomy.keepAllowed(seen.occasion(), allowedOccasions, 2);
        if (occasion.isEmpty()) {
            occasion = List.of(allowedOccasions.get(0));
        }
        List<String> style = Taxonomy.keepAllowed(seen.style(), Taxonomy.STYLES, 2);
        if (style.isEmpty()) {
            style = List.of(defaultStyle(sub));
        }
        return new Prefill(name, category, sub, color, material, brand, sex, occasion, style, List.of(), c, g.overall(), manual,
                manual ? Msg.t("wardrobe.a_ia_nao_reconheceu_a") : null, logo, "m", estimatedPrice(category, sub),
                candidates == null ? List.of() : candidates, brandSearch, photoChecks == null ? List.of() : photoChecks,
                TaxonomyRegistry.get().isVariationOf(sub, seen.variation()) ? seen.variation() : null,
                seen.variation() == null ? null : seen.variationConfidence(),
                Taxonomy.variationErrors(category, sub, null, seen.attributes()).isEmpty() ? seen.attributes() : Map.of());
    }

    static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private static final Set<String> SPORTY = Set.of("running_shoes", "training_shoes", "basketball_shoes", "skate_shoes", "sweatpants",
            "jogger_pants", "leggings", "sweatshirt", "hoodie", "tank_top", "cap", "socks");
    private static final Set<String> CLASSIC = Set.of("blazer", "shirt", "tailored_pants", "chino_pants", "loafers", "oxford_shoes",
            "derby_shoes", "moccasins", "tie", "bow_tie", "coat", "watch", "belt", "dress", "heels", "flats");
    private static final Set<String> STREET = Set.of("cargo_pants", "denim_shorts", "high_top_sneakers", "casual_sneakers", "bermuda_shorts",
            "windbreaker", "beanie", "backpack", "parka");

    /**
     * Estilo mais provável pelo tipo da peça (quando a IA não o reconhece). Sempre um código de {@link Taxonomy#STYLES}:
     * "casual" é ocasião, não estilo — devolvê-lo aqui fazia o cadastro falhar com "Valor fora da taxonomia: casual".
     */
    static String defaultStyle(String sub) {
        if (SPORTY.contains(sub)) {
            return "sporty";
        }
        if (STREET.contains(sub)) {
            return "streetwear";
        }
        // "casual" é OCASIÃO, não estilo: a peça do dia a dia sem estilo marcado é "basic" (taxonomia §01, estilos)
        return CLASSIC.contains(sub) ? "classic" : "basic";
    }

    static String defaultMaterial(String category, String sub) {
        if ("shoes_piece".equals(category)) {
            return Set.of("sandals", "flip_flops", "espadrilles").contains(sub) ? "SYNTHETIC" : "LEATHER";
        }
        if ("accessory_piece".equals(category)) {
            return Set.of("scarf", "beanie", "socks", "gloves", "cap", "hat", "tie", "bow_tie").contains(sub) ? "COTTON" : "SYNTHETIC";
        }
        return Set.of("jeans", "denim_shorts").contains(sub) ? "COTTON" : Set.of("sweater", "cardigan", "coat").contains(sub) ? "WOOL"
                : Set.of("blazer", "tailored_pants", "parka", "windbreaker", "leggings").contains(sub) ? "POLYESTER" : "COTTON";
    }

    /** Preço estimado (R$) por tipo da peça — só um ponto de partida que a pessoa confere. */
    static BigDecimal estimatedPrice(String category, String sub) {
        Map<String, Integer> bySub = Map.ofEntries(Map.entry("t_shirt", 79), Map.entry("shirt", 149), Map.entry("blouse", 129),
                Map.entry("blazer", 349), Map.entry("jacket", 299), Map.entry("coat", 449), Map.entry("hoodie", 179), Map.entry("sweater", 199),
                Map.entry("jeans", 199), Map.entry("tailored_pants", 229), Map.entry("shorts", 99), Map.entry("skirt", 139),
                Map.entry("casual_sneakers", 299), Map.entry("running_shoes", 399), Map.entry("heels", 249), Map.entry("ankle_boots", 349), Map.entry("boots", 349),
                Map.entry("handbag", 249), Map.entry("backpack", 199), Map.entry("watch", 399), Map.entry("sunglasses", 199),
                Map.entry("dress", 249), Map.entry("jumpsuit", 229));
        Integer v = bySub.get(sub);
        if (v == null) {
            v = switch (category) {
                case "lower_piece" -> 169;
                case "shoes_piece" -> 249;
                case "accessory_piece" -> 99;
                case "full_body_piece" -> 229;
                default -> 129;
            };
        }
        return BigDecimal.valueOf(v);
    }

    private static String keep(String value, Double confidence) {
        return value != null && confidence != null && confidence >= LocalVision.PREFILL_CONFIDENCE ? value : null;
    }

    /** Nome da peça sem IA, no idioma de quem cadastra: "Camiseta azul", "Calça jeans azul-marinho". */
    static String pieceName(String sub, String color) {
        return label(sub) + " " + label(color).toLowerCase(Msg.locale());
    }

    /** Rótulo da taxonomia no idioma corrente (catálogo i18n); sem rótulo, o código legível. */
    static String label(String code) {
        String t = Msg.t("taxonomy." + code);
        return t.equals("taxonomy." + code) ? humanize(code) : t;
    }

    static String humanize(String code) {
        String s = code.replace('_', ' ');
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
