package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import static br.com.fashionai.application.catalog.image.FabricFrame.ASPECT_H;
import static br.com.fashionai.application.catalog.image.FabricFrame.ASPECT_W;

/**
 * Busca do maior retângulo 3:4 inteiramente em tecido que contém o ponto de ancoragem da categoria (busca binária no
 * tamanho, varredura das posições com soma de prefixos).
 */
final class FabricAnchor {
    private FabricAnchor() {
    }

    /**
     * Maior retângulo 3:4 inteiramente em tecido (dentro da região) que contém o ponto da categoria; o ponto fica a ~1/3 do
     * topo quando dá. Busca binária no tamanho (se um tamanho cabe com o ponto dentro, um menor também cabe) e varredura das
     * posições com soma de prefixos. Ponto fora do tecido: o pixel de tecido mais próximo dentro da região.
     */
    static ImageOps.Box anchored(boolean[] fabric, int w, int h, ImageOps.Box region, double fx, double fy) {
        if (region.w() <= 0 || region.h() <= 0) return null;
        int[] pre = new int[(w + 1) * (h + 1)];
        for (int y = 0; y < h; y++) {
            int run = 0;
            for (int x = 0; x < w; x++) {
                boolean free = fabric[y * w + x] && x >= region.x() && x < region.x() + region.w() && y >= region.y() && y < region.y() + region.h();
                run += free ? 0 : 1;
                pre[(y + 1) * (w + 1) + x + 1] = pre[y * (w + 1) + x + 1] + run;
            }
        }
        int[] a = nearestFree(fabric, w, region, (int) Math.round(fx), (int) Math.round(fy));
        if (a == null) return null;
        int ax = a[0], ay = a[1];
        int lo = 1, hi = Math.min(region.w() / ASPECT_W, region.h() / ASPECT_H);
        ImageOps.Box best = null;
        while (lo <= hi) {
            int u = (lo + hi) >>> 1;
            ImageOps.Box found = place(pre, w, region, ax, ay, u * ASPECT_W, u * ASPECT_H);
            if (found != null) { best = found; lo = u + 1; } else hi = u - 1;
        }
        return best;
    }

    private static ImageOps.Box place(int[] pre, int w, ImageOps.Box region, int ax, int ay, int cw, int ch) {
        int xMin = Math.max(region.x(), ax - cw + 1), xMax = Math.min(region.x() + region.w() - cw, ax);
        int yMin = Math.max(region.y(), ay - ch + 1), yMax = Math.min(region.y() + region.h() - ch, ay);
        if (xMin > xMax || yMin > yMax) return null;
        int step = Math.max(1, Math.min(cw, ch) / 48);
        double wantX = ax - cw / 2.0, wantY = ay - ch * 0.32;
        ImageOps.Box best = null;
        double bestD = Double.MAX_VALUE;
        for (int y = yMin; y <= yMax; y = y < yMax && y + step > yMax ? yMax : y + step) {
            for (int x = xMin; x <= xMax; x = x < xMax && x + step > xMax ? xMax : x + step) {
                int blocked = pre[(y + ch) * (w + 1) + x + cw] - pre[y * (w + 1) + x + cw] - pre[(y + ch) * (w + 1) + x] + pre[y * (w + 1) + x];
                if (blocked == 0) {
                    double d = (x - wantX) * (x - wantX) + (y - wantY) * (y - wantY);
                    if (d < bestD) { bestD = d; best = new ImageOps.Box(x, y, cw, ch); }
                }
                if (x == xMax) break;
            }
            if (y == yMax) break;
        }
        return best;
    }

    private static int[] nearestFree(boolean[] fabric, int w, ImageOps.Box region, int x, int y) {
        int maxR = Math.max(region.w(), region.h());
        for (int r = 0; r <= maxR; r++) {
            for (int dy = -r; dy <= r; dy++) {
                for (int dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) != r) continue;
                    int xx = x + dx, yy = y + dy;
                    if (xx < region.x() || yy < region.y() || xx >= region.x() + region.w() || yy >= region.y() + region.h()) continue;
                    if (fabric[yy * w + xx]) return new int[]{xx, yy};
                }
            }
            if (r > 0 && r % 64 == 0 && r > maxR / 3) break;   // longe demais do ponto da categoria: não é o mesmo lugar
        }
        return null;
    }
}
