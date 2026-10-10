package br.com.fashionai.application.lens;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.vision.analysis.GarmentEmbedder;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * RF54 · Semelhança (0–100) entre uma peça lida pelo Lens e uma peça do app (§9.2). Pura e determinística:
 * <pre>
 * semelhança = 100 · (0,45·visual + 0,35·atributos + 0,20·cor) / Σ pesos presentes
 * visual     = cosseno(embedding da detecção, embedding da peça)      — só quando os dois lados têm embedding
 * atributos  = 0,40·subcategoria + 0,15·categoria + 0,15·material + 0,15·padrão + 0,15·sobreposição de estilo
 * cor        = max(0, 1 − ΔE00(cor principal, cor da peça) / 40)      — só quando os dois lados têm cor
 * </pre>
 * Dimensão sem dado sai da conta e os pesos são renormalizados (como no HypeScore); o mesmo vale para cada atributo
 * dentro de "atributos". Atributos nunca saem: sem nada comparável valem 0 (a semelhança fica conservadora).
 * Semelhança não é compatibilidade nem Hype: os três números ficam separados.
 */
public final class LensSimilarity {
    private LensSimilarity() {
    }

    public enum Scope { MY_CLOSET, COMMUNITY }

    /** O que se compara de cada lado (códigos da taxonomia; cor em hex; embedding do GarmentEmbedder). */
    public record Features(String category, String subcategory, String material, String pattern, Collection<String> styles,
                           String colorHex, float[] embedding) {
    }

    /**
     * @param similarity 0–100
     * @param visual     0–100 ou nulo (sem embedding num dos lados)
     * @param attributes 0–100
     * @param color      0–100 ou nulo (sem cor num dos lados)
     * @param reasons    SAME_SUBCATEGORY, SAME_CATEGORY, COLOR_CLOSE, SAME_PATTERN, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE
     */
    public record Score(int similarity, Integer visual, int attributes, Integer color, List<String> reasons) {
    }

    public record Ranked<T>(T target, Score score) {
    }

    public static Score score(Features query, Features target) {
        Double visual = visual(query.embedding(), target.embedding());
        double attributes = attributes(query, target);
        Double color = color(query.colorHex(), target.colorHex());
        double combined = combine(visual, attributes, color);

        List<String> reasons = new ArrayList<>();
        boolean sameSub = same(query.subcategory(), target.subcategory());
        if (sameSub) {
            reasons.add("SAME_SUBCATEGORY");
        } else if (same(query.category(), target.category())) {
            reasons.add("SAME_CATEGORY");
        }
        if (color != null && pct(color) >= LensConfig.COLOR_CLOSE_AT) {
            reasons.add("COLOR_CLOSE");
        }
        if (same(query.pattern(), target.pattern())) {
            reasons.add("SAME_PATTERN");
        }
        if (same(query.material(), target.material())) {
            reasons.add("SAME_MATERIAL");
        }
        Double styles = overlap(norm(query.styles()), norm(target.styles()));
        if (styles != null && styles > 0) {
            reasons.add("STYLE_OVERLAP");
        }
        if (visual != null && pct(visual) >= LensConfig.VISUAL_CLOSE_AT) {
            reasons.add("VISUAL_CLOSE");
        }
        return new Score(pct(combined), visual == null ? null : pct(visual), pct(attributes), color == null ? null : pct(color),
                List.copyOf(reasons));
    }

    /** Média ponderada das dimensões presentes (0–1); a ausente sai e os pesos são renormalizados. */
    public static double combine(Double visual, double attributes, Double color) {
        double num = LensConfig.W_ATTRIBUTES * attributes;
        double den = LensConfig.W_ATTRIBUTES;
        if (visual != null) {
            num += LensConfig.W_VISUAL * visual;
            den += LensConfig.W_VISUAL;
        }
        if (color != null) {
            num += LensConfig.W_COLOR * color;
            den += LensConfig.W_COLOR;
        }
        return num / den;
    }

    /** Atributos (0–1): cada atributo só conta quando os dois lados o têm; sem nenhum comparável, 0. */
    public static double attributes(Features a, Features b) {
        double num = 0, den = 0;
        double[][] parts = {
                term(a.subcategory(), b.subcategory(), LensConfig.A_SUBCATEGORY),
                term(a.category(), b.category(), LensConfig.A_CATEGORY),
                term(a.material(), b.material(), LensConfig.A_MATERIAL),
                term(a.pattern(), b.pattern(), LensConfig.A_PATTERN)};
        for (double[] p : parts) {
            if (p != null) {
                num += p[0] * p[1];
                den += p[1];
            }
        }
        Double styles = overlap(norm(a.styles()), norm(b.styles()));
        if (styles != null) {
            num += styles * LensConfig.A_STYLE;
            den += LensConfig.A_STYLE;
        }
        return den == 0 ? 0 : num / den;
    }

    /** Cor (0–1) = max(0, 1 − ΔE00/40); nula quando um dos lados não tem cor. */
    public static Double color(String hexA, String hexB) {
        if (blank(hexA) || blank(hexB)) {
            return null;
        }
        double de = deltaE00(ColorMath.parseHex(hexA), ColorMath.parseHex(hexB));
        return Math.max(0, 1 - de / LensConfig.DELTA_E_MAX);
    }

