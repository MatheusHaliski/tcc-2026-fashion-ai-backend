package br.com.fashionai.application.catalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF47 · Características únicas de uma peça: o que distingue duas camisetas da mesma marca e do mesmo tipo.
 * Ex.: "monograma CK em toda a superfície, frente e verso, cinza e preto" × "toda azul, um único logo CK branco no centro".
 *
 * @param pattern       estampa (ALLOVER_LOGO, SINGLE_LOGO, STRIPES, PLAID, FLORAL, CAMO, TIE_DYE, COLOR_BLOCK, GRAPHIC, PLAIN)
 * @param logoPlacement posição do logo/estampa (ALLOVER, CENTER_CHEST, LEFT_CHEST, BACK, SLEEVE)
 * @param logoSize      LARGE | SMALL
 * @param sides         lados com estampa (FRONT, BACK)
 * @param baseColors    cores da peça ("toda azul")
 * @param printColors   cores da estampa/logo ("logo branco")
 * @param anyColors     cores citadas sem papel claro (casam com a peça ou com a estampa)
 * @param consumed      palavras do texto usadas na interpretação (saem do casamento por texto)
 * @param source        LOCAL (regras do vocabulário) | AI (motor de IA, RF24) | CATALOG (design gravado no produto)
 */
public record DesignTraits(String pattern, String logoPlacement, String logoSize, Set<String> sides, List<String> baseColors,
                           List<String> printColors, List<String> anyColors, Set<String> consumed, String source) {

    public static final DesignTraits EMPTY = new DesignTraits(null, null, null, Set.of(), List.of(), List.of(), List.of(), Set.of(), "LOCAL");

    public DesignTraits {
        sides = sides == null ? Set.of() : Set.copyOf(sides);
        baseColors = baseColors == null ? List.of() : List.copyOf(new LinkedHashSet<>(baseColors));
        printColors = printColors == null ? List.of() : List.copyOf(new LinkedHashSet<>(printColors));
        anyColors = anyColors == null ? List.of() : List.copyOf(new LinkedHashSet<>(anyColors));
        consumed = consumed == null ? Set.of() : Set.copyOf(consumed);
    }

    /** Nada de característica única na busca: o componente de design não pesa. */
    public boolean isEmpty() {
        return pattern == null && logoPlacement == null && logoSize == null && sides.isEmpty() && baseColors.isEmpty()
                && printColors.isEmpty() && anyColors.isEmpty();
    }

    /** Todas as cores citadas, na ordem: peça, estampa, sem papel. */
    public List<String> allColors() {
        Set<String> all = new LinkedHashSet<>(baseColors);
        all.addAll(printColors);
        all.addAll(anyColors);
        return new ArrayList<>(all);
    }

    /** O que vem preenchido em {@code other} substitui o daqui (a IA refina a leitura local). */
    public DesignTraits merge(DesignTraits other, String newSource) {
        if (other == null || other.isEmpty()) {
            return this;
        }
        Set<String> c = new LinkedHashSet<>(consumed);
        c.addAll(other.consumed);
        return new DesignTraits(other.pattern != null ? other.pattern : pattern, other.logoPlacement != null ? other.logoPlacement : logoPlacement,
                other.logoSize != null ? other.logoSize : logoSize, other.sides.isEmpty() ? sides : other.sides,
                other.baseColors.isEmpty() ? baseColors : other.baseColors, other.printColors.isEmpty() ? printColors : other.printColors,
                other.allColors().isEmpty() ? anyColors : other.anyColors, c, newSource);
    }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pattern", pattern);
        m.put("logoPlacement", logoPlacement);
        m.put("logoSize", logoSize);
        m.put("sides", sides.stream().sorted().toList());
        m.put("baseColors", baseColors);
        m.put("printColors", printColors);
        m.put("anyColors", anyColors);
        m.put("source", source);
        return m;
    }

    /** Design gravado no produto (catalog_products.design_json) — campos desconhecidos são ignorados. */
    @SuppressWarnings("unchecked")
    public static DesignTraits fromMap(Map<String, Object> m, String source) {
        if (m == null || m.isEmpty()) {
            return EMPTY;
        }
        return new DesignTraits(str(m.get("pattern")), str(m.get("logoPlacement")), str(m.get("logoSize")),
                new LinkedHashSet<>(list(m.get("sides")).stream().map(x -> x.toUpperCase(java.util.Locale.ROOT)).toList()), list(m.get("baseColors")), list(m.get("printColors")), list(m.get("anyColors")),
                Set.of(), source);
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() || "null".equals(String.valueOf(o)) ? null : String.valueOf(o).trim().toUpperCase(java.util.Locale.ROOT);
    }

    private static List<String> list(Object o) {
        List<String> out = new ArrayList<>();
        if (o instanceof List<?> l) {
            for (Object x : l) {
                if (x != null && !String.valueOf(x).isBlank()) {
                    out.add(String.valueOf(x).trim());
                }
            }
        }
        return out;
    }
}
