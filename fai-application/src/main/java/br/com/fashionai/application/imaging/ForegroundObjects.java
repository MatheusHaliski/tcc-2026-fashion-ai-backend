package br.com.fashionai.application.imaging;

import br.com.fashionai.application.imaging.LocalPieceRegions.Region;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Objetos da foto sem classificador: os blocos conexos de pixels longe da cor do fundo (a mediana da borda, com o limiar
 * pelo espalhamento da própria borda — o mesmo critério de {@link LocalPieceRegions#byBackground}). Cada objeto guarda a
 * caixa e os seus pixels; {@link #objectOf} diz em qual objeto uma região por cor está.
 */
final class ForegroundObjects {
    private final int w;
    private final int h;
    private final int[] pixels;
    /** rótulo do objeto de cada pixel (0 = fundo) */
    private final int[] label;
    private final List<int[]> boxes = new ArrayList<>();
    private final List<Integer> labels = new ArrayList<>();

    private ForegroundObjects(int[] pixels, int w, int h) {
        this.pixels = pixels;
        this.w = w;
        this.h = h;
        this.label = new int[w * h];
    }

    /** @param minArea,maxArea fração da foto: menor é ruído; maior é a própria superfície, não um objeto sobre ela */
    static ForegroundObjects find(int[] pixels, int w, int h, double minArea, double maxArea) {
        ForegroundObjects out = new ForegroundObjects(pixels, w, h);
        boolean[] fg = mask(pixels, w, h);
        int size = w * h, next = 0;
        int[] queue = new int[size];
        for (int i = 0; i < size; i++) {
            if (!fg[i] || out.label[i] != 0) {
                continue;
            }
            int id = ++next, head = 0, tail = 1, minX = w, maxX = 0, minY = h, maxY = 0;
            queue[0] = i;
            out.label[i] = id;
            while (head < tail) {
                int p = queue[head++], x = p % w, y = p / w;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = x + dx, ny = y + dy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
                            continue;
                        }
                        int q = ny * w + nx;
                        if (fg[q] && out.label[q] == 0) {
                            out.label[q] = id;
                            queue[tail++] = q;
                        }
                    }
                }
            }
            int sides = (minX == 0 ? 1 : 0) + (minY == 0 ? 1 : 0) + (maxX == w - 1 ? 1 : 0) + (maxY == h - 1 ? 1 : 0);
            if (tail >= size * minArea && tail <= size * maxArea && sides <= 2) {
                out.boxes.add(new int[]{minX, minY, maxX, maxY});
                out.labels.add(id);
            }
        }
        return out;
    }

    /** Pixels longe da cor mediana da borda, com abertura (fios, sombras finas) e fechamento (costuras, estampa). */
    private static boolean[] mask(int[] pixels, int w, int h) {
        int background = LocalPieceRegions.borderMedian(pixels, w, h);
        int n = 2 * w + 2 * h, k = 0;
        double[] spread = new double[n];
        for (int x = 0; x < w; x++) {
            spread[k++] = PixelStats.distance(pixels[x], background);
            spread[k++] = PixelStats.distance(pixels[(h - 1) * w + x], background);
        }
        for (int y = 0; y < h; y++) {
            spread[k++] = PixelStats.distance(pixels[y * w], background);
            spread[k++] = PixelStats.distance(pixels[y * w + w - 1], background);
        }
        Arrays.sort(spread);
        double threshold = Math.max(42, Math.min(96, spread[(int) (n * 0.9)] * 1.3 + 12));
        boolean[] fg = new boolean[w * h];
        for (int i = 0; i < fg.length; i++) {
            fg[i] = PixelStats.distance(pixels[i], background) > threshold;
        }
        boolean[] opened = LocalPieceRegions.erode(LocalPieceRegions.dilate(LocalPieceRegions.erode(fg, w, h), w, h), w, h);
        boolean[] grown = LocalPieceRegions.dilate(LocalPieceRegions.dilate(opened, w, h), w, h);
        return LocalPieceRegions.erode(LocalPieceRegions.erode(grown, w, h), w, h);
    }

    int count() {
        return boxes.size();
    }

    /** A caixa do objeto, em % da foto, com a cor informada. */
    Region region(int object, int rgb) {
        int[] b = boxes.get(object);
        return new Region(100.0 * b[0] / w, 100.0 * b[1] / h, 100.0 * (b[2] - b[0] + 1) / w, 100.0 * (b[3] - b[1] + 1) / h, rgb);
    }

    /** O objeto com mais pixels dentro da caixa da região; -1 quando a região não está em nenhum objeto medido. */
    int objectOf(Region r) {
        int x0 = clamp((int) (r.x() * w / 100), w), x1 = clamp((int) ((r.x() + r.width()) * w / 100), w);
        int y0 = clamp((int) (r.y() * h / 100), h), y1 = clamp((int) ((r.y() + r.height()) * h / 100), h);
        int[] hits = new int[boxes.size()];
        for (int y = y0; y <= y1; y++) {
            for (int x = x0; x <= x1; x++) {
                int object = labels.indexOf(label[y * w + x]);
                if (object >= 0) {
                    hits[object]++;
                }
            }
        }
        int best = -1;
        for (int i = 0; i < hits.length; i++) {
            if (hits[i] > 0 && (best < 0 || hits[i] > hits[best])) {
                best = i;
            }
        }
        return best;
    }

    /** Cor mais frequente dos pixels do objeto. */
    int dominantColor(int object) {
        int id = labels.get(object), n = 0;
        int[] indices = new int[w * h];
        for (int i = 0; i < label.length; i++) {
            if (label[i] == id) {
                indices[n++] = i;
            }
        }
        return PixelStats.dominant(pixels, indices, n);
    }

    private static int clamp(int v, int size) {
        return Math.max(0, Math.min(size - 1, v));
    }
}
