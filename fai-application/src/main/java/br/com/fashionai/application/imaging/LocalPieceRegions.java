package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * Conservative region proposals for separated objects on a plain flat-lay background.
 * A plain background uses connected foreground regions; a nonuniform surface uses adaptive graph
 * segmentation to separate touching fabrics by their boundaries. These are proposals, not a clothing
 * classifier: indistinguishable fabrics and complex scenes still need vision or manual boxes.
 * Work is bounded to a 480px image; no garment count or layout is assumed.
 */
public final class LocalPieceRegions {
    private LocalPieceRegions() { }

    public record Region(double x, double y, double width, double height, int rgb) { }

    public static List<Region> detect(BufferedImage photo) {
        BufferedImage img = ImageOps.scaleToFit(photo, 480, 480);
        int w = img.getWidth(), h = img.getHeight(), size = w * h;
        int[] pixels = img.getRGB(0, 0, w, h, null, 0, w);
        int[] border = new int[2 * w + 2 * h];
        int n = 0, transparent = 0;
        for (int x = 0; x < w; x++) { border[n++] = pixels[x]; border[n++] = pixels[(h - 1) * w + x]; }
        for (int y = 0; y < h; y++) { border[n++] = pixels[y * w]; border[n++] = pixels[y * w + w - 1]; }
        int[][] channels = new int[3][n];
        for (int i = 0; i < n; i++) {
            if ((border[i] >>> 24) < 40) transparent++;
            for (int c = 0; c < 3; c++) channels[c][i] = (border[i] >> (16 - 8 * c)) & 255;
        }
        for (int[] channel : channels) Arrays.sort(channel);
        int background = (channels[0][n / 2] << 16) | (channels[1][n / 2] << 8) | channels[2][n / 2];
        boolean alpha = transparent > n * 0.8;
        long uniform = Arrays.stream(border).filter(p -> distance(p, background) < 42 * 42).count();
        if (!alpha && uniform < n * 0.8) return FabricRegionGraph.detect(img);

        boolean[] foreground = new boolean[size];
        for (int i = 0; i < size; i++) {
            foreground[i] = (pixels[i] >>> 24) >= 40 && (alpha || distance(pixels[i], background) > 42 * 42);
        }
        boolean[] seen = new boolean[size];
        int[] queue = new int[size];
        List<Region> out = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            if (seen[i] || !foreground[i]) continue;
            int head = 0, tail = 1, minX = w, maxX = 0, minY = h, maxY = 0;
            queue[0] = i; seen[i] = true;
            while (head < tail) {
                int p = queue[head++], x = p % w, y = p / w;
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
                    int nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                    int next = ny * w + nx;
                    if (!seen[next] && foreground[next]) { seen[next] = true; queue[tail++] = next; }
                }
            }
            int bw = maxX - minX + 1, bh = maxY - minY + 1;
            // Discard background remnants, edge furniture and small speckles rather than creating fake garments.
            if (tail < size * 0.012 || tail > size * 0.75 || minX == 0 || minY == 0 || maxX == w - 1 || maxY == h - 1
                    || bw < w * 0.06 || bh < h * 0.06 || tail < bw * bh * 0.2) continue;
            long red = 0, green = 0, blue = 0;
            for (int j = 0; j < tail; j++) {
                int color = pixels[queue[j]];
                red += (color >> 16) & 255; green += (color >> 8) & 255; blue += color & 255;
            }
            int rgb = ((int) (red / tail) << 16) | ((int) (green / tail) << 8) | (int) (blue / tail);
            out.add(new Region(100.0 * minX / w, 100.0 * minY / h, 100.0 * bw / w, 100.0 * bh / h, rgb));
        }
        // Stable reading order makes numbered slots correspond to the arrangement in the photo.
        out.sort(Comparator.comparingDouble(Region::y).thenComparingDouble(Region::x));
        // Excessive fragmentation is an unsupported background, not a collection of garments.
        List<Region> simple = out.size() > 12 ? List.of() : List.copyOf(out);
        // Connected foreground joins sleeves that touch; graph boundaries can keep their fabrics apart.
        if (!alpha) {
            List<Region> segmented = FabricRegionGraph.detect(img);
            if (segmented.size() > simple.size()) return segmented;
        }
        return simple;
    }

    private static int distance(int a, int b) {
        int r = ((a >> 16) & 255) - ((b >> 16) & 255);
        int g = ((a >> 8) & 255) - ((b >> 8) & 255);
        int blue = (a & 255) - (b & 255);
        return r * r + g * g + blue * blue;
    }
}
