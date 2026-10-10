package br.com.fashionai.application.catalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF47 · Pontuação de correspondência entre a busca e um produto do catálogo. O score mede a SIMILARIDADE da consulta
 * com o produto ("98% compatível") — nunca a certeza de que a peça física da pessoa é aquela; quem confirma é ela.
 * Componentes: marca, categoria, subcategoria, texto (exato › prefixo › aproximado, com apelidos e "one" = "1"), cor e
 * DESIGN — as características únicas lidas do texto (estampa, posição/tamanho do logo, lados, cor da peça × cor da
 * estampa), que separam duas peças da mesma marca e do mesmo tipo; {@code visualSimilarity} entra quando a busca traz
 * foto. Componente ausente na busca não pesa.
 */
public final class CatalogMatchScorer {
    static final double W_BRAND = 0.25, W_CATEGORY = 0.10, W_SUBCATEGORY = 0.20, W_TEXT = 0.35, W_COLOR = 0.10, W_VISUAL = 0.15, W_DESIGN = 0.45;
    private static final Map<String, String> NUMBERS = Map.of("one", "1", "um", "1", "two", "2", "dois", "2", "three", "3", "tres", "3");

    /** Intenção estruturada montada a partir dos campos do formulário. */
    public record Intent(String brandSlug, String category, String subcategory, List<String> keywords, String color, DesignTraits design) {
        public Intent(String brandSlug, String category, String subcategory, List<String> keywords, String color) {
            this(brandSlug, category, subcategory, keywords, color, DesignTraits.EMPTY);
        }

        public Intent {
            design = design == null ? DesignTraits.EMPTY : design;
        }
    }

    /** O que o scorer precisa saber do produto (montado pelo serviço). */
    public record Candidate(String brandSlug, String category, String subcategory, String productName, String modelName,
                            String color, String colorName, String collection, List<String> aliases, List<String> codes,
                            List<String> variantColors, DesignTraits design, String description) {
        public Candidate(String brandSlug, String category, String subcategory, String productName, String modelName,
                         String color, String colorName, String collection, List<String> aliases, List<String> codes) {
            this(brandSlug, category, subcategory, productName, modelName, color, colorName, collection, aliases, codes, List.of(), DesignTraits.EMPTY, null);
        }

        public Candidate(String brandSlug, String category, String subcategory, String productName, String modelName,
                         String color, String colorName, String collection, List<String> aliases, List<String> codes,
                         List<String> variantColors) {
            this(brandSlug, category, subcategory, productName, modelName, color, colorName, collection, aliases, codes, variantColors, DesignTraits.EMPTY, null);
        }

        public Candidate {
            design = design == null ? DesignTraits.EMPTY : design;
        }
    }

    /** Uma característica pedida e se o produto a tem (o "por que esta?" do card). */
    public record Reason(String facet, String value, boolean ok) {
        Map<String, Object> toMap() {
            return Map.of("facet", facet, "value", value, "ok", ok);
        }
    }

