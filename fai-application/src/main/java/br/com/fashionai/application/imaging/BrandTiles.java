package br.com.fashionai.application.imaging;

import br.com.fashionai.application.imaging.BrandRegions.Zone;

import java.util.ArrayList;
import java.util.List;

import static br.com.fashionai.application.imaging.BrandRegions.clamp;
import static br.com.fashionai.application.imaging.BrandRegions.round;

/**
 * RF4 — grade de nova tentativa de leitura da marca ({@link BrandRegions#tiles}): só geometria relativa (0–1), sem
 * pixels. Sub-retângulos com 25% de sobreposição e, havendo caixa de logo, o logo ampliado 1,6× e seus quadrantes.
 */
final class BrandTiles {
    private BrandTiles() {
    }

    static List<Zone> tiles(double[] logoRel, int grid) {
        int g = Math.max(2, Math.min(5, grid));
        List<Zone> out = new ArrayList<>();
        if (logoRel != null && logoRel.length == 4) {
            double cx = (logoRel[0] + logoRel[2]) / 2, cy = (logoRel[1] + logoRel[3]) / 2;
            double hw = Math.max(0.06, (logoRel[2] - logoRel[0]) * 0.8), hh = Math.max(0.06, (logoRel[3] - logoRel[1]) * 0.8);
            double[] b = {clamp(cx - hw), clamp(cy - hh), clamp(cx + hw), clamp(cy + hh)};
            out.add(new Zone("logo", round4(b)));
            double mx = (b[0] + b[2]) / 2, my = (b[1] + b[3]) / 2;
            double[][] q = {{b[0], b[1], mx, my}, {mx, b[1], b[2], my}, {b[0], my, mx, b[3]}, {mx, my, b[2], b[3]}};
            for (int i = 0; i < 4; i++) {
                double ox = (q[i][2] - q[i][0]) * 0.2, oy = (q[i][3] - q[i][1]) * 0.2;
                out.add(new Zone("logo_q" + (i + 1), round4(new double[]{clamp(q[i][0] - ox), clamp(q[i][1] - oy), clamp(q[i][2] + ox), clamp(q[i][3] + oy)})));
            }
        }
        double size = Math.min(1.0, 1.25 / g);
        double step = g == 1 ? 0 : (1 - size) / (g - 1);
        for (int r = 0; r < g; r++) {
            for (int c = 0; c < g; c++) {
                double x0 = c * step, y0 = r * step;
                out.add(new Zone("grade_r" + (r + 1) + "c" + (c + 1), round4(new double[]{x0, y0, Math.min(1, x0 + size), Math.min(1, y0 + size)})));
            }
        }
        return out;
    }

    private static double[] round4(double[] b) {
        return new double[]{round(b[0]), round(b[1]), round(b[2]), round(b[3])};
    }
}
