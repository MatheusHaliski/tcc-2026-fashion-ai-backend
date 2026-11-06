package br.com.fashionai.application.fit;

import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

/**
 * Grades de referência do provador (mesma regra de lib/tryon/sizes.ts): letras PP…XG para parte de cima e peça
 * inteira, numeração 34…50 para calças/shorts/saias de tecido, 33…46 para calçado. São variações visuais estimadas do
 * modelo 3D (RF — tamanho CA7/CA12), nunca tamanhos comerciais nem medidas oficiais.
 */
public final class SizeGrids {
    private SizeGrids() {
    }

    public static final List<String> LETTER = List.of("PP", "P", "M", "G", "GG", "XG");
    public static final List<String> NUMERIC = IntStream.iterate(34, n -> n <= 50, n -> n + 2).mapToObj(String::valueOf).toList();
    public static final List<String> SHOES = IntStream.rangeClosed(33, 46).mapToObj(String::valueOf).toList();
    private static final Set<String> NUMERIC_SUBS = Set.of("jeans", "tailored_pants", "casual_pants", "chino_pants", "cargo_pants", "denim_shorts", "shorts", "bermuda_shorts", "skirt", "mini_skirt", "midi_skirt", "maxi_skirt", "skort");

    /** Nome da grade ou {@code null} quando a categoria não tem tamanho (acessório). */
    public static String gridOf(String category, String subcategory) {
        String c = category == null ? "" : category.toLowerCase();
        String s = subcategory == null ? "" : subcategory.toLowerCase();
        if ("shoes_piece".equals(c)) return "shoes";
        if ("lower_piece".equals(c)) return NUMERIC_SUBS.contains(s) ? "numeric" : "letter";
        if ("upper_piece".equals(c) || "full_body_piece".equals(c)) return "letter";
        return null;
    }

    public static List<String> labels(String grid) {
        return switch (grid == null ? "" : grid) {
            case "letter" -> LETTER;
            case "numeric" -> NUMERIC;
            case "shoes" -> SHOES;
            default -> List.of();
        };
    }
}
