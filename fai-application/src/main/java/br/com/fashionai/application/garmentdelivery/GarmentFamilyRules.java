package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.List;
import java.util.Map;

import static java.util.Map.entry;

/**
 * Regra pura: família e modelagem da ficha (texto livre, pt/en/es) → subcategoria da taxonomia e linha de produção da
 * Fábrica FashionAI; campo de cores → código da paleta. A ordem importa: peça inteira e agasalhos antes de partes de
 * cima, saias e shorts antes de calças, "calça jeans" antes de "calça" e "jaqueta jeans" continua jaqueta.
 */
final class GarmentFamilyRules {
    private GarmentFamilyRules() {
    }

    /** Linha de produção (entra no lote e no preço/prazo): CAM, CMS, MAL, ALF, CAL, CUR, VES. */
    record Kind(String category, String subcategory, String line) {
    }

    private record Rule(String subcategory, List<String> words) {
    }

    private static final List<Rule> RULES = List.of(
            new Rule("jumpsuit", List.of("macacao", "jumpsuit", "mono ", "enterizo")),
            new Rule("romper", List.of("macaquinho", "romper")),
            new Rule("overalls", List.of("jardineira", "overall", "peto")),
            new Rule("matching_set", List.of("conjunto", "matching set", "co ord")),
            new Rule("dress", List.of("vestido", "dress", "chemise")),
            new Rule("windbreaker", List.of("corta vento", "windbreaker", "cortavientos")),
            new Rule("parka", List.of("parka")),
            new Rule("blazer", List.of("blazer", "palito", "terno", "americana")),
            new Rule("kimono", List.of("quimono", "kimono")),
            new Rule("vest", List.of("colete", "chaleco", "vest ")),
            new Rule("jacket", List.of("jaqueta", "jacket", "chaqueta", "bomber", "jaquetinha")),
            new Rule("coat", List.of("casaco", "sobretudo", "trench", "coat", "abrigo", "gabardina")),
            new Rule("hoodie", List.of("moletom com capuz", "hoodie", "canguru", "capuz", "sudadera con capucha")),
            new Rule("sweatpants", List.of("calca de moletom", "sweatpants", "pantalon de chandal")),
            new Rule("sweatshirt", List.of("moletom", "sweatshirt", "sudadera", "blusao")),
            new Rule("cardigan", List.of("cardiga", "cardigan", "casaquinho", "rebeca")),
            new Rule("sweater", List.of("sueter", "sweater", "pulover", "pullover", "trico")),
            new Rule("polo_shirt", List.of("polo")),
            new Rule("t_shirt", List.of("camiseta", "t shirt", "tshirt", "tee", "playera", "camisetao")),
            new Rule("tank_top", List.of("regata", "tank", "camiseta sin mangas", "musculosa")),
            new Rule("bodysuit", List.of("body", "bodysuit")),
            new Rule("blouse", List.of("blusa", "blouse", "bata")),
            new Rule("shirt", List.of("camisa", "shirt", "button down")),
            new Rule("top", List.of("cropped", "top")),
            new Rule("skort", List.of("short saia", "skort", "falda pantalon")),
            new Rule("culottes", List.of("pantacourt", "culotte")),
            new Rule("skirt", List.of("saia", "skirt", "falda")),
            new Rule("shorts", List.of("bermuda", "short", "shorts", "pantalon corto")),
            new Rule("leggings", List.of("legging", "leggings", "mallas")),
            new Rule("cargo_pants", List.of("cargo")),
            new Rule("chino_pants", List.of("chino")),
            new Rule("jogger_pants", List.of("jogger")),
            new Rule("tailored_pants", List.of("alfaiataria", "tailored", "calca social", "pantalon de vestir")),
            new Rule("jeans", List.of("calca jeans", "jeans", "denim pants", "vaquero")),
            new Rule("casual_pants", List.of("calca", "pants", "trousers", "pantalon")));

