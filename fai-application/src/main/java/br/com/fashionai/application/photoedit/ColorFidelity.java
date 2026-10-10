package br.com.fashionai.application.photoedit;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.imaging.ImageOps;

import java.awt.image.BufferedImage;

/**
 * RF15 · Fidelidade de cor: CIEDE2000 entre a cor média (Lab) da peça antes e depois dos ajustes de cor. ΔE < 2 é
 * praticamente imperceptível; acima de 5 a pessoa já vê outra cor — o editor avisa (CA04).
 */
public final class ColorFidelity {
    public static final double WARN_DELTA_E = 5;

    private ColorFidelity() {
    }

    /** Lab médio dos pixels opacos (alfa > 240); null sem pixels. */
    public static double[] meanLab(BufferedImage img) {
        BufferedImage s = ImageOps.scaleToFit(img, 400, 400);
        int[] px = s.getRGB(0, 0, s.getWidth(), s.getHeight(), null, 0, s.getWidth());
        boolean alpha = img.getColorModel().hasAlpha();
        double l = 0, a = 0, b = 0;
        long n = 0;
        for (int p : px) {
            if (!alpha || ((p >>> 24) & 0xFF) > 240) {
                double[] lab = ColorMath.lab(p);
                l += lab[0];
                a += lab[1];
                b += lab[2];
                n++;
            }
        }
        return n == 0 ? null : new double[]{l / n, a / n, b / n};
    }

    public static double deltaE(BufferedImage before, BufferedImage after) {
        double[] x = meanLab(before), y = meanLab(after);
        return x == null || y == null ? 0 : ciede2000(x, y);
    }

    /** CIEDE2000 (Sharma, Wu, Dalal 2005), kL = kC = kH = 1. */
    public static double ciede2000(double[] lab1, double[] lab2) {
        double l1 = lab1[0], a1 = lab1[1], b1 = lab1[2], l2 = lab2[0], a2 = lab2[1], b2 = lab2[2];
        double c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2), cBar = (c1 + c2) / 2;
        double g = 0.5 * (1 - Math.sqrt(Math.pow(cBar, 7) / (Math.pow(cBar, 7) + Math.pow(25, 7))));
        double a1p = (1 + g) * a1, a2p = (1 + g) * a2;
        double c1p = Math.hypot(a1p, b1), c2p = Math.hypot(a2p, b2);
        double h1p = hue(b1, a1p), h2p = hue(b2, a2p);
        double dL = l2 - l1, dC = c2p - c1p;
        double dh;
        if (c1p * c2p == 0) {
            dh = 0;
        } else if (Math.abs(h2p - h1p) <= 180) {
            dh = h2p - h1p;
        } else if (h2p - h1p > 180) {
            dh = h2p - h1p - 360;
        } else {
            dh = h2p - h1p + 360;
        }
        double dH = 2 * Math.sqrt(c1p * c2p) * Math.sin(Math.toRadians(dh / 2));
        double lBar = (l1 + l2) / 2, cBarP = (c1p + c2p) / 2;
        double hBar;
        if (c1p * c2p == 0) {
            hBar = h1p + h2p;
        } else if (Math.abs(h1p - h2p) <= 180) {
            hBar = (h1p + h2p) / 2;
        } else if (h1p + h2p < 360) {
            hBar = (h1p + h2p + 360) / 2;
        } else {
            hBar = (h1p + h2p - 360) / 2;
        }
        double t = 1 - 0.17 * Math.cos(Math.toRadians(hBar - 30)) + 0.24 * Math.cos(Math.toRadians(2 * hBar))
                + 0.32 * Math.cos(Math.toRadians(3 * hBar + 6)) - 0.20 * Math.cos(Math.toRadians(4 * hBar - 63));
        double dTheta = 30 * Math.exp(-Math.pow((hBar - 275) / 25, 2));
        double rc = 2 * Math.sqrt(Math.pow(cBarP, 7) / (Math.pow(cBarP, 7) + Math.pow(25, 7)));
        double sl = 1 + 0.015 * Math.pow(lBar - 50, 2) / Math.sqrt(20 + Math.pow(lBar - 50, 2));
        double sc = 1 + 0.045 * cBarP, sh = 1 + 0.015 * cBarP * t;
        double rt = -Math.sin(Math.toRadians(2 * dTheta)) * rc;
        return Math.sqrt(Math.pow(dL / sl, 2) + Math.pow(dC / sc, 2) + Math.pow(dH / sh, 2) + rt * (dC / sc) * (dH / sh));
    }

    private static double hue(double b, double a) {
        if (a == 0 && b == 0) {
            return 0;
        }
        double h = Math.toDegrees(Math.atan2(b, a));
        return h < 0 ? h + 360 : h;
    }
}
