package br.com.fashionai.application.vision.landmarks;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.vision.ModelRef;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF4 · Landmarks geométricos v1, calculados sobre a máscara (alfa) do recorte endireitado. Não "adivinham" o que
 * a geometria não mostra (bolsos, patch): esses ficam para o detector treinado (YOLO-pose), que entra pela mesma
 * saída. Coordenadas normalizadas (0–1) na imagem analisada.
 * <ul>
 *   <li>PANTS: waistband_left/center/right, crotch (primeira linha com duas pernas separadas), left_hem, right_hem</li>
 *   <li>SKIRT: waistband_center, hem_left, hem_center, hem_right</li>
 *   <li>UPPER/DRESS: neckline_center (vale no topo central), ombros, axilas (queda da largura), pontas das mangas, barra</li>
 *   <li>FOOTWEAR: toe, heel (lado mais alto = calcanhar), collar_top, sole_front, sole_back</li>
 *   <li>BAG: handle_top e cantos do corpo · WATCH: dial_center · GLASSES: lentes e ponte · GENERIC: extremos e centro</li>
 * </ul>
 */
public final class LandmarkDetector {
    static final int WORK = 512;

    public record Landmark(String name, double x, double y, double confidence, boolean visible) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", name);
            m.put("x", r(x));
            m.put("y", r(y));
            m.put("confidence", r(confidence));
            m.put("visible", visible);
            return m;
        }
    }

    public record Result(String family, List<Landmark> landmarks, ModelRef model, Map<String, Object> meta) {
        public Landmark get(String name) {
            return landmarks.stream().filter(l -> l.name().equals(name)).findFirst().orElse(null);
        }

        public boolean has(String name) {
            return get(name) != null;
        }
    }

    /** Máscara reduzida com extensões por linha e coluna. */
    static final class Mask {
        final int w, h;
        final boolean[] m;
        int x0, y0, x1, y1;

        Mask(BufferedImage img) {
            BufferedImage s = ImageOps.scaleToFit(img, WORK, WORK);
            w = s.getWidth();
            h = s.getHeight();
            int[] px = s.getRGB(0, 0, w, h, null, 0, w);
            m = new boolean[w * h];
            x0 = w;
            y0 = h;
            x1 = -1;
            y1 = -1;
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    if ((px[y * w + x] >>> 24) > 128) {
                        m[y * w + x] = true;
                        x0 = Math.min(x0, x);
                        x1 = Math.max(x1, x);
                        y0 = Math.min(y0, y);
                        y1 = Math.max(y1, y);
                    }
                }
            }
        }

        boolean empty() {
            return x1 < 0;
        }

        boolean at(int x, int y) {
            return x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
        }

        int bw() {
            return x1 - x0 + 1;
        }

        int bh() {
            return y1 - y0 + 1;
        }

        /** Segmentos [início, fim] da linha com comprimento ≥ minLen. */
        List<int[]> runs(int y, int minLen) {
            List<int[]> out = new ArrayList<>();
            int start = -1;
            for (int x = 0; x <= w; x++) {
                boolean on = x < w && at(x, y);
                if (on && start < 0) {
                    start = x;
                } else if (!on && start >= 0) {
                    if (x - start >= minLen) {
                        out.add(new int[]{start, x - 1});
                    }
                    start = -1;
                }
            }
            return out;
        }

        int left(int y) {
            for (int x = 0; x < w; x++) {
                if (at(x, y)) {
                    return x;
                }
            }
            return -1;
        }

        int right(int y) {
            for (int x = w - 1; x >= 0; x--) {
                if (at(x, y)) {
                    return x;
                }
            }
            return -1;
        }

        int top(int x) {
            for (int y = 0; y < h; y++) {
                if (at(x, y)) {
                    return y;
                }
            }
            return -1;
        }

        int bottom(int x) {
            for (int y = h - 1; y >= 0; y--) {
                if (at(x, y)) {
                    return y;
                }
            }
            return -1;
        }

        Landmark lm(String name, double x, double y, double conf) {
            return new Landmark(name, x / Math.max(1, w - 1), y / Math.max(1, h - 1), conf, true);
        }
    }

    public Result detect(BufferedImage cutout, String family) {
        Mask k = new Mask(cutout);
        String f = family == null ? "GENERIC" : family;
        if (k.empty()) {
            return new Result(f, List.of(), modelOf(f), Map.of("empty", true));
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        List<Landmark> out = switch (f) {
            case "PANTS" -> pants(k);
            case "SKIRT" -> skirt(k);
            case "UPPER", "DRESS" -> upper(k);
            case "FOOTWEAR" -> footwear(k, meta);
            case "BAG" -> bag(k);
            case "WATCH" -> watch(k);
            case "GLASSES" -> glasses(k);
            default -> generic(k);
        };
        return new Result(f, out, modelOf(f), meta);
    }

    static ModelRef modelOf(String family) {
        return switch (family) {
            case "PANTS", "SKIRT" -> ModelRef.PANTS_LANDMARKS;
            case "UPPER", "DRESS" -> ModelRef.UPPER_LANDMARKS;
            case "FOOTWEAR" -> ModelRef.FOOTWEAR_LANDMARKS;
            default -> ModelRef.ACCESSORY_LANDMARKS;
        };
    }

    private static List<Landmark> pants(Mask k) {
        List<Landmark> out = new ArrayList<>();
        // pontos do contorno superior a 20% e 80% da largura: a linha entre eles é a inclinação do cós
        // (dentro da extensão das linhas do topo: as barras podem passar além do cós numa foto inclinada)
        int band = k.y0 + Math.max(2, k.bh() * 4 / 100);
        int tl = k.left(band), tr = k.right(band);
        int wl = tl + (tr - tl) * 15 / 100, wr = tr - (tr - tl) * 15 / 100;
        out.add(k.lm("waistband_left", wl, k.top(wl), 0.8));
        out.add(k.lm("waistband_center", (k.x0 + k.x1) / 2.0, k.top((k.x0 + k.x1) / 2), 0.85));
        out.add(k.lm("waistband_right", wr, k.top(wr), 0.8));
        int minLen = Math.max(2, k.bw() / 50);
        int minGap = Math.max(2, k.bw() * 3 / 100);
        int crotchY = -1;
        double crotchX = 0;
        for (int y = k.y0 + k.bh() * 15 / 100; y <= k.y1 - k.bh() / 10; y++) {
            List<int[]> runs = k.runs(y, minLen);
            if (runs.size() >= 2) {
                int[] a = runs.get(0), b = runs.get(runs.size() - 1);
                if (b[0] - a[1] >= minGap && persists(k, y, minLen, minGap)) {
                    crotchY = y;
                    crotchX = (a[1] + b[0]) / 2.0;
                    break;
                }
            }
        }
        if (crotchY >= 0) {
            out.add(k.lm("crotch", crotchX, crotchY, 0.75));
            int cx = (int) Math.round(crotchX);
            int[] lh = lowest(k, k.x0, cx - 1);
            int[] rh = lowest(k, cx + 1, k.x1);
            if (lh != null) {
                out.add(k.lm("left_hem", lh[0], lh[1], 0.8));
            }
            if (rh != null) {
                out.add(k.lm("right_hem", rh[0], rh[1], 0.8));
            }
        } else {
            out.add(k.lm("left_hem", k.left(k.y1), k.y1, 0.4));
            out.add(k.lm("right_hem", k.right(k.y1), k.y1, 0.4));
        }
        return out;
    }

    /** As duas pernas continuam separadas por pelo menos metade da altura restante (não é um furo isolado). */
    private static boolean persists(Mask k, int y, int minLen, int minGap) {
        int rows = 0, split = 0;
        for (int yy = y; yy <= k.y1; yy += 3) {
            rows++;
            List<int[]> r = k.runs(yy, minLen);
            if (r.size() >= 2 && r.get(r.size() - 1)[0] - r.get(0)[1] >= minGap) {
                split++;
            }
        }
        return rows > 0 && split >= rows * 0.6;
    }

    /** Ponto mais baixo da máscara entre as colunas [a, b]: média das colunas que alcançam a linha mais baixa. */
    private static int[] lowest(Mask k, int a, int b) {
        int best = -1;
        for (int x = Math.max(0, a); x <= Math.min(k.w - 1, b); x++) {
            best = Math.max(best, k.bottom(x));
        }
        if (best < 0) {
            return null;
        }
        long sum = 0;
        int n = 0;
        for (int x = Math.max(0, a); x <= Math.min(k.w - 1, b); x++) {
            if (k.bottom(x) >= best - 1) {
                sum += x;
                n++;
            }
        }
        return new int[]{(int) (sum / Math.max(1, n)), best};
    }

    private static List<Landmark> skirt(Mask k) {
        List<Landmark> out = new ArrayList<>();
        int wy = k.y0 + Math.max(1, k.bh() / 50);
        out.add(k.lm("waistband_center", (k.left(wy) + k.right(wy)) / 2.0, k.y0, 0.8));
        out.add(k.lm("hem_left", k.left(k.y1), k.y1, 0.75));
        out.add(k.lm("hem_center", (k.left(k.y1) + k.right(k.y1)) / 2.0, k.y1, 0.75));
        out.add(k.lm("hem_right", k.right(k.y1), k.y1, 0.75));
        return out;
    }

    private static List<Landmark> upper(Mask k) {
        List<Landmark> out = new ArrayList<>();
        // decote: o ponto mais baixo do contorno superior no terço central
        int c0 = k.x0 + k.bw() / 3, c1 = k.x1 - k.bw() / 3;
        int neckX = -1, neckY = -1, highest = Integer.MAX_VALUE;
        for (int x = c0; x <= c1; x++) {
            int t = k.top(x);
            if (t < 0) {
                continue;
            }
            highest = Math.min(highest, t);
            if (t > neckY) {
                neckY = t;
                neckX = x;
            }
        }
        if (neckX >= 0) {
            double depth = (neckY - Math.min(highest, k.top(k.x0 + k.bw() / 4))) / (double) k.bh();
            out.add(k.lm("neckline_center", neckX, neckY, depth > 0.02 ? 0.75 : 0.45));
        }
        // axilas: maior queda de largura entre 15% e 70% da altura
        int armY = -1;
        double drop = 0;
        int maxW = 0;
        int[] widths = new int[k.h];
        for (int y = k.y0; y <= k.y1; y++) {
            int l = k.left(y), r = k.right(y);
            widths[y] = l < 0 ? 0 : r - l + 1;
            if (y < k.y0 + k.bh() / 2) {
                maxW = Math.max(maxW, widths[y]);
            }
        }
        int win = Math.max(2, k.bh() / 40);
        for (int y = k.y0 + k.bh() * 15 / 100; y <= k.y0 + k.bh() * 70 / 100 && y + win < k.h; y++) {
            double d = widths[y] - widths[y + win];
            if (d > drop) {
                drop = d;
                armY = y + win;
            }
        }
        Integer torsoL = null, torsoR = null;
        if (armY >= 0 && drop > maxW * 0.10) {
            torsoL = k.left(armY);
            torsoR = k.right(armY);
            out.add(k.lm("left_armpit", torsoL, armY, 0.7));
            out.add(k.lm("right_armpit", torsoR, armY, 0.7));
        }
        int sl = torsoL != null ? torsoL : k.x0 + k.bw() / 5;
        int sr = torsoR != null ? torsoR : k.x1 - k.bw() / 5;
        out.add(k.lm("left_shoulder", sl, Math.max(k.top(sl), k.y0), torsoL != null ? 0.7 : 0.45));
        out.add(k.lm("right_shoulder", sr, Math.max(k.top(sr), k.y0), torsoR != null ? 0.7 : 0.45));
        // pontas das mangas: extremos laterais (só quando a largura de cima supera o tronco — há mangas)
        if (torsoL != null) {
            out.add(k.lm("left_sleeve_end", k.x0, rowOfExtreme(k, true), 0.65));
            out.add(k.lm("right_sleeve_end", k.x1, rowOfExtreme(k, false), 0.65));
        }
        out.add(k.lm("hem_left", k.left(k.y1), k.y1, 0.75));
        out.add(k.lm("hem_center", (k.left(k.y1) + k.right(k.y1)) / 2.0, k.y1, 0.8));
        out.add(k.lm("hem_right", k.right(k.y1), k.y1, 0.75));
        return out;
    }

    private static int rowOfExtreme(Mask k, boolean left) {
        for (int y = k.y0; y <= k.y1; y++) {
            if (left ? k.left(y) == k.x0 : k.right(y) == k.x1) {
                return y;
            }
        }
        return (k.y0 + k.y1) / 2;
    }

    private static List<Landmark> footwear(Mask k, Map<String, Object> meta) {
        List<Landmark> out = new ArrayList<>();
        int band = Math.max(1, k.bw() / 4);
        double hl = avgHeight(k, k.x0, k.x0 + band), hr = avgHeight(k, k.x1 - band, k.x1);
        boolean heelLeft = hl > hr;
        int toeX = heelLeft ? k.x1 : k.x0, heelX = heelLeft ? k.x0 : k.x1;
        double conf = Math.abs(hl - hr) / Math.max(1, k.bh()) > 0.08 ? 0.75 : 0.5;
        out.add(k.lm("toe", toeX, rowAtColumn(k, toeX), conf));
        out.add(k.lm("heel", heelX, rowAtColumn(k, heelX), conf));
        int topX = k.x0, topY = Integer.MAX_VALUE;
        for (int x = k.x0; x <= k.x1; x++) {
            int t = k.top(x);
            if (t >= 0 && t < topY) {
                topY = t;
                topX = x;
            }
        }
        out.add(k.lm("collar_top", topX, topY, 0.6));
        out.add(k.lm("sole_front", toeX, k.bottom(toeX), 0.6));
        out.add(k.lm("sole_back", heelX, k.bottom(heelX), 0.6));
        meta.put("toeDirection", heelLeft ? "right" : "left");
        return out;
    }

    private static double avgHeight(Mask k, int a, int b) {
        double sum = 0;
        int n = 0;
        for (int x = a; x <= b; x++) {
            int t = k.top(x), bo = k.bottom(x);
            if (t >= 0) {
                sum += bo - t;
                n++;
            }
        }
        return n == 0 ? 0 : sum / n;
    }

    private static int rowAtColumn(Mask k, int x) {
        int t = k.top(x), b = k.bottom(x);
        return t < 0 ? (k.y0 + k.y1) / 2 : (t + b) / 2;
    }

    private static List<Landmark> bag(Mask k) {
        List<Landmark> out = new ArrayList<>();
        out.add(k.lm("handle_top", (k.left(k.y0) + k.right(k.y0)) / 2.0, k.y0, 0.7));
        int maxW = 0;
        for (int y = k.y0; y <= k.y1; y++) {
            maxW = Math.max(maxW, k.right(y) - k.left(y));
        }
        int bodyTop = k.y0;
        for (int y = k.y0; y <= k.y1; y++) {
            if (k.right(y) - k.left(y) >= maxW * 0.7) {
                bodyTop = y;
                break;
            }
        }
        out.add(k.lm("body_top_left", k.left(bodyTop), bodyTop, 0.65));
        out.add(k.lm("body_top_right", k.right(bodyTop), bodyTop, 0.65));
        out.add(k.lm("body_bottom_left", k.left(k.y1), k.y1, 0.65));
        out.add(k.lm("body_bottom_right", k.right(k.y1), k.y1, 0.65));
        return out;
    }

    private static List<Landmark> watch(Mask k) {
        int bestY = (k.y0 + k.y1) / 2, best = 0;
        for (int y = k.y0 + k.bh() / 5; y <= k.y1 - k.bh() / 5; y++) {
            int wdt = k.right(y) - k.left(y);
            if (wdt > best) {
                best = wdt;
                bestY = y;
            }
        }
        return List.of(k.lm("dial_center", (k.left(bestY) + k.right(bestY)) / 2.0, bestY, 0.6));
    }

    private static List<Landmark> glasses(Mask k) {
        int mid = (k.x0 + k.x1) / 2;
        double[] l = centroid(k, k.x0, mid), r = centroid(k, mid + 1, k.x1);
        List<Landmark> out = new ArrayList<>();
        out.add(k.lm("left_lens_center", l[0], l[1], 0.6));
        out.add(k.lm("right_lens_center", r[0], r[1], 0.6));
        out.add(k.lm("bridge_center", mid, Math.max(k.top(mid), k.y0), 0.55));
        return out;
    }

    private static double[] centroid(Mask k, int a, int b) {
        double sx = 0, sy = 0;
        long n = 0;
        for (int y = k.y0; y <= k.y1; y++) {
            for (int x = a; x <= b; x++) {
                if (k.at(x, y)) {
                    sx += x;
                    sy += y;
                    n++;
                }
            }
        }
        return n == 0 ? new double[]{(a + b) / 2.0, (k.y0 + k.y1) / 2.0} : new double[]{sx / n, sy / n};
    }

    private static List<Landmark> generic(Mask k) {
        double[] c = centroid(k, k.x0, k.x1);
        return List.of(k.lm("center", c[0], c[1], 0.7), k.lm("top", (k.left(k.y0) + k.right(k.y0)) / 2.0, k.y0, 0.7),
                k.lm("bottom", (k.left(k.y1) + k.right(k.y1)) / 2.0, k.y1, 0.7));
    }

    static double r(double v) {
        return Math.round(v * 10000) / 10000.0;
    }
}
