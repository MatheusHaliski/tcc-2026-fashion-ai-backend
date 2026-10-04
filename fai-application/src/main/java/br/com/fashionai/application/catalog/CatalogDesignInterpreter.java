package br.com.fashionai.application.catalog;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF47 · Leitura LOCAL das características únicas da peça no texto digitado (o nome/descrição da busca catalogada).
 * Vocabulário em {@code catalog/normalization.json → design} (o mesmo que o pipeline Python valida).
 *
 * <ul>
 *   <li><b>Estampa</b>: "monograma", "logo em toda a superfície", "logos espalhados" → ALLOVER_LOGO; "um logo", "logo central",
 *       "logo no peito" → SINGLE_LOGO; listras, xadrez, floral, camuflado, tie-dye, color block, lisa, estampa genérica.</li>
 *   <li><b>Posição e tamanho</b> do logo (centro, peito esquerdo, costas, manga, toda a peça; grande/pequeno) e <b>lados</b>
 *       ("frente e verso").</li>
 *   <li><b>Papel das cores</b>: cor logo depois de uma palavra de estampa ("logo CK branco", "estampa cinza e preto") é cor da
 *       ESTAMPA; depois de "toda/fundo" ou antes de "com" ("toda azul com…") é cor da PEÇA; cores ligadas por "e" herdam o
 *       papel da anterior; o resto fica sem papel e casa com qualquer cor do produto.</li>
 * </ul>
 * Sem regra que se aplique, nada é inventado: o campo fica vazio e não pesa no ranqueamento.
 */
public final class CatalogDesignInterpreter {
    private static final List<String> PATTERN_ORDER = List.of("ALLOVER_LOGO", "SINGLE_LOGO", "STRIPES", "PLAID", "FLORAL", "CAMO", "TIE_DYE", "COLOR_BLOCK", "PLAIN", "GRAPHIC");
    private static final Set<String> SINGLE_HINTS = Set.of("um", "uma", "unico", "unica", "one", "single", "un");
    /** Códigos da taxonomia de cor que descrevem estampa, não cor ("estampado" → print): ficam com o intérprete de estampa. */
    private static final Set<String> NOT_A_COLOR = Set.of("print", "multicolor");
    private static final Set<String> LOGO_WORDS = Set.of("logo", "logos", "logotipo", "sigla", "siglas", "bordado", "lettering");

    private final CatalogNormalizer norm;
    private final Map<String, List<List<String>>> patterns, placements, sizes, sides;
    private final Set<String> printNouns = new LinkedHashSet<>(), baseCues = new LinkedHashSet<>(), connectors = new LinkedHashSet<>();

    public CatalogDesignInterpreter(CatalogNormalizer norm) {
        this.norm = norm;
        JsonNode d = norm.design();
        patterns = phrases(d.path("patterns"));
        placements = phrases(d.path("placements"));
        sizes = phrases(d.path("sizes"));
        sides = phrases(d.path("sides"));
        d.path("printNouns").forEach(n -> printNouns.add(CatalogNormalizer.key(n.asText())));
        d.path("baseCues").forEach(n -> baseCues.add(CatalogNormalizer.key(n.asText())));
        d.path("connectors").forEach(n -> connectors.add(CatalogNormalizer.key(n.asText())));
    }

    public static CatalogDesignInterpreter get() {
        return Holder.INSTANCE;
    }

    private static final class Holder {
        static final CatalogDesignInterpreter INSTANCE = new CatalogDesignInterpreter(CatalogNormalizer.get());
    }

    record Hit(String code, int start, int end) {
    }

