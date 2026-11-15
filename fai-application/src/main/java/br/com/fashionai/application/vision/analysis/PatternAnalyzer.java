package br.com.fashionai.application.vision.analysis;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.vision.ModelRef;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF4 · Classificador de padrão visual v1 (heurístico): liso, listrado, xadrez ou estampado. Mede a variação de
 * luminância dentro da peça e a periodicidade (autocorrelação) dos perfis médios de linhas e colunas de um quadrado
 * interno. Confiança moderada por desenho — é um sinal, não uma certeza; o treinado substitui pela mesma saída.
 */
public final class PatternAnalyzer {
    public static final ModelRef MODEL = ModelRef.PATTERN_CLASSIFIER;

    public enum Pattern { SOLID, STRIPED, CHECKED, PRINTED }

    public record Result(Pattern pattern, double confidence, Map<String, Double> scores) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("pattern", pattern.name().toLowerCase());
            m.put("confidence", Math.round(confidence * 100) / 100.0);
            m.put("scores", scores);
            m.put("model", MODEL.key());
            return m;
        }
    }

    public Result analyze(BufferedImage cutout) {
        BufferedImage s = ImageOps.scaleToFit(ImageOps.toArgb(cutout), 256, 256);
        ImageOps.Box b = ImageOps.alphaBounds(s);
        if (b.empty()) {
            return new Result(Pattern.SOLID, 0, Map.of());
        }
        // quadrado interno: miolo da caixa, onde quase tudo é tecido
        int side = (int) (Math.min(b.w(), b.h()) * 0.5);
        int x0 = b.x() + (b.w() - side) / 2, y0 = b.y() + (int) ((b.h() - side) * 0.45);
        if (side < 16) {
            return new Result(Pattern.SOLID, 0.3, Map.of());
        }
        int background = background(s);
        double[][] lum = new double[side][side];
        boolean[][] on = new boolean[side][side];
        int[] fabric = new int[side * side];
        double sum = 0, sumSq = 0;
        int n = 0;
        for (int y = 0; y < side; y++) {
            for (int x = 0; x < side; x++) {
                int p = s.getRGB(x0 + x, y0 + y);
                if ((p >>> 24) < 200 || nearBackground(p, background)) {
                    continue; // fora da peça (vão entre as pernas, decote): não é tecido
                }
                double l = ((p >> 16 & 0xFF) * 0.299 + (p >> 8 & 0xFF) * 0.587 + (p & 0xFF) * 0.114) / 255.0;
                lum[y][x] = l;
                on[y][x] = true;
                fabric[n] = p;
                sum += l;
                sumSq += l * l;
                n++;
            }
        }
        if (n < side * side / 4) {
            return new Result(Pattern.SOLID, 0.3, Map.of());
        }
        double mean = sum / n;
        for (int y = 0; y < side; y++) {
            for (int x = 0; x < side; x++) {
                if (!on[y][x]) {
                    lum[y][x] = mean;
                }
            }
        }
        double std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
        double[] rows = new double[side], cols = new double[side];
        for (int y = 0; y < side; y++) {
            for (int x = 0; x < side; x++) {
                rows[y] += lum[y][x] / side;
                cols[x] += lum[y][x] / side;
            }
        }
        double perRows = periodicity(rows), perCols = periodicity(cols);
        double varRows = std(rows), varCols = std(cols);
        Map<String, Double> scores = new LinkedHashMap<>();
        scores.put("std", round(std));
        scores.put("periodicityRows", round(perRows));
        scores.put("periodicityCols", round(perCols));
        if (std < 0.045) {
            return new Result(Pattern.SOLID, Math.min(0.9, 0.6 + (0.045 - std) * 6), scores);
        }
        boolean rowStripes = perRows > 0.45 && varRows > std * 0.25;
        boolean colStripes = perCols > 0.45 && varCols > std * 0.25;
        if (rowStripes && colStripes) {
            return new Result(Pattern.CHECKED, Math.min(0.85, (perRows + perCols) / 2), scores);
        }
        if (rowStripes || colStripes) {
            return new Result(Pattern.STRIPED, Math.min(0.85, Math.max(perRows, perCols)), scores);
        }
        double coverage = dominantCoverage(Arrays.copyOf(fabric, n));
        scores.put("dominantCoverage", round(coverage));
        if (coverage >= SOLID_COVERAGE) {
            // tecido de uma cor só com sombra, dobras, costuras ou um detalhe pequeno (botão, etiqueta): liso
            return new Result(Pattern.SOLID, Math.min(0.8, 0.45 + (coverage - SOLID_COVERAGE)), scores);
        }
        return new Result(Pattern.PRINTED, Math.min(0.7, 0.4 + std), scores);
    }

    /**
     * Cor do fundo de um recorte opaco (a caixa da peça numa foto, com o fundo à volta): a mediana da borda, quando a
     * borda é quase toda de uma cor só; -1 quando há transparência ou a borda varia (a peça encosta na borda).
     */
    static int background(BufferedImage s) {
        List<Integer> border = new ArrayList<>();
        for (int x = 0; x < s.getWidth(); x++) {
            border.add(s.getRGB(x, 0));
            border.add(s.getRGB(x, s.getHeight() - 1));
        }
        for (int y = 0; y < s.getHeight(); y++) {
            border.add(s.getRGB(0, y));
            border.add(s.getRGB(s.getWidth() - 1, y));
        }
        if (border.stream().anyMatch(p -> (p >>> 24) < 200)) {
            return -1;
        }
        int[] med = new int[3];
        for (int c = 0; c < 3; c++) {
            int shift = 16 - 8 * c;
            med[c] = (int) median(border.stream().map(p -> (double) (p >> shift & 0xFF)).toList());
        }
        int bg = 0xFF000000 | med[0] << 16 | med[1] << 8 | med[2];
        long close = border.stream().filter(p -> nearBackground(p, bg)).count();
        return close >= border.size() * 0.7 ? bg : -1;
    }

    static boolean nearBackground(int p, int background) {
        if (background == -1) {
            return false;
        }
        int d = Math.abs((p >> 16 & 0xFF) - (background >> 16 & 0xFF)) + Math.abs((p >> 8 & 0xFF) - (background >> 8 & 0xFF))
                + Math.abs((p & 0xFF) - (background & 0xFF));
        return d < 36;
    }

    /** Parte mínima do miolo na cor dominante para a peça ser lida como lisa. */
    static final double SOLID_COVERAGE = 0.75;

    /**
     * Fração dos pixels do tecido na cor dominante. Compara a cromaticidade (r/(r+g+b), g/(r+g+b)), que quase não muda
     * com a sombra e as dobras, e só conta como fora quem também foge muito da luminância mediana (estampa clara num
     * tecido escuro). Pixels muito escuros não têm cromaticidade confiável e contam como da cor dominante.
     */
    static double dominantCoverage(int[] pixels) {
        int n = pixels.length;
        if (n == 0) {
            return 1;
        }
        double[] cr = new double[n], cg = new double[n], lum = new double[n];
        boolean[] lit = new boolean[n];
        List<Double> litR = new ArrayList<>(), litG = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            int r = pixels[i] >> 16 & 0xFF, g = pixels[i] >> 8 & 0xFF, b = pixels[i] & 0xFF;
            double sum = r + g + b + 1e-6;
            cr[i] = r / sum;
            cg[i] = g / sum;
            lum[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0;
            lit[i] = Math.max(r, Math.max(g, b)) > 38;
            if (lit[i]) {
                litR.add(cr[i]);
                litG.add(cg[i]);
            }
        }
        double medR = litR.isEmpty() ? 1 / 3.0 : median(litR), medG = litG.isEmpty() ? 1 / 3.0 : median(litG);
        List<Double> lums = new ArrayList<>();
        for (double l : lum) {
            lums.add(l);
        }
        double medL = median(lums);
        int match = 0;
        for (int i = 0; i < n; i++) {
            boolean sameHue = !lit[i] || Math.max(Math.abs(cr[i] - medR), Math.abs(cg[i] - medG)) < 0.06;
            if (sameHue && Math.abs(lum[i] - medL) < 0.35) {
                match++;
            }
        }
        return match / (double) n;
    }

    private static double median(List<Double> v) {
        List<Double> sorted = new ArrayList<>(v);
        Collections.sort(sorted);
        return sorted.get(sorted.size() / 2);
    }

    /** Maior autocorrelação normalizada para defasagens entre 3 e metade do sinal (≈1 = periódico). */
    static double periodicity(double[] v) {
        int n = v.length;
        double mean = 0;
        for (double d : v) {
            mean += d / n;
        }
        double var = 0;
        for (double d : v) {
            var += (d - mean) * (d - mean);
        }
        if (var < 1e-9) {
            return 0;
        }
        double best = 0;
        boolean dipped = false;
        for (int lag = 2; lag <= n / 2; lag++) {
            double c = 0;
            for (int i = 0; i + lag < n; i++) {
                c += (v[i] - mean) * (v[i + lag] - mean);
            }
            c = c / var * n / (n - lag);
            if (c < 0) {
                dipped = true;
            }
            if (dipped) {
                best = Math.max(best, c);
            }
        }
        return Math.max(0, Math.min(1, best));
    }

    private static double std(double[] v) {
        double m = 0, s = 0;
        for (double d : v) {
            m += d / v.length;
        }
        for (double d : v) {
            s += (d - m) * (d - m) / v.length;
        }
        return Math.sqrt(s);
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
