package br.com.fashionai.application.service;

import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Vocabulário de peça do Copilot (RF10): palavras e prefixos PT/EN/ES de cor, tipo de peça e material que a
 * ferramenta buscar_pecas e o roteador de intenções convertem em códigos da taxonomia. Os termos de base
 * ({@code COLOR_WORDS}, {@code TYPE_WORDS}, {@code MATERIAL_WORDS}, reexportados por {@link CopilotService}) recebem
 * o vocabulário ampliado ({@code COLOR_PREFIXES}, {@code TYPE_PREFIXES}, {@code PIECE_MATERIALS}, reexportados por
 * {@link CopilotLexicon}) sem sobrescrever o que já existe. Cor e tipo seguem a regra de prefixo de
 * {@link CopilotText#startsWithWord}; material, a de palavra inteira de {@link CopilotText#mentions}.
 */
final class CopilotPieceVocabulary {
    /** prefixo → cores da taxonomia (somados a COLOR_WORDS) */
    static final Map<String, Set<String>> COLOR_PREFIXES = new LinkedHashMap<>();
    /** prefixo → subcategorias da taxonomia (somados a TYPE_WORDS) */
    static final Map<String, Set<String>> TYPE_PREFIXES = new LinkedHashMap<>();
    /** termo → material da peça (Taxonomy.MATERIALS, somados a MATERIAL_WORDS) */
    static final Map<String, Set<String>> PIECE_MATERIALS = new LinkedHashMap<>();

    static {
        // ---------------------------------------------------------------- cores (prefixos)
        color("dourad", "gold", "metallic_gold"); color("pratead", "silver", "metallic_silver"); color("bronze", "bronze");
        color("creme", "cream"); color("off white", "off_white"); color("marfim", "ivory"); color("caramel", "camel");
        color("caqui", "tan", "beige"); color("khaki", "tan", "beige"); color("bordo", "burgundy"); color("coral", "coral");
        color("salm", "salmon"); color("mostarda", "mustard"); color("oliva", "olive"); color("esmeralda", "emerald");
        color("turquesa", "teal"); color("petroleo", "teal"); color("lavanda", "lavender"); color("ameixa", "plum");
        color("chocolate", "chocolate"); color("grafite", "charcoal"); color("chumbo", "dark_gray"); color("fucsia", "hot_pink");
        color("terracota", "terracotta"); color("ferrugem", "rust"); color("estampad", "print");
        color("colorid", "multicolor"); color("multicolor", "multicolor"); color("cobalto", "cobalt"); color("celeste", "sky_blue");
        color("indigo", "navy", "denim"); color("sage", "sage"); color("salvia", "sage");

        // ---------------------------------------------------------------- tipos de peça (prefixos)
        type("regata", "tank_top"); type("cropped", "top"); type("polo", "polo_shirt"); type("body", "bodysuit");
        type("sueter", "sweater"); type("cardig", "cardigan"); type("colete", "vest"); type("parka", "parka");
        type("corta vento", "windbreaker"); type("quimono", "kimono"); type("kimono", "kimono"); type("chino", "chino_pants");
        type("calca cargo", "cargo_pants"); type("jogger", "jogger_pants"); type("legging", "leggings"); type("pantacourt", "culottes");
        type("culote", "culottes"); type("saia short", "skort"); type("mocassim", "moccasins"); type("oxford", "oxford_shoes");
        type("derby", "derby_shoes"); type("coturno", "boots"); type("sapatilha", "flats"); type("rasteir", "flats");
        type("chinelo", "flip_flops"); type("alpargata", "espadrilles"); type("espadrille", "espadrilles"); type("scarpin", "heels");
        type("transversal", "handbag"); type("sacola", "tote_bag"); type("clutch", "clutch"); type("gorro", "beanie");
        type("touca", "beanie"); type("cachecol", "scarf"); type("lenco", "scarf"); type("gravata", "tie", "bow_tie");
        type("pulseira", "bracelet"); type("brinco", "earrings"); type("anel", "ring"); type("luva", "gloves");
        type("meias", "socks"); type("tiara", "hair_accessory"); type("presilha", "hair_accessory"); type("macaquinho", "romper");
        type("jardineira", "overalls"); type("sobretudo", "coat");
        type("trench", "coat"); type("bomber", "jacket"); type("jaquetinha", "jacket"); type("bota cano longo", "boots");

        // ---------------------------------------------------------------- materiais da peça
        pieceMaterial("WOOL", "merino", "la merino", "angora");
        pieceMaterial("CASHMERE", "cashmere", "caxemira");
        pieceMaterial("VISCOSE", "viscose", "modal");
        pieceMaterial("NYLON", "poliamida", "microfibra");
        pieceMaterial("ACRYLIC", "acrilico");
        pieceMaterial("FAUX_LEATHER", "couro ecologico", "couro sintetico");
        pieceMaterial("SYNTHETIC", "elastano", "spandex", "lycra", "neoprene");      // genérico de legado: aceito, fora da lista
        pieceMaterial("COTTON", "algodao organico");
        pieceMaterial("FLEECE", "moletinho");
        pieceMaterial("SILK", "seda pura", "mousseline");
        pieceMaterial("BLEND", "misto", "mescla");
    }

    static final Map<String, Set<String>> COLOR_WORDS = new LinkedHashMap<>();
    static final Map<String, Set<String>> TYPE_WORDS = new LinkedHashMap<>();
    static final Map<String, Set<String>> MATERIAL_WORDS = new LinkedHashMap<>();

    static {
        COLOR_WORDS.put("branc", Set.of("white", "off_white", "ivory", "cream"));
        COLOR_WORDS.put("pret", Set.of("black", "charcoal", "washed_black"));
        COLOR_WORDS.put("cinza", Set.of("light_gray", "gray", "dark_gray", "silver"));
        COLOR_WORDS.put("azul", Set.of("blue", "navy", "light_blue", "sky_blue", "cobalt", "denim", "teal"));
        COLOR_WORDS.put("marinho", Set.of("navy"));
        COLOR_WORDS.put("vermelh", Set.of("red", "crimson", "burgundy", "maroon", "rust"));
        COLOR_WORDS.put("vinho", Set.of("burgundy", "maroon"));
        COLOR_WORDS.put("rosa", Set.of("pink", "hot_pink", "rose", "coral", "salmon"));
        COLOR_WORDS.put("laranja", Set.of("orange", "terracotta", "amber", "apricot"));
        COLOR_WORDS.put("amarel", Set.of("yellow", "mustard", "gold", "butter"));
        COLOR_WORDS.put("verde", Set.of("green", "olive", "military_green", "forest_green", "mint", "sage", "emerald"));
        COLOR_WORDS.put("roxo", Set.of("purple", "violet", "lilac", "lavender", "plum"));
        COLOR_WORDS.put("lilás", Set.of("lilac", "lavender"));
        COLOR_WORDS.put("marrom", Set.of("brown", "chocolate", "camel", "tan", "taupe"));
        COLOR_WORDS.put("bege", Set.of("beige", "tan", "camel", "cream"));
        COLOR_WORDS.put("jeans", Set.of("denim"));
        // inglês e espanhol (RF23): mesmos códigos da taxonomia
        COLOR_WORDS.put("white", Set.of("white", "off_white", "ivory", "cream")); COLOR_WORDS.put("black", Set.of("black", "charcoal", "washed_black"));
        COLOR_WORDS.put("gray", Set.of("light_gray", "gray", "dark_gray", "silver")); COLOR_WORDS.put("grey", Set.of("light_gray", "gray", "dark_gray", "silver"));
        COLOR_WORDS.put("blue", Set.of("blue", "navy", "light_blue", "sky_blue", "cobalt", "denim", "teal")); COLOR_WORDS.put("navy", Set.of("navy"));
        COLOR_WORDS.put("red", Set.of("red", "crimson", "burgundy", "maroon", "rust")); COLOR_WORDS.put("pink", Set.of("pink", "hot_pink", "rose", "coral", "salmon"));
        COLOR_WORDS.put("orange", Set.of("orange", "terracotta", "amber", "apricot")); COLOR_WORDS.put("yellow", Set.of("yellow", "mustard", "gold", "butter"));
        COLOR_WORDS.put("green", Set.of("green", "olive", "military_green", "forest_green", "mint", "sage", "emerald")); COLOR_WORDS.put("purple", Set.of("purple", "violet", "lilac", "lavender", "plum"));
        COLOR_WORDS.put("brown", Set.of("brown", "chocolate", "camel", "tan", "taupe")); COLOR_WORDS.put("beige", Set.of("beige", "tan", "camel", "cream")); COLOR_WORDS.put("denim", Set.of("denim"));
        COLOR_WORDS.put("blanc", Set.of("white", "off_white", "ivory", "cream")); COLOR_WORDS.put("negr", Set.of("black", "charcoal", "washed_black"));
        COLOR_WORDS.put("gris", Set.of("light_gray", "gray", "dark_gray", "silver")); COLOR_WORDS.put("roj", Set.of("red", "crimson", "burgundy", "maroon", "rust"));
        COLOR_WORDS.put("naranja", Set.of("orange", "terracotta", "amber", "apricot")); COLOR_WORDS.put("amarill", Set.of("yellow", "mustard", "gold", "butter"));
        COLOR_WORDS.put("morad", Set.of("purple", "violet", "lilac", "lavender", "plum")); COLOR_WORDS.put("lila", Set.of("lilac", "lavender"));
        COLOR_WORDS.put("marr", Set.of("brown", "chocolate", "camel", "tan", "taupe"));
        TYPE_WORDS.put("tênis", Taxonomy.SNEAKERS);
        TYPE_WORDS.put("tenis", Taxonomy.SNEAKERS);
        TYPE_WORDS.put("sapato", Set.of("loafers", "moccasins", "oxford_shoes", "derby_shoes", "flats"));
        TYPE_WORDS.put("bota", Set.of("boots"));
        TYPE_WORDS.put("sandália", Set.of("sandals", "flip_flops", "espadrilles"));
        TYPE_WORDS.put("salto", Set.of("heels"));
        TYPE_WORDS.put("calça", Set.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants"));
        TYPE_WORDS.put("jeans", Set.of("jeans", "denim_shorts", "shorts"));
        TYPE_WORDS.put("saia", Set.of("skirt", "skort"));
        TYPE_WORDS.put("short", Set.of("shorts"));
        TYPE_WORDS.put("bermuda", Set.of("bermuda_shorts", "shorts"));
        TYPE_WORDS.put("camiseta", Set.of("t_shirt", "tank_top", "top"));
        TYPE_WORDS.put("camisa", Set.of("shirt", "polo_shirt"));
        TYPE_WORDS.put("blusa", Set.of("blouse", "sweater"));
        TYPE_WORDS.put("moletom", Set.of("sweatshirt", "hoodie"));
        TYPE_WORDS.put("jaqueta", Set.of("jacket", "windbreaker", "parka"));
        TYPE_WORDS.put("casaco", Set.of("coat", "parka", "jacket"));
        TYPE_WORDS.put("blazer", Set.of("blazer"));
        TYPE_WORDS.put("vestido", Set.of("dress"));
        TYPE_WORDS.put("macacão", Set.of("jumpsuit", "overalls", "romper"));
        TYPE_WORDS.put("bolsa", Set.of("handbag", "tote_bag", "clutch"));
        TYPE_WORDS.put("mochila", Set.of("backpack"));
        TYPE_WORDS.put("boné", Set.of("cap"));
        TYPE_WORDS.put("chapéu", Set.of("hat"));
        TYPE_WORDS.put("cinto", Set.of("belt"));
        TYPE_WORDS.put("óculos", Set.of("sunglasses", "eyeglasses"));
        TYPE_WORDS.put("colar", Set.of("necklace"));
        TYPE_WORDS.put("relógio", Set.of("watch"));
        // inglês e espanhol (RF23)
        TYPE_WORDS.put("sneaker", Taxonomy.SNEAKERS); TYPE_WORDS.put("zapatilla", Taxonomy.SNEAKERS); TYPE_WORDS.put("tenis", Taxonomy.SNEAKERS);
        TYPE_WORDS.put("shoe", Set.of("loafers", "moccasins", "oxford_shoes", "derby_shoes", "flats")); TYPE_WORDS.put("zapato", Set.of("loafers", "moccasins", "oxford_shoes", "derby_shoes", "flats"));
        TYPE_WORDS.put("boot", Set.of("boots")); TYPE_WORDS.put("bota", Set.of("boots"));
        TYPE_WORDS.put("sandal", Set.of("sandals", "flip_flops", "espadrilles")); TYPE_WORDS.put("sandalia", Set.of("sandals", "flip_flops", "espadrilles")); TYPE_WORDS.put("sandália", Set.of("sandals", "flip_flops", "espadrilles"));
        TYPE_WORDS.put("heel", Set.of("heels")); TYPE_WORDS.put("tacón", Set.of("heels")); TYPE_WORDS.put("tacon", Set.of("heels"));
        TYPE_WORDS.put("pants", Set.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants")); TYPE_WORDS.put("trousers", Set.of("tailored_pants", "casual_pants", "chino_pants"));
        TYPE_WORDS.put("pantal", Set.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "jogger_pants", "sweatpants"));
        TYPE_WORDS.put("skirt", Set.of("skirt", "skort")); TYPE_WORDS.put("falda", Set.of("skirt", "skort"));
        TYPE_WORDS.put("t-shirt", Set.of("t_shirt", "tank_top", "top")); TYPE_WORDS.put("tee", Set.of("t_shirt")); TYPE_WORDS.put("camiseta", Set.of("t_shirt", "tank_top", "top"));
        TYPE_WORDS.put("shirt", Set.of("shirt", "polo_shirt")); TYPE_WORDS.put("camisa", Set.of("shirt", "polo_shirt"));
        TYPE_WORDS.put("blouse", Set.of("blouse", "sweater")); TYPE_WORDS.put("sweater", Set.of("sweater")); TYPE_WORDS.put("blusa", Set.of("blouse", "sweater")); TYPE_WORDS.put("suéter", Set.of("sweater"));
        TYPE_WORDS.put("hoodie", Set.of("sweatshirt", "hoodie")); TYPE_WORDS.put("sweatshirt", Set.of("sweatshirt", "hoodie")); TYPE_WORDS.put("sudadera", Set.of("sweatshirt", "hoodie"));
        TYPE_WORDS.put("jacket", Set.of("jacket", "windbreaker", "parka")); TYPE_WORDS.put("chaqueta", Set.of("jacket", "windbreaker", "parka")); TYPE_WORDS.put("coat", Set.of("coat", "parka", "jacket")); TYPE_WORDS.put("abrigo", Set.of("coat", "parka", "jacket"));
        TYPE_WORDS.put("dress", Set.of("dress")); TYPE_WORDS.put("vestido", Set.of("dress")); TYPE_WORDS.put("jumpsuit", Set.of("jumpsuit", "overalls", "romper")); TYPE_WORDS.put("mono", Set.of("jumpsuit", "overalls", "romper"));
        TYPE_WORDS.put("bag", Set.of("handbag", "tote_bag", "clutch")); TYPE_WORDS.put("bolso", Set.of("handbag", "tote_bag", "clutch")); TYPE_WORDS.put("backpack", Set.of("backpack")); TYPE_WORDS.put("mochila", Set.of("backpack"));
        TYPE_WORDS.put("cap", Set.of("cap")); TYPE_WORDS.put("gorra", Set.of("cap")); TYPE_WORDS.put("hat", Set.of("hat")); TYPE_WORDS.put("sombrero", Set.of("hat"));
        TYPE_WORDS.put("belt", Set.of("belt")); TYPE_WORDS.put("cinturón", Set.of("belt")); TYPE_WORDS.put("cinturon", Set.of("belt"));
        TYPE_WORDS.put("glasses", Set.of("sunglasses", "eyeglasses")); TYPE_WORDS.put("gafas", Set.of("sunglasses", "eyeglasses")); TYPE_WORDS.put("necklace", Set.of("necklace")); TYPE_WORDS.put("collar", Set.of("necklace"));
        TYPE_WORDS.put("watch", Set.of("watch")); TYPE_WORDS.put("reloj", Set.of("watch"));
        MATERIAL_WORDS.put("algodao", Set.of("COTTON")); MATERIAL_WORDS.put("cotton", Set.of("COTTON"));
        MATERIAL_WORDS.put("poliester", Set.of("POLYESTER")); MATERIAL_WORDS.put("polyester", Set.of("POLYESTER"));
        MATERIAL_WORDS.put("lana", Set.of("WOOL")); MATERIAL_WORDS.put("wool", Set.of("WOOL"));
        MATERIAL_WORDS.put("seda", Set.of("SILK")); MATERIAL_WORDS.put("silk", Set.of("SILK"));
        MATERIAL_WORDS.put("couro", Set.of("LEATHER")); MATERIAL_WORDS.put("leather", Set.of("LEATHER")); MATERIAL_WORDS.put("piel", Set.of("LEATHER"));
        MATERIAL_WORDS.put("sintetico", Set.of("SYNTHETIC")); MATERIAL_WORDS.put("synthetic", Set.of("SYNTHETIC")); MATERIAL_WORDS.put("sintetica", Set.of("SYNTHETIC"));
        MATERIAL_WORDS.put("mistura", Set.of("BLEND")); MATERIAL_WORDS.put("blend", Set.of("BLEND"));
        // vocabulário ampliado (CopilotLexicon): não sobrescreve os termos acima
        COLOR_PREFIXES.forEach(COLOR_WORDS::putIfAbsent);
        TYPE_PREFIXES.forEach(TYPE_WORDS::putIfAbsent);
        PIECE_MATERIALS.forEach(MATERIAL_WORDS::putIfAbsent);
    }

    private CopilotPieceVocabulary() {
    }

    private static void color(String prefix, String... codes) { COLOR_PREFIXES.putIfAbsent(prefix, Set.of(codes)); }
    private static void type(String prefix, String... codes) { TYPE_PREFIXES.put(prefix, Set.of(codes)); }
    private static void pieceMaterial(String code, String... terms) { for (String t : terms) PIECE_MATERIALS.put(t, Set.of(code)); }
}
