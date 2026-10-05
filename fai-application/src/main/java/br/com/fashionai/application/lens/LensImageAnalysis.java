package br.com.fashionai.application.lens;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.vision.analysis.GarmentEmbedder;
import br.com.fashionai.application.vision.analysis.PatternAnalyzer;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * RF54 · Leitura local do recorte de cada peça (nada sai do backend): cores dominantes (k-means → paleta oficial,
 * {@link ColorMath}), padrão ({@link PatternAnalyzer}) e embedding visual ({@link GarmentEmbedder}, o mesmo modelo dos
 * {@code garment_embeddings} do guarda-roupa). O recorte é só um insumo: nunca é gravado nem vira foto de peça.
 */
final class LensImageAnalysis {
    private static final PatternAnalyzer PATTERNS = new PatternAnalyzer();
    private static final GarmentEmbedder EMBEDDER = new GarmentEmbedder();
    /** Cor secundária só entra com pelo menos esta fração do miolo da peça. */
    static final double MIN_SECONDARY_SHARE = 0.15;

    private LensImageAnalysis() {
    }

    record Reading(List<LensViews.ColorShare> colors, String pattern, double patternConfidence, float[] embedding) {
    }

    static Reading read(BufferedImage image, LensViews.Box box, String aiColor) {
        BufferedImage crop = crop(image, box);
        PatternAnalyzer.Result pattern = PATTERNS.analyze(crop);
        return new Reading(colors(crop, aiColor), pattern.pattern().name().toLowerCase(Locale.ROOT), pattern.confidence(),
                EMBEDDER.embed(crop));
    }

    /** Recorte da caixa (em %), preso dentro da imagem e com pelo menos 1 px de lado. */
    static BufferedImage crop(BufferedImage image, LensViews.Box box) {
        int w = image.getWidth(), h = image.getHeight();
        int x = clamp((int) Math.floor(box.x() / 100.0 * w), 0, w - 1);
        int y = clamp((int) Math.floor(box.y() / 100.0 * h), 0, h - 1);
        int cw = clamp((int) Math.ceil(box.w() / 100.0 * w), 1, w - x);
        int ch = clamp((int) Math.ceil(box.h() / 100.0 * h), 1, h - y);
        return image.getSubimage(x, y, cw, ch);
    }

    /**
     * Cores da peça, a principal primeiro. Mede o miolo do recorte (70% central, onde quase tudo é tecido). Com a cor da
     * IA, ela é a principal e as medidas só acrescentam secundárias relevantes; sem IA (leitura local), as medidas mandam.
     */
    static List<LensViews.ColorShare> colors(BufferedImage crop, String aiColor) {
        Map<String, Double> measured = measure(crop);
        List<LensViews.ColorShare> out = new ArrayList<>();
        if (aiColor != null && Taxonomy.COLORS.containsKey(aiColor)) {
            List<Map.Entry<String, Double>> others = measured.entrySet().stream()
                    .filter(e -> !e.getKey().equals(aiColor) && e.getValue() >= MIN_SECONDARY_SHARE).limit(2).toList();
            double rest = others.stream().mapToDouble(Map.Entry::getValue).sum();
            out.add(new LensViews.ColorShare(aiColor, Taxonomy.hex(aiColor), round2(Math.max(0.34, 1 - rest))));
            others.forEach(e -> out.add(new LensViews.ColorShare(e.getKey(), Taxonomy.hex(e.getKey()), round2(e.getValue()))));
            return out;
        }
        List<Map.Entry<String, Double>> top = new ArrayList<>();
        for (Map.Entry<String, Double> e : measured.entrySet()) {
            if (top.size() < 3 && (top.isEmpty() || e.getValue() >= MIN_SECONDARY_SHARE)) {
                top.add(e);
            }
        }
        double total = top.stream().mapToDouble(Map.Entry::getValue).sum();
        for (Map.Entry<String, Double> e : top) {
            out.add(new LensViews.ColorShare(e.getKey(), Taxonomy.hex(e.getKey()), round2(total == 0 ? 0 : e.getValue() / total)));
        }
        return out;
    }

    /** k-means (k=3) no miolo → código da paleta mais próximo, frações somadas por código, maior primeiro. */
    static Map<String, Double> measure(BufferedImage crop) {
        int w = crop.getWidth(), h = crop.getHeight();
        int x0 = (int) (w * 0.15), y0 = (int) (h * 0.15);
        int x1 = Math.max(x0 + 1, (int) Math.ceil(w * 0.85)), y1 = Math.max(y0 + 1, (int) Math.ceil(h * 0.85));
        int step = Math.max(1, (int) Math.sqrt((double) (x1 - x0) * (y1 - y0) / 4000.0));
        List<Integer> px = new ArrayList<>();
        for (int y = y0; y < Math.min(h, y1); y += step) {
            for (int x = x0; x < Math.min(w, x1); x += step) {
                int p = crop.getRGB(x, y);
                if ((p >>> 24) > 128) {
                    px.add(p & 0xFFFFFF);
                }
            }
        }
        Map<String, Double> byCode = new LinkedHashMap<>();
        if (px.isEmpty()) {
            return byCode;
        }
        for (ColorMath.Cluster c : ColorMath.kmeans(px.stream().mapToInt(Integer::intValue).toArray(), 3)) {
            byCode.merge(ColorMath.nearestTaxonomyColor(c.rgb()), c.share(), Double::sum);
        }
        Map<String, Double> sorted = new LinkedHashMap<>();
        byCode.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .forEach(e -> sorted.put(e.getKey(), e.getValue()));
        return sorted;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