    /** Visual (0–1) = cosseno dos embeddings (negativo vira 0); nulo sem embedding ou com dimensões diferentes. */
    public static Double visual(float[] a, float[] b) {
        if (a == null || b == null || a.length == 0 || a.length != b.length) {
            return null;
        }
        return Math.max(0, Math.min(1, GarmentEmbedder.cosine(a, b)));
    }

    /**
     * Ordena os alvos pela semelhança e corta pelo piso e pelo top-N do escopo. Empates mantêm a ordem de entrada.
     */
    public static <T> List<Ranked<T>> rank(Features query, Collection<T> targets, Function<T, Features> features, int floor, int limit) {
        return targets.stream()
                .map(t -> new Ranked<>(t, score(query, features.apply(t))))
                .filter(r -> r.score().similarity() >= floor)
                .sorted(Comparator.comparingInt((Ranked<T> r) -> r.score().similarity()).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------ ΔE00 (CIEDE2000, Sharma et al. 2005)

    public static double deltaE00(int rgbA, int rgbB) {
        return deltaE00(ColorMath.lab(rgbA), ColorMath.lab(rgbB));
    }

    public static double deltaE00(double[] lab1, double[] lab2) {
        double l1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
        double l2 = lab2[0], a2 = lab2[1], b2 = lab2[2];
        double c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2);
        double cBar7 = Math.pow((c1 + c2) / 2, 7);
        double g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + Math.pow(25, 7))));
        double a1p = (1 + g) * a1, a2p = (1 + g) * a2;
        double c1p = Math.hypot(a1p, b1), c2p = Math.hypot(a2p, b2);
        double h1p = hue(a1p, b1), h2p = hue(a2p, b2);

        double dLp = l2 - l1;
        double dCp = c2p - c1p;
        double dhp;
        if (c1p * c2p == 0) {
            dhp = 0;
        } else {
            dhp = h2p - h1p;
            if (dhp > 180) {
                dhp -= 360;
            } else if (dhp < -180) {
                dhp += 360;
            }
        }
        double dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(Math.toRadians(dhp / 2));

        double lBarP = (l1 + l2) / 2;
        double cBarP = (c1p + c2p) / 2;
        double hBarP;
        if (c1p * c2p == 0) {
            hBarP = h1p + h2p;
        } else if (Math.abs(h1p - h2p) <= 180) {
            hBarP = (h1p + h2p) / 2;
        } else if (h1p + h2p < 360) {
            hBarP = (h1p + h2p + 360) / 2;
        } else {
            hBarP = (h1p + h2p - 360) / 2;
        }
        double t = 1 - 0.17 * cosDeg(hBarP - 30) + 0.24 * cosDeg(2 * hBarP) + 0.32 * cosDeg(3 * hBarP + 6)
                - 0.20 * cosDeg(4 * hBarP - 63);
        double dTheta = 30 * Math.exp(-Math.pow((hBarP - 275) / 25, 2));
        double cBarP7 = Math.pow(cBarP, 7);
        double rc = 2 * Math.sqrt(cBarP7 / (cBarP7 + Math.pow(25, 7)));
        double lMinus = Math.pow(lBarP - 50, 2);
        double sl = 1 + 0.015 * lMinus / Math.sqrt(20 + lMinus);
        double sc = 1 + 0.045 * cBarP;
        double sh = 1 + 0.015 * cBarP * t;
        double rt = -Math.sin(Math.toRadians(2 * dTheta)) * rc;
        double tl = dLp / sl, tc = dCp / sc, th = dHp / sh;
        return Math.sqrt(tl * tl + tc * tc + th * th + rt * tc * th);
    }

    private static double hue(double a, double b) {
        if (a == 0 && b == 0) {
            return 0;
        }
        double h = Math.toDegrees(Math.atan2(b, a));
        return h < 0 ? h + 360 : h;
    }

    private static double cosDeg(double deg) {
        return Math.cos(Math.toRadians(deg));
    }

    // ------------------------------------------------------------------ apoio

    /** [valor, peso] do atributo, ou nulo quando um dos lados não o tem. */
    private static double[] term(String a, String b, double weight) {
        if (blank(a) || blank(b)) {
            return null;
        }
        return new double[]{same(a, b) ? 1 : 0, weight};
    }

    /** Coeficiente de sobreposição |A∩B| ÷ min(|A|,|B|) (o mesmo da StyleCompatibility); nulo com um lado vazio. */
    static Double overlap(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return null;
        }
        Set<String> inter = new HashSet<>(a);
        inter.retainAll(b);
        return (double) inter.size() / Math.min(a.size(), b.size());
    }

    private static Set<String> norm(Collection<String> values) {
        if (values == null) {
            return Set.of();
        }
        return values.stream().filter(v -> v != null && !v.isBlank()).map(v -> v.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
    }

    private static boolean same(String a, String b) {
        return !blank(a) && !blank(b) && a.trim().equalsIgnoreCase(b.trim());
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static int pct(double v) {
        return (int) Math.round(100 * Math.max(0, Math.min(1, v)));
    }
}
