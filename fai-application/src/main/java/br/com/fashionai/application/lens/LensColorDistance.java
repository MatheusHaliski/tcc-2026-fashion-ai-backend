package br.com.fashionai.application.lens;

import br.com.fashionai.application.ai.local.ColorMath;

/**
 * ΔE00 (CIEDE2000, Sharma et al. 2005) da cor do Lens: distância perceptual entre duas cores, usada por
 * {@link LensSimilarity#color} (cor = max(0, 1 − ΔE00/40)). Pura e determinística.
 */
final class LensColorDistance {
    private LensColorDistance() {
    }

    static double deltaE00(int rgbA, int rgbB) {
        return deltaE00(ColorMath.lab(rgbA), ColorMath.lab(rgbB));
    }

    static double deltaE00(double[] lab1, double[] lab2) {
        double l1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
        double l2 = lab2[0], a2 = lab2[1], b2 = lab2[2];
        double c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2);
        double cBar7 = Math.pow((c1 + c2) / 2, 7);
        double g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + Math.pow(25, 7))));
        double a1p = (1 + g) * a1, a2p = (1 + g) * a2;
        double c1p = Math.hypot(a1p, b1), c2p = Math.hypot(a2p, b2);
        double h1p = hue(a1p, b1), h2p = hue(a2p, b2);

        double dLp = l2 - l1;
        double dCp = c2p - c1p;
        double dhp;
        if (c1p * c2p == 0) {
            dhp = 0;
        } else {
            dhp = h2p - h1p;
            if (dhp > 180) {
                dhp -= 360;
            } else if (dhp < -180) {
                dhp += 360;
            }
        }
        double dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(Math.toRadians(dhp / 2));

        double lBarP = (l1 + l2) / 2;
        double cBarP = (c1p + c2p) / 2;
        double hBarP;
        if (c1p * c2p == 0) {
            hBarP = h1p + h2p;
        } else if (Math.abs(h1p - h2p) <= 180) {
            hBarP = (h1p + h2p) / 2;
        } else if (h1p + h2p < 360) {
            hBarP = (h1p + h2p + 360) / 2;
        } else {
            hBarP = (h1p + h2p - 360) / 2;
        }
        double t = 1 - 0.17 * cosDeg(hBarP - 30) + 0.24 * cosDeg(2 * hBarP) + 0.32 * cosDeg(3 * hBarP + 6)
                - 0.20 * cosDeg(4 * hBarP - 63);
        double dTheta = 30 * Math.exp(-Math.pow((hBarP - 275) / 25, 2));
        double cBarP7 = Math.pow(cBarP, 7);
        double rc = 2 * Math.sqrt(cBarP7 / (cBarP7 + Math.pow(25, 7)));
        double lMinus = Math.pow(lBarP - 50, 2);
        double sl = 1 + 0.015 * lMinus / Math.sqrt(20 + lMinus);
        double sc = 1 + 0.045 * cBarP;
        double sh = 1 + 0.015 * cBarP * t;
        double rt = -Math.sin(Math.toRadians(2 * dTheta)) * rc;
        double tl = dLp / sl, tc = dCp / sc, th = dHp / sh;
        return Math.sqrt(tl * tl + tc * tc + th * th + rt * tc * th);
    }

    private static double hue(double a, double b) {
        if (a == 0 && b == 0) {
            return 0;
        }
        double h = Math.toDegrees(Math.atan2(b, a));
        return h < 0 ? h + 360 : h;
    }

    private static double cosDeg(double deg) {
        return Math.cos(Math.toRadians(deg));
    }
}
