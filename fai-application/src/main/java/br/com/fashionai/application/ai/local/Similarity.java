package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Similaridade e embeddings locais. Assinatura ponderada do T_norm/HypeGroup (RF6_HYPE_SCORE_CALCULO §3.2):
 * estilo 1,5 · marca 1,0 · cor 1,0 · ocasião 1,0 · categoria/tipo 0,5. Embeddings de atributos alimentam
 * Acervo Grouping (#13), Affinity (#14), SealBond (#6) e Photo Curator (#19).
 */
public final class Similarity {
    public static final double W_STYLE = 1.5;
    public static final double W_BRAND = 1.0;
    public static final double W_COLOR = 1.0;
    public static final double W_OCCASION = 1.0;
    public static final double W_TYPE = 0.5;
    public static final double GROUP_THRESHOLD = 0.70;

    private static final List<String> VOCAB = new ArrayList<>();

    static {
        Taxonomy.SUBCATEGORIES.keySet().forEach(c -> VOCAB.add("cat:" + c));
        Taxonomy.SUBCATEGORIES.values().forEach(list -> list.forEach(s -> VOCAB.add("sub:" + s)));
        new LinkedHashMap<>(Taxonomy.COLOR_FAMILY).values().stream().distinct().forEach(f -> VOCAB.add("fam:" + f));
        Taxonomy.MATERIALS.forEach(m -> VOCAB.add("mat:" + m));
        Taxonomy.STYLES.forEach(s -> VOCAB.add("sty:" + s));
        Taxonomy.OCCASIONS.forEach(o -> VOCAB.add("occ:" + o));
        Taxonomy.SEXES.forEach(s -> VOCAB.add("sex:" + s));
    }

    private Similarity() {
    }

    /** Assinatura de uma peça ou esquema usada pelo T_norm e pelo HypeGroup. */
    public record Signature(Set<String> styles, Set<String> brands, Set<String> colors, Set<String> occasions,
                            Set<String> types) {
    }

    public static Signature of(WardrobeItem item) {
        return new Signature(set(Json.csv(item.getStyleTags())), set(brandKey(item)), set(List.of(nz(item.getColor()))),
                set(Json.csv(item.getOccasionTags())), set(List.of(nz(item.getSubcategory()))));
    }

    public static Signature of(Scheme scheme, Collection<SchemeItem> items) {
        Set<String> brands = new HashSet<>();
        Set<String> colors = new HashSet<>();
        Set<String> types = new HashSet<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            brands.addAll(brandKey(w));
            colors.add(nz(w.getColor()));
            types.add(nz(w.getSubcategory()));
        }
        return new Signature(set(Json.csv(scheme.getStyle())), brands, colors, set(Json.csv(scheme.getOccasion())), types);
    }

    public static double weighted(Signature a, Signature b) {
        double total = W_STYLE + W_BRAND + W_COLOR + W_OCCASION + W_TYPE;
        double s = W_STYLE * jaccard(a.styles(), b.styles()) + W_BRAND * jaccard(a.brands(), b.brands())
                + W_COLOR * jaccard(a.colors(), b.colors()) + W_OCCASION * jaccard(a.occasions(), b.occasions())
                + W_TYPE * jaccard(a.types(), b.types());
        return s / total;
    }

    public static double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() && b.isEmpty()) {
            return 0;
        }
        Set<String> inter = new HashSet<>(a);
        inter.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return union.isEmpty() ? 0 : inter.size() / (double) union.size();
    }

    public static int dimensions() {
        return VOCAB.size();
    }

    /** Embedding de atributos (one-hot ponderado, normalizado L2). */
    public static double[] embed(WardrobeItem item) {
        Map<String, Double> features = new LinkedHashMap<>();
        features.put("cat:" + item.getCategory(), W_TYPE);
        features.put("sub:" + item.getSubcategory(), W_TYPE);
        features.put("fam:" + Taxonomy.COLOR_FAMILY.getOrDefault(item.getColor(), "Especiais"), W_COLOR);
        features.put("mat:" + item.getMaterial(), 0.5);
        Json.csv(item.getStyleTags()).forEach(s -> features.put("sty:" + s, W_STYLE));
        Json.csv(item.getOccasionTags()).forEach(o -> features.put("occ:" + o, W_OCCASION));
        features.put("sex:" + item.getSex(), 0.3);
        return normalize(vector(features));
    }

    public static double[] embed(Scheme scheme, Collection<SchemeItem> items) {
        double[] v = new double[VOCAB.size()];
        for (SchemeItem si : items) {
            add(v, embed(si.getWardrobeItem()), 1.0);
        }
        Map<String, Double> features = new LinkedHashMap<>();
        Json.csv(scheme.getStyle()).forEach(s -> features.put("sty:" + s, W_STYLE * 2));
        Json.csv(scheme.getOccasion()).forEach(o -> features.put("occ:" + o, W_OCCASION * 2));
        add(v, vector(features), 1.0);
        return normalize(v);
    }

    public static double[] centroid(List<double[]> vectors) {
        double[] c = new double[VOCAB.size()];
        for (double[] v : vectors) {
            add(c, v, 1.0);
        }
        return normalize(c);
    }

    public static double cosine(double[] a, double[] b) {
        if (a == null || b == null || a.length != b.length) {
            return 0;
        }
        double dot = 0;
        double na = 0;
        double nb = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        return na == 0 || nb == 0 ? 0 : dot / Math.sqrt(na * nb);
    }

    public static List<String> topFeatures(double[] v, int n, String prefix) {
        List<Integer> idx = new ArrayList<>();
        for (int i = 0; i < v.length; i++) {
            if (VOCAB.get(i).startsWith(prefix) && v[i] > 0) {
                idx.add(i);
            }
        }
        idx.sort((x, y) -> Double.compare(v[y], v[x]));
        return idx.stream().limit(n).map(i -> VOCAB.get(i).substring(prefix.length())).toList();
    }

    private static double[] vector(Map<String, Double> features) {
        double[] v = new double[VOCAB.size()];
        features.forEach((k, w) -> {
            int i = VOCAB.indexOf(k);
            if (i >= 0) {
                v[i] += w;
            }
        });
        return v;
    }

    private static void add(double[] target, double[] v, double w) {
        for (int i = 0; i < target.length; i++) {
            target[i] += v[i] * w;
        }
    }

    private static double[] normalize(double[] v) {
        double n = 0;
        for (double x : v) {
            n += x * x;
        }
        if (n == 0) {
            return v;
        }
        double s = Math.sqrt(n);
        for (int i = 0; i < v.length; i++) {
            v[i] /= s;
        }
        return v;
    }

    private static List<String> brandKey(WardrobeItem item) {
        if (item.getBrand() != null) {
            return List.of(item.getBrand().getSlug());
        }
        if (item.getBrandName() != null && !item.getBrandName().isBlank()) {
            return List.of(item.getBrandName().trim().toLowerCase());
        }
        return List.of();
    }

    private static Set<String> set(List<String> values) {
        Set<String> s = new HashSet<>();
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                s.add(v);
            }
        }
        return s;
    }

    private static String nz(String v) {
        return v == null ? "" : v;
    }

    /** k-means sobre embeddings (Acervo Grouping #13). Retorna o índice do cluster de cada vetor. */
    public static int[] kmeans(List<double[]> vectors, int k) {
        int n = vectors.size();
        int[] assign = new int[n];
        if (n == 0 || k <= 1) {
            return assign;
        }
        k = Math.min(k, n);
        double[][] centers = new double[k][];
        for (int c = 0; c < k; c++) {
            centers[c] = vectors.get((int) ((long) c * n / k)).clone();
        }
        for (int iter = 0; iter < 20; iter++) {
            boolean changed = false;
            for (int i = 0; i < n; i++) {
                int best = 0;
                double bestSim = -2;
                for (int c = 0; c < k; c++) {
                    double s = cosine(vectors.get(i), centers[c]);
                    if (s > bestSim) {
                        bestSim = s;
                        best = c;
                    }
                }
                if (assign[i] != best) {
                    changed = true;
                    assign[i] = best;
                }
            }
            for (int c = 0; c < k; c++) {
                List<double[]> members = new ArrayList<>();
                for (int i = 0; i < n; i++) {
                    if (assign[i] == c) {
                        members.add(vectors.get(i));
                    }
                }
                if (!members.isEmpty()) {
                    centers[c] = centroid(members);
                }
            }
            if (!changed && iter > 0) {
                break;
            }
        }
        return assign;
    }
}