    public DesignTraits interpret(String text) {
        String k = CatalogNormalizer.key(text);
        if (k.isBlank()) {
            return DesignTraits.EMPTY;
        }
        List<String> w = List.of(k.split(" "));
        Set<Integer> used = new LinkedHashSet<>();
        List<Hit> pat = hits(w, patterns), plc = hits(w, placements), siz = hits(w, sizes), sid = hits(w, sides);
        List<Integer> nouns = new ArrayList<>();
        for (int i = 0; i < w.size(); i++) {
            if (printNouns.contains(w.get(i))) {
                nouns.add(i);
            }
        }
        boolean alloverPlace = plc.stream().anyMatch(h -> h.code().equals("ALLOVER"));
        boolean logoNoun = nouns.stream().anyMatch(i -> LOGO_WORDS.contains(w.get(i)) || w.get(i).startsWith("monogram"));

        // estampa: logo em toda a peça vence; depois logo único; depois as demais na ordem do vocabulário
        String pattern = null;
        if (has(pat, "ALLOVER_LOGO") || (alloverPlace && !nouns.isEmpty())) {
            pattern = "ALLOVER_LOGO";
        } else if (has(pat, "SINGLE_LOGO") || (logoNoun && (plc.stream().anyMatch(h -> !h.code().equals("ALLOVER")) || !siz.isEmpty()
                || nouns.stream().anyMatch(i -> i > 0 && SINGLE_HINTS.contains(w.get(i - 1)))))) {
            pattern = "SINGLE_LOGO";
        } else {
            for (String code : PATTERN_ORDER) {
                if (has(pat, code)) {
                    pattern = code;
                    break;
                }
            }
        }
        String placement = "ALLOVER_LOGO".equals(pattern) ? "ALLOVER"
                : plc.stream().filter(h -> !h.code().equals("ALLOVER")).map(Hit::code).findFirst().orElse(null);
        String size = siz.isEmpty() ? null : siz.get(0).code();
        Set<String> sideSet = new LinkedHashSet<>();
        sid.forEach(h -> sideSet.add(h.code()));
        if ("BACK".equals(placement)) {
            sideSet.add("BACK");
        }
        for (List<Hit> list : List.of(pat, plc, siz, sid)) {
            for (Hit h : list) {
                for (int i = h.start(); i < h.end(); i++) {
                    used.add(i);
                }
            }
        }

        // cores e o papel de cada uma
        List<String> base = new ArrayList<>(), print = new ArrayList<>(), any = new ArrayList<>();
        int firstNoun = nouns.isEmpty() ? Integer.MAX_VALUE : nouns.get(0);
        Hit prev = null;
        String prevRole = null;
        for (Hit c : colorHits(w)) {
            String role;
            if (window(w, c.start(), 3).stream().anyMatch(printNouns::contains)) {
                role = "PRINT";
            } else if (window(w, c.start(), 2).stream().anyMatch(baseCues::contains)
                    || (c.end() < w.size() && connectors.contains(w.get(c.end())) && List.of("com", "with", "con").contains(w.get(c.end())))) {
                role = "BASE";
            } else if (prev != null && prevRole != null && c.start() - prev.end() == 1 && connectors.contains(w.get(prev.end()))) {
                role = prevRole;                                  // "cinza e preto": o mesmo papel da cor anterior
            } else if (c.start() < firstNoun && !"ALLOVER_LOGO".equals(pattern)) {
                role = "BASE";                                    // cor antes de qualquer estampa: a cor da peça
            } else {
                role = "ANY";
            }
            (role.equals("PRINT") ? print : role.equals("BASE") ? base : any).add(c.code());
            for (int i = c.start(); i < c.end(); i++) {
                used.add(i);
            }
            prev = c;
            prevRole = role;
        }
        Set<String> consumed = new LinkedHashSet<>();
        if (pattern != null || !base.isEmpty() || !print.isEmpty() || !any.isEmpty() || placement != null || !sideSet.isEmpty()) {
            nouns.forEach(used::add);
            for (int i = 0; i < w.size(); i++) {
                if (baseCues.contains(w.get(i)) || SINGLE_HINTS.contains(w.get(i))) {
                    used.add(i);
                }
            }
            used.forEach(i -> consumed.add(w.get(i)));
        }
        return new DesignTraits(pattern, placement, size, sideSet, base, print, any, consumed, "LOCAL");
    }

    /** Design de um produto a partir do nome, da descrição e do nome da cor (quando o catálogo não gravou design_json). */
    public DesignTraits ofProduct(String productName, String description, String colorName, String color) {
        DesignTraits t = interpret(String.join(". ", nz(productName), nz(description), nz(colorName)));
        List<String> base = new ArrayList<>(t.baseColors());
        if (base.isEmpty() && color != null && !"ALLOVER_LOGO".equals(t.pattern())) {
            base.add(color);
        }
        return new DesignTraits(t.pattern(), t.logoPlacement(), t.logoSize(), t.sides(), base, t.printColors(), t.anyColors(), Set.of(), "CATALOG");
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private List<Hit> colorHits(List<String> w) {
        List<Hit> out = new ArrayList<>();
        int i = 0;
        while (i < w.size()) {
            Hit hit = null;
            for (int n = Math.min(3, w.size() - i); n >= 1 && hit == null; n--) {
                String phrase = String.join(" ", w.subList(i, i + n));
                if (n == 1 && (connectors.contains(phrase) || printNouns.contains(phrase))) {
                    continue;
                }
                String code = norm.colorExact(phrase);
                if (code != null && !NOT_A_COLOR.contains(code)) {
                    hit = new Hit(code, i, i + n);
                }
            }
            if (hit != null) {
                out.add(hit);
                i = hit.end();
            } else {
                i++;
            }
        }
        return out;
    }

    private static List<String> window(List<String> w, int at, int size) {
        return w.subList(Math.max(0, at - size), at);
    }

    private static boolean has(List<Hit> hits, String code) {
        return hits.stream().anyMatch(h -> h.code().equals(code));
    }

    /** Ocorrências das frases do vocabulário no texto (a frase mais longa vence onde se sobrepõem). */
    private static List<Hit> hits(List<String> w, Map<String, List<List<String>>> vocab) {
        List<Hit> found = new ArrayList<>();
        for (Map.Entry<String, List<List<String>>> e : vocab.entrySet()) {
            for (List<String> phrase : e.getValue()) {
                for (int i = 0; i + phrase.size() <= w.size(); i++) {
                    if (w.subList(i, i + phrase.size()).equals(phrase)) {
                        found.add(new Hit(e.getKey(), i, i + phrase.size()));
                    }
                }
            }
        }
        found.sort((a, b) -> (b.end() - b.start()) - (a.end() - a.start()));
        List<Hit> out = new ArrayList<>();
        for (Hit h : found) {
            boolean overlaps = out.stream().anyMatch(o -> o.code().equals(h.code()) && h.start() < o.end() && o.start() < h.end());
            if (!overlaps) {
                out.add(h);
            }
        }
        out.sort((a, b) -> a.start() - b.start());
        return out;
    }

    private static Map<String, List<List<String>>> phrases(JsonNode node) {
        Map<String, List<List<String>>> out = new LinkedHashMap<>();
        node.fields().forEachRemaining(e -> {
            List<List<String>> list = new ArrayList<>();
            e.getValue().forEach(v -> {
                String k = CatalogNormalizer.key(v.asText());
                if (!k.isBlank()) {
                    list.add(List.of(k.split(" ")));
                }
            });
            out.put(e.getKey(), list);
        });
        return out;
    }
}