    private static final Map<String, String> LINES = Map.ofEntries(
            entry("t_shirt", "CAM"), entry("tank_top", "CAM"), entry("top", "CAM"), entry("bodysuit", "CAM"),
            entry("shirt", "CMS"), entry("blouse", "CMS"), entry("polo_shirt", "CMS"),
            entry("sweater", "MAL"), entry("sweatshirt", "MAL"), entry("hoodie", "MAL"), entry("cardigan", "MAL"),
            entry("vest", "ALF"), entry("blazer", "ALF"), entry("jacket", "ALF"), entry("coat", "ALF"), entry("parka", "ALF"),
            entry("windbreaker", "ALF"), entry("kimono", "ALF"),
            entry("jeans", "CAL"), entry("tailored_pants", "CAL"), entry("casual_pants", "CAL"), entry("chino_pants", "CAL"),
            entry("cargo_pants", "CAL"), entry("jogger_pants", "CAL"), entry("sweatpants", "CAL"), entry("leggings", "CAL"),
            entry("culottes", "CUR"), entry("shorts", "CUR"), entry("skirt", "CUR"), entry("skort", "CUR"),
            entry("dress", "VES"), entry("jumpsuit", "VES"), entry("romper", "VES"), entry("overalls", "VES"), entry("matching_set", "VES"));

    /** Família reconhecida primeiro; senão a modelagem; sem correspondência, "top" (a pessoa pode reclassificar a peça). */
    static Kind classify(String family, String modeling) {
        String subcategory = match(GarmentText.normalize(family));
        if (subcategory == null) {
            subcategory = match(GarmentText.normalize(modeling));
        }
        if (subcategory == null) {
            subcategory = "top";
        }
        String category = Taxonomy.categoryOf(subcategory);
        return new Kind(category == null ? "upper_piece" : category, subcategory, LINES.getOrDefault(subcategory, "CAM"));
    }

    private static String match(String text) {
        for (Rule rule : RULES) {
            if (GarmentText.hasAny(text, rule.words())) {
                return rule.subcategory();
            }
        }
        return null;
    }

    private static final List<Map.Entry<String, List<String>>> COLORS = List.of(
            entry("navy", List.of("azul marinho", "marinho", "navy", "azul marino")),
            entry("light_blue", List.of("azul claro", "light blue", "azul bebe", "celeste")),
            entry("off_white", List.of("off white", "offwhite", "gelo")),
            entry("military_green", List.of("verde militar", "verde musgo", "army green")),
            entry("olive", List.of("verde oliva", "oliva", "olive")),
            entry("hot_pink", List.of("rosa choque", "pink neon", "hot pink", "fucsia")),
            entry("charcoal", List.of("grafite", "chumbo", "charcoal", "carvao")),
            entry("black", List.of("preto", "preta", "black", "negro", "negra")),
            entry("white", List.of("branco", "branca", "white", "blanco", "blanca")),
            entry("gray", List.of("cinza", "gray", "grey", "gris")),
            entry("blue", List.of("azul", "blue", "anil", "indigo")),
            entry("burgundy", List.of("vinho", "bordo", "burgundy", "borgona", "marsala")),
            entry("red", List.of("vermelho", "vermelha", "red", "rojo", "roja")),
            entry("pink", List.of("rosa", "pink", "rosado")),
            entry("orange", List.of("laranja", "orange", "naranja")),
            entry("mustard", List.of("mostarda", "mustard", "mostaza")),
            entry("yellow", List.of("amarelo", "amarela", "yellow", "amarillo")),
            entry("green", List.of("verde", "green")),
            entry("lilac", List.of("lilas", "lilac", "lila")),
            entry("lavender", List.of("lavanda", "lavender")),
            entry("purple", List.of("roxo", "roxa", "purple", "morado", "violeta")),
            entry("camel", List.of("caramelo", "camelo", "camel")),
            entry("beige", List.of("bege", "beige", "nude", "areia")),
            entry("cream", List.of("creme", "cream", "crema", "marfim")),
            entry("brown", List.of("marrom", "brown", "marron", "cafe", "chocolate")),
            entry("terracotta", List.of("terracota", "terracotta", "telha")),
            entry("coral", List.of("coral")),
            entry("metallic_gold", List.of("dourado", "dourada", "gold", "dorado")),
            entry("metallic_silver", List.of("prateado", "prateada", "silver", "plateado")),
            entry("print", List.of("estampado", "estampada", "estampa", "print", "xadrez", "listrado")));

    /** Primeira cor citada no campo "Cores" (a que aparece antes no texto); nenhuma reconhecida → multicolor. */
    static String color(String colors) {
        String text = GarmentText.normalize(colors);
        String best = null;
        int bestAt = Integer.MAX_VALUE;
        for (Map.Entry<String, List<String>> candidate : COLORS) {
            int at = GarmentText.firstIndex(text, candidate.getValue());
            if (at >= 0 && at < bestAt) {
                best = candidate.getKey();
                bestAt = at;
            }
        }
        return best == null || !Taxonomy.COLORS.containsKey(best) ? "multicolor" : best;
    }
}
