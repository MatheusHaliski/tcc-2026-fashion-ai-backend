package br.com.fashionai.application.catalog.image;

import java.awt.image.BufferedImage;

/** Cor no pipeline de imagens oficiais: sRGB → CIELAB (D65), ΔE76, cor dominante dentro de uma máscara. */
public final class ColorMath {
    private ColorMath() {
    }

    /** {L, a, b} de um RGB empacotado (ignora o alfa). */
    public static double[] lab(int rgb) {
        double r = lin(((rgb >> 16) & 0xFF) / 255.0), g = lin(((rgb >> 8) & 0xFF) / 255.0), b = lin((rgb & 0xFF) / 255.0);
        double x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
        double y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
        double z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
        double fx = f(x), fy = f(y), fz = f(z);
        return new double[]{116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)};
    }

    public static double deltaE(double[] a, double[] b) {
        double dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
        return Math.sqrt(dl * dl + da * da + db * db);
    }

    public static double deltaE(int rgbA, int rgbB) {
        return deltaE(lab(rgbA), lab(rgbB));
    }

    /** "#RRGGBB" ou "RRGGBB" → RGB; null/ inválido → -1. */
    public static int parseHex(String hex) {
        if (hex == null) {
            return -1;
        }
        String h = hex.startsWith("#") ? hex.substring(1) : hex;
        if (!h.matches("[0-9A-Fa-f]{6}")) {
            return -1;
        }
        return Integer.parseInt(h, 16);
    }

    public static String hex(int rgb) {
        return String.format("#%06X", rgb & 0xFFFFFF);
    }

    /**
     * Cor dominante (mediana por canal em Lab) dos pixels dentro da máscara, amostrando no máximo ~40 mil pixels.
     * Sem pixels, -1.
     */
    public static int dominant(BufferedImage img, PixelMask mask) {
        PixelMask m = mask.width() == img.getWidth() && mask.height() == img.getHeight() ? mask : mask.resized(img.getWidth(), img.getHeight());
        long n = m.count();
        if (n == 0) {
            return -1;
        }
        int step = (int) Math.max(1, Math.sqrt(n / 40_000.0));
        int[] hist = new int[4096];
        for (int y = 0; y < img.getHeight(); y += step) {
            for (int x = 0; x < img.getWidth(); x += step) {
                if (m.on(x, y)) {
                    int p = img.getRGB(x, y);
                    hist[(((p >> 20) & 0xF) << 8) | (((p >> 12) & 0xF) << 4) | ((p >> 4) & 0xF)]++;
                }
            }
        }
        int best = 0;
        for (int i = 1; i < hist.length; i++) {
            if (hist[i] > hist[best]) {
                best = i;
            }
        }
        int r = ((best >> 8) & 0xF) * 17, g = ((best >> 4) & 0xF) * 17, b = (best & 0xF) * 17;
        return (r << 16) | (g << 8) | b;
    }

    private static double lin(double c) {
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    private static double f(double t) {
        return t > 216.0 / 24389 ? Math.cbrt(t) : (24389.0 / 27 * t + 16) / 116;
    }
}
