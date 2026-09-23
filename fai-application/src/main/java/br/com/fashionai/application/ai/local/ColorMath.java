package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/** Matemática de cor local (RF4 cor dominante, RF13 paleta k-means, RF5 harmonia) — nunca sai do backend (RNF6). */
public final class ColorMath {
    public static final Set<String> NEUTRAL_FAMILIES = Set.of("Preto", "Branco", "Cinza");
    public static final Set<String> SOFT_NEUTRALS = Set.of("navy", "denim", "beige", "camel", "tan", "taupe", "cream",
            "off_white", "ivory", "chocolate", "brown", "olive", "military_green");

    private ColorMath() {
    }

    public record Cluster(int rgb, double share) {
        public String hex() {
            return String.format("#%06X", rgb & 0xFFFFFF);
        }
    }

    public static int parseHex(String hex) {
        if (hex == null) {
            return 0x999999;
        }
        String h = hex.startsWith("#") ? hex.substring(1) : hex;
        try {
            return Integer.parseInt(h.length() > 6 ? h.substring(0, 6) : h, 16);
        } catch (NumberFormatException ex) {
            return 0x999999;
        }
    }

    public static double[] lab(int rgb) {
        double r = pivotRgb(((rgb >> 16) & 0xFF) / 255.0);
        double g = pivotRgb(((rgb >> 8) & 0xFF) / 255.0);
        double b = pivotRgb((rgb & 0xFF) / 255.0);
        double x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
        double y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
        double z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
        x = pivotXyz(x);
        y = pivotXyz(y);
        z = pivotXyz(z);
        return new double[]{116 * y - 16, 500 * (x - y), 200 * (y - z)};
    }

    private static double pivotRgb(double n) {
        return n > 0.04045 ? Math.pow((n + 0.055) / 1.055, 2.4) : n / 12.92;
    }

    private static double pivotXyz(double n) {
        return n > 0.008856 ? Math.cbrt(n) : (7.787 * n) + 16.0 / 116;
    }

    public static double deltaE(int a, int b) {
        double[] la = lab(a);
        double[] lb = lab(b);
        return Math.sqrt(Math.pow(la[0] - lb[0], 2) + Math.pow(la[1] - lb[1], 2) + Math.pow(la[2] - lb[2], 2));
    }

    /** Cor da paleta oficial mais próxima (ΔE CIE76) — ignora multicolor/print. */
    public static String nearestTaxonomyColor(int rgb) {
        String best = "gray";
        double bestDist = Double.MAX_VALUE;
        for (Map.Entry<String, String> e : Taxonomy.COLORS.entrySet()) {
            if (e.getKey().equals("multicolor") || e.getKey().equals("print")) {
                continue;
            }
            double d = deltaE(rgb, parseHex(e.getValue()));
            if (d < bestDist) {
                bestDist = d;
                best = e.getKey();
            }
        }
        return best;
    }

    public static double saturation(int rgb) {
        float[] hsb = java.awt.Color.RGBtoHSB((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF, null);
        return hsb[1];
    }

    public static boolean isNeutral(String color) {
        String family = Taxonomy.COLOR_FAMILY.get(color);
        return family == null || NEUTRAL_FAMILIES.contains(family) || SOFT_NEUTRALS.contains(color);
    }

    /** k-means (k clusters, determinístico por semente fixa) sobre pixels RGB. */
    public static List<Cluster> kmeans(int[] pixels, int k) {
        if (pixels.length == 0) {
            return List.of();
        }
        k = Math.min(k, pixels.length);
        Random random = new Random(42);
        double[][] centers = new double[k][3];
        for (int i = 0; i < k; i++) {
            int p = pixels[random.nextInt(pixels.length)];
            centers[i] = new double[]{(p >> 16) & 0xFF, (p >> 8) & 0xFF, p & 0xFF};
        }
        int[] assign = new int[pixels.length];
        for (int iter = 0; iter < 12; iter++) {
            double[][] sums = new double[k][3];
            int[] counts = new int[k];
            for (int i = 0; i < pixels.length; i++) {
                int p = pixels[i];
                int r = (p >> 16) & 0xFF;
                int g = (p >> 8) & 0xFF;
                int b = p & 0xFF;
                int best = 0;
                double bestD = Double.MAX_VALUE;
                for (int c = 0; c < k; c++) {
                    double d = sq(r - centers[c][0]) + sq(g - centers[c][1]) + sq(b - centers[c][2]);
                    if (d < bestD) {
                        bestD = d;
                        best = c;
                    }
                }
                assign[i] = best;
                sums[best][0] += r;
                sums[best][1] += g;
                sums[best][2] += b;
                counts[best]++;
            }
            for (int c = 0; c < k; c++) {
                if (counts[c] > 0) {
                    centers[c] = new double[]{sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]};
                }
            }
        }
        int[] counts = new int[k];
        Arrays.stream(assign).forEach(a -> counts[a]++);
        List<Cluster> clusters = new ArrayList<>();
        for (int c = 0; c < k; c++) {
            if (counts[c] == 0) {
                continue;
            }
            int rgb = ((int) centers[c][0] << 16) | ((int) centers[c][1] << 8) | (int) centers[c][2];
            clusters.add(new Cluster(rgb, counts[c] / (double) pixels.length));
        }
        clusters.sort(Comparator.comparingDouble(Cluster::share).reversed());
        return clusters;
    }

    /** Paleta de n cores a partir de cores hex ponderadas (DNA de Estilo — colorPalette de 5 cores). */
    public static List<String> palette(List<String> hexes, int n) {
        if (hexes.isEmpty()) {
            return List.of();
        }
        int[] pixels = hexes.stream().mapToInt(ColorMath::parseHex).toArray();
        List<Cluster> clusters = kmeans(pixels, Math.min(n, (int) Arrays.stream(pixels).distinct().count()));
        List<String> out = new ArrayList<>();
        for (Cluster c : clusters) {
            out.add(c.hex());
        }
        return out;
    }

    private static double sq(double v) {
        return v * v;
    }
}