    public record Score(double total, double brandMatch, double categoryMatch, double subcategoryMatch,
                        double textSimilarity, double colorMatch, Double visualSimilarity, Double designMatch, List<Reason> reasons) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("total", r(total));
            m.put("brandMatch", r(brandMatch));
            m.put("categoryMatch", r(categoryMatch));
            m.put("subcategoryMatch", r(subcategoryMatch));
            m.put("textSimilarity", r(textSimilarity));
            m.put("colorMatch", r(colorMatch));
            m.put("visualSimilarity", visualSimilarity == null ? null : r(visualSimilarity));
            m.put("designMatch", designMatch == null ? null : r(designMatch));
            m.put("reasons", reasons == null ? List.of() : reasons.stream().map(Reason::toMap).toList());
            return m;
        }
    }

    private final CatalogNormalizer norm;

    public CatalogMatchScorer(CatalogNormalizer norm) {
        this.norm = norm;
    }

    public Score score(Intent q, Candidate p, Double visual) {
        double sum = 0, weights = 0;
        double brand = 0, category = 0, sub = 0, text = 0, color = 0;
        if (q.brandSlug() != null) {
            brand = q.brandSlug().equals(p.brandSlug()) ? 1 : 0;
            sum += W_BRAND * brand;
            weights += W_BRAND;
        }
        if (q.category() != null) {
            category = q.category().equals(p.category()) ? 1 : 0;
            sum += W_CATEGORY * category;
            weights += W_CATEGORY;
        }
        if (q.subcategory() != null) {
            sub = q.subcategory().equals(p.subcategory()) ? 1
                    : p.category() != null && p.category().equals(norm.categoryOf(q.subcategory())) ? 0.35 : 0;
            sum += W_SUBCATEGORY * sub;
            weights += W_SUBCATEGORY;
        }
        List<String> words = new ArrayList<>();
        for (String k : q.keywords()) {
            words.add(NUMBERS.getOrDefault(k, k));
        }
        if (!words.isEmpty()) {
            text = text(words, p);
            sum += W_TEXT * text;
            weights += W_TEXT;
        }
        if (q.color() != null) {
            String pc = p.color() != null ? p.color() : norm.color(p.colorName()).orElse(null);
            boolean variant = p.variantColors() != null && p.variantColors().contains(q.color());
            color = q.color().equals(pc) || variant ? 1 : sameFamily(q.color(), pc) ? 0.5 : 0;
            sum += W_COLOR * color;
            weights += W_COLOR;
        }
        if (visual != null) {
            sum += W_VISUAL * visual;
            weights += W_VISUAL;
        }
        Double design = null;
        List<Reason> reasons = new ArrayList<>();
        if (!q.design().isEmpty()) {
            design = design(q.design(), p, reasons);
            sum += W_DESIGN * design;
            weights += W_DESIGN;
        }
        double total = weights == 0 ? 0 : sum / weights;
        return new Score(total, brand, category, sub, text, color, visual, design, reasons);
    }

    /** Estampas parecidas valem parte: "estampa" genérica casa um pouco com qualquer estampa de logo. */
    private static double patternSimilarity(String q, String p) {
        if (q.equals(p)) {
            return 1;
        }
        if (q.equals("GRAPHIC") && !p.equals("PLAIN") || p.equals("GRAPHIC") && !q.equals("PLAIN")) {
            return 0.4;
        }
        return 0;
    }

    /**
     * Quanto o produto tem das características únicas pedidas. Cada característica pesa: estampa 0,40, posição 0,15,
     * tamanho 0,05, lados 0,10 e cores 0,30 (cor da peça e cor da estampa conferidas no papel certo; com logo em toda a peça
     * as duas se misturam e valem as cores do produto inteiro). Produto sem a informação conta 0,3 (não sabemos), nunca 1.
     */
    double design(DesignTraits q, Candidate p, List<Reason> reasons) {
        DesignTraits d = p.design();
        double sum = 0, weights = 0;
        if (q.pattern() != null) {
            double v = d.pattern() == null ? 0.3 : patternSimilarity(q.pattern(), d.pattern());
            reasons.add(new Reason("pattern", q.pattern(), v >= 0.75));
            sum += 0.40 * v;
            weights += 0.40;
        }
        if (q.logoPlacement() != null && !(q.logoPlacement().equals("ALLOVER") && "ALLOVER_LOGO".equals(q.pattern()))) {
            double v = d.logoPlacement() == null ? 0.3 : q.logoPlacement().equals(d.logoPlacement()) ? 1 : 0;
            reasons.add(new Reason("placement", q.logoPlacement(), v >= 0.75));
            sum += 0.15 * v;
            weights += 0.15;
        }
        if (q.logoSize() != null) {
            double v = d.logoSize() == null ? 0.3 : q.logoSize().equals(d.logoSize()) ? 1 : 0;
            reasons.add(new Reason("size", q.logoSize(), v >= 0.75));
            sum += 0.05 * v;
            weights += 0.05;
        }
        if (!q.sides().isEmpty()) {
            double v = d.sides().isEmpty() ? 0.3 : d.sides().containsAll(q.sides()) ? 1 : 0.2;
            reasons.add(new Reason("sides", String.join("+", q.sides().stream().sorted().toList()), v >= 0.75));
            sum += 0.10 * v;
            weights += 0.10;
        }
        List<String> productAll = new ArrayList<>(d.allColors());
        if (p.color() != null && !productAll.contains(p.color())) {
            productAll.add(p.color());
        }
        if (p.variantColors() != null) {
            p.variantColors().stream().filter(c -> !productAll.contains(c)).forEach(productAll::add);
        }
        boolean mixed = "ALLOVER_LOGO".equals(q.pattern()) || "ALLOVER_LOGO".equals(d.pattern());
        List<String> base = d.baseColors().isEmpty() ? productAll : d.baseColors();
        List<String> print = d.printColors().isEmpty() ? productAll : d.printColors();
        double colorSum = 0;
        int colorCount = 0;
        for (String c : q.baseColors()) {
            double v = colorIn(c, mixed ? productAll : base);
            reasons.add(new Reason("baseColor", c, v >= 0.75));
            colorSum += v;
            colorCount++;
        }
        for (String c : q.printColors()) {
            double v = colorIn(c, mixed ? productAll : print);
            reasons.add(new Reason("printColor", c, v >= 0.75));
            colorSum += v;
            colorCount++;
        }
        for (String c : q.anyColors()) {
            double v = colorIn(c, productAll);
            reasons.add(new Reason("color", c, v >= 0.75));
            colorSum += v;
            colorCount++;
        }
        if (colorCount > 0) {
            sum += 0.30 * (colorSum / colorCount);
            weights += 0.30;
        }
        return weights == 0 ? 0 : sum / weights;
    }

    private static double colorIn(String c, List<String> colors) {
        if (colors.contains(c)) {
            return 1;
        }
        return colors.stream().anyMatch(x -> sameFamily(c, x)) ? 0.5 : 0;
    }

    /** Média, por palavra da busca, da melhor correspondência entre as palavras do produto. */
    double text(List<String> words, Candidate p) {
        Set<String> vocab = new java.util.LinkedHashSet<>();
        for (String s : new String[]{p.productName(), p.modelName(), p.colorName(), p.collection(), p.description()}) {
            vocab.addAll(norm.tokens(s));
        }
        for (String a : p.aliases()) {
            vocab.addAll(norm.tokens(a));
        }
        for (String c : p.codes()) {
            if (c != null) {
                vocab.add(CatalogNormalizer.key(c).replace(" ", ""));
            }
        }
        List<String> normalizedVocab = new ArrayList<>();
        for (String v : vocab) {
            normalizedVocab.add(NUMBERS.getOrDefault(v, v));
        }
        double total = 0;
        for (int i = 0; i < words.size(); i++) {
            String w = words.get(i);
            boolean typing = i == words.size() - 1;   // a última palavra pode estar pela metade ("air f")
            double best = 0;
            for (String v : normalizedVocab) {
                best = Math.max(best, similarity(w, v, typing));
                if (best == 1) {
                    break;
                }
            }
            total += best;
        }
        return total / words.size();
    }

    static double similarity(String w, String v, boolean typing) {
        if (w.equals(v)) {
            return 1;
        }
        if ((w.length() >= 2 || typing) && v.startsWith(w)) {
            return 0.85;
        }
        int d = levenshtein(w, v);
        if (w.length() >= 4 && d <= 1 || w.length() >= 7 && d <= 2) {
            return 0.7;
        }
        return 0;
    }

    static int levenshtein(String a, String b) {
        if (Math.abs(a.length() - b.length()) > 2) {
            return 3;
        }
        int[] prev = new int[b.length() + 1], cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
            }
            int[] t = prev;
            prev = cur;
            cur = t;
        }
        return prev[b.length()];
    }

    private static boolean sameFamily(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        String fa = br.com.fashionai.application.taxonomy.Taxonomy.COLOR_FAMILY.get(a);
        return fa != null && fa.equals(br.com.fashionai.application.taxonomy.Taxonomy.COLOR_FAMILY.get(b));
    }

    static double r(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
