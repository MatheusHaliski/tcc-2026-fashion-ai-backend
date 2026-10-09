package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.List;

/**
 * Bounded Felzenszwalb-style graph segmentation for flat-lay region proposals. Neighboring pixels
 * merge when their boundary is weaker than either component's internal variation plus k / area.
 * Border-connected regions are excluded as background/furniture; tiny regions merge before boxes
 * are proposed. This deliberately does not assign garment types or infer invisible boundaries.
 */
final class FabricRegionGraph {
    private static final int BITS = 18; // 480 * 480 < 2^18
    private static final long MASK = (1L << BITS) - 1;
    private static final int SCALE = 10;
    private static final int K = 450 * SCALE;

    private FabricRegionGraph() { }

    static List<LocalPieceRegions.Region> detect(BufferedImage image) {
        int w = image.getWidth(), h = image.getHeight(), n = w * h;
        int[] pixels = image.getRGB(0, 0, w, h, null, 0, w);
        int[] smooth = blur(pixels, w, h);
        long[] edges = new long[(w - 1) * h + w * (h - 1) + 2 * (w - 1) * (h - 1)];
        int count = 0;
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int a = y * w + x;
            if (x + 1 < w) edges[count++] = edge(a, a + 1, smooth);
            if (y + 1 < h) {
                edges[count++] = edge(a, a + w, smooth);
                if (x + 1 < w) edges[count++] = edge(a, a + w + 1, smooth);
                if (x > 0) edges[count++] = edge(a, a + w - 1, smooth);
            }
        }
        Arrays.sort(edges);
        Components components = new Components(n);
        for (long edge : edges) {
            int a = components.find((int) ((edge >> BITS) & MASK));
            int b = components.find((int) (edge & MASK));
            int weight = (int) (edge >> (2 * BITS));
            if (a != b && weight <= components.internal[a] + K / components.size[a]
                    && weight <= components.internal[b] + K / components.size[b]) components.merge(a, b, weight);
        }
        int minimum = Math.max(20, n / 1000);
        for (long edge : edges) {
            int a = components.find((int) ((edge >> BITS) & MASK));
            int b = components.find((int) (edge & MASK));
            if (a != b && (components.size[a] < minimum || components.size[b] < minimum)) {
                components.merge(a, b, (int) (edge >> (2 * BITS)));
            }
        }
        Bounds bounds = measure(components, pixels, w, h);
        // A print/color block within one fabric has a long shared boundary. Two neighboring
        // sleeves only touch briefly. Merge strong region adjacency before proposing garment boxes.
        boolean[] candidate = new boolean[n];
        for (int i = 0; i < n; i++) candidate[i] = components.find(i) == i && bounds.accept(i, components.size[i], w, h);
        Map<Long, Integer> contact = new HashMap<>();
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int a = components.find(y * w + x);
            if (!candidate[a]) continue;
            if (x + 1 < w) contactAlong(contact, a, y * w + x, 1, Math.min(8, w - x - 1), candidate, components, bounds, n);
            if (y + 1 < h) contactAlong(contact, a, y * w + x, w, Math.min(8, h - y - 1), candidate, components, bounds, n);
        }
        for (Map.Entry<Long, Integer> pair : contact.entrySet()) {
            int a = (int) (pair.getKey() >> 32), b = (int) (long) pair.getKey();
            int side = Math.min(Math.min(bounds.width(a), bounds.height(a)), Math.min(bounds.width(b), bounds.height(b)));
            if (pair.getValue() >= side * .45) {
                a = components.find(a); b = components.find(b);
                if (a != b) components.merge(a, b, 0);
            }
        }
        bounds = measure(components, pixels, w, h);
        List<LocalPieceRegions.Region> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if (components.find(i) != i || !bounds.accept(i, components.size[i], w, h)) continue;
            int area = components.size[i];
            int rgb = ((int) (bounds.red[i] / area) << 16) | ((int) (bounds.green[i] / area) << 8) | (int) (bounds.blue[i] / area);
            out.add(new LocalPieceRegions.Region(100.0 * bounds.minX[i] / w, 100.0 * bounds.minY[i] / h,
                    100.0 * bounds.width(i) / w, 100.0 * bounds.height(i) / h, rgb));
        }
        out.sort(Comparator.comparingDouble(LocalPieceRegions.Region::y).thenComparingDouble(LocalPieceRegions.Region::x));
        return out.size() > 12 ? List.of() : List.copyOf(out);
    }

    /** Cross only a narrow, small transition region introduced by blur, never a large background. */
    private static void contactAlong(Map<Long, Integer> pairs, int a, int pixel, int stride, int length,
                                     boolean[] candidate, Components components, Bounds bounds, int imageArea) {
        if (components.find(pixel + stride) == a) return;
        for (int distance = 1; distance <= length; distance++) {
            int b = components.find(pixel + distance * stride);
            if (candidate[b]) { contact(pairs, a, b, candidate); return; }
            if (bounds.minX[b] == 0 || bounds.minY[b] == 0 || bounds.maxX[b] == bounds.imageWidth - 1 || bounds.maxY[b] == bounds.imageHeight - 1) return;
            if (components.size[b] >= imageArea * .012 && components.size[b] >= bounds.width(b) * bounds.height(b) * .2) return;
        }
    }

    private static void contact(Map<Long, Integer> pairs, int a, int b, boolean[] candidate) {
        if (a == b || !candidate[b]) return;
        long key = ((long) Math.min(a, b) << 32) | Math.max(a, b);
        pairs.merge(key, 1, Integer::sum);
    }

    private static Bounds measure(Components components, int[] pixels, int w, int h) {
        Bounds bounds = new Bounds(pixels.length, w, h);
        for (int i = 0; i < pixels.length; i++) {
            int root = components.find(i), x = i % w, y = i / w;
            bounds.minX[root] = Math.min(bounds.minX[root], x); bounds.maxX[root] = Math.max(bounds.maxX[root], x);
            bounds.minY[root] = Math.min(bounds.minY[root], y); bounds.maxY[root] = Math.max(bounds.maxY[root], y);
            bounds.red[root] += (pixels[i] >> 16) & 255; bounds.green[root] += (pixels[i] >> 8) & 255; bounds.blue[root] += pixels[i] & 255;
        }
        return bounds;
    }

    private static final class Bounds {
        final int[] minX, minY, maxX, maxY;
        final int imageWidth, imageHeight;
        final long[] red, green, blue;
        Bounds(int n, int w, int h) {
            imageWidth = w; imageHeight = h;
            minX = new int[n]; minY = new int[n]; maxX = new int[n]; maxY = new int[n];
            red = new long[n]; green = new long[n]; blue = new long[n];
            Arrays.fill(minX, w); Arrays.fill(minY, h);
        }
        int width(int i) { return maxX[i] - minX[i] + 1; }
        int height(int i) { return maxY[i] - minY[i] + 1; }
        boolean accept(int i, int area, int w, int h) {
            return area >= w * h * .012 && area <= w * h * .75 && minX[i] > 0 && minY[i] > 0
                    && maxX[i] < w - 1 && maxY[i] < h - 1 && width(i) >= w * .06 && height(i) >= h * .06
                    && area >= width(i) * height(i) * .2;
        }
    }

    private static long edge(int a, int b, int[] colors) {
        int r = ((colors[a] >> 16) & 255) - ((colors[b] >> 16) & 255);
        int g = ((colors[a] >> 8) & 255) - ((colors[b] >> 8) & 255);
        int blue = (colors[a] & 255) - (colors[b] & 255);
        long weight = Math.round(Math.sqrt(r * r + g * g + blue * blue) * SCALE);
        return (weight << (2 * BITS)) | ((long) a << BITS) | b;
    }

    private static int[] blur(int[] pixels, int w, int h) {
        int[] result = new int[pixels.length];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int red = 0, green = 0, blue = 0, weight = 0;
            for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
                int p = pixels[Math.clamp(y + dy, 0, h - 1) * w + Math.clamp(x + dx, 0, w - 1)];
                int k = (dx == 0 ? 2 : 1) * (dy == 0 ? 2 : 1);
                red += k * ((p >> 16) & 255); green += k * ((p >> 8) & 255); blue += k * (p & 255); weight += k;
            }
            result[y * w + x] = (red / weight << 16) | (green / weight << 8) | blue / weight;
        }
        return result;
    }

    private static final class Components {
        final int[] parent, size, internal;
        Components(int n) {
            parent = new int[n]; size = new int[n]; internal = new int[n];
            for (int i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
        }
        int find(int i) {
            int root = i;
            while (parent[root] != root) root = parent[root];
            while (parent[i] != i) { int next = parent[i]; parent[i] = root; i = next; }
            return root;
        }
        void merge(int a, int b, int weight) {
            if (size[a] < size[b]) { int tmp = a; a = b; b = tmp; }
            parent[b] = a; size[a] += size[b]; internal[a] = Math.max(weight, Math.max(internal[a], internal[b]));
        }
    }
}
