package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;
import java.util.Optional;

/**
 * Largest fixed-aspect rectangle wholly inside the garment's opaque pixels. Bounding boxes include the gaps around
 * sleeves and necklines; this scan measures fabric instead. O(width × height), O(width) extra space, no synthesis.
 */
public final class GarmentCrop {
    public static final String VERSION = "GARMENT_COVER_V1";
    private GarmentCrop() { }

    public static Optional<ImageOps.Box> find(BufferedImage garment, int aspectW, int aspectH, double focusX, double focusY) {
        if (aspectW < 1 || aspectH < 1) throw new IllegalArgumentException("invalid aspect");
        return find(garment, aspectW, aspectH, focusX, focusY, new ImageOps.Box(0, 0, garment.getWidth(), garment.getHeight()));
    }

    public static Optional<ImageOps.Box> find(BufferedImage garment, int aspectW, int aspectH, double focusX, double focusY, ImageOps.Box region) {
        if (aspectW < 1 || aspectH < 1) throw new IllegalArgumentException("invalid aspect");
        int w = garment.getWidth(), h = garment.getHeight();
        int[] heights = new int[w], stack = new int[w + 1], row = new int[w];
        ImageOps.Box best = null;
        double bestScore = -1;
        for (int y = Math.max(0, region.y()); y < Math.min(h, region.y() + region.h()); y++) {
            garment.getRGB(0, y, w, 1, row, 0, w);
            for (int x = 0; x < w; x++) heights[x] = x >= region.x() && x < region.x() + region.w() && (row[x] >>> 24) >= 250 ? heights[x] + 1 : 0;
            int n = 0;
            for (int x = 0; x <= w; x++) {
                int height = x == w ? 0 : heights[x];
                while (n > 0 && heights[stack[n - 1]] > height) {
                    int rh = heights[stack[--n]], left = n == 0 ? 0 : stack[n - 1] + 1, rw = x - left;
                    // One source pixel on each edge keeps interpolation and normalized-coordinate rounding off the mask boundary.
                    int units = Math.min((rw - 2) / aspectW, (rh - 2) / aspectH);
                    if (units * Math.min(aspectW, aspectH) < 32) continue;
                    int cw = units * aspectW, ch = units * aspectH;
                    int cy = clamp((int) Math.round(focusY - ch * 0.32), y - rh + 2, y - ch);
                    int cx = clamp((int) Math.round(focusX - cw * 0.5), left + 1, x - cw - 1);
                    double dx = (focusX - (cx + cw * 0.5)) / cw, dy = (focusY - (cy + ch * 0.32)) / ch;
                    double proximity = 1 / (1 + dx * dx + dy * dy);
                    double score = (double) cw * ch * (0.75 + 0.25 * proximity);
                    if (score > bestScore) { bestScore = score; best = new ImageOps.Box(cx, cy, cw, ch); }
                }
                stack[n++] = x;
            }
        }
        return Optional.ofNullable(best);
    }

    /** Waist-to-crotch window: prevents a large isolated leg from winning the fabric scan. */
    public record LowerRegion(ImageOps.Box box, boolean estimatedPerson) { }

    public static LowerRegion lowerRegion(BufferedImage garment, boolean personEvidence) {
        ImageOps.Box b = ImageOps.alphaBounds(garment);
        if (b.empty()) return new LowerRegion(b, false);
        int cx = b.x() + b.w() / 2, split = -1, streak = 0;
        int required = Math.max(3, b.h() / 100);
        for (int y = b.y() + b.h() / 5; y < b.y() + b.h() * 9 / 10; y++) {
            boolean gap = (garment.getRGB(cx, y) >>> 24) < 250;
            boolean left = false, right = false;
            for (int x = b.x(); x < cx; x++) left |= (garment.getRGB(x, y) >>> 24) >= 250;
            for (int x = cx + 1; x < b.x() + b.w(); x++) right |= (garment.getRGB(x, y) >>> 24) >= 250;
            streak = gap && left && right ? streak + 1 : 0;
            if (streak >= required) { split = y - streak + 1; break; }
        }
        // A full-person silhouette has the leg split below the body midpoint. This is explicitly an estimate,
        // never a claimed pose landmark; ambiguous sources retain the human-occlusion review gate.
        boolean model = personEvidence && split > b.y() + b.h() / 2;
        int top = model ? Math.max(b.y(), split - (int) Math.round(b.h() * 0.18)) : b.y();
        int bottom = split > top ? split : b.y() + Math.max(1, b.h() / 2);
        return new LowerRegion(new ImageOps.Box(b.x(), top, b.w(), Math.max(1, bottom - top)), model);
    }

    public static BufferedImage render(BufferedImage garment, ImageOps.Box crop, int width, int height) {
        // Crop before resampling: pixels outside the mask must never enter the border via interpolation.
        return ImageOps.scale(ImageOps.crop(garment, crop), width, height);
    }

    private static int clamp(int n, int lo, int hi) { return Math.max(lo, Math.min(hi, n)); }
}
