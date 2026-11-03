package br.com.fashionai.application.hype;

/** HypeScore v2 — utilitários numéricos puros do cálculo (percentil, curvas, arredondamento e somas de séries). */
final class HypeMath {
    private HypeMath() {
    }

    /** Percentil (midrank) na população; população pequena usa a curva absoluta 100·(1−e^(−x/escala)). */
    static double normalize(double value, double[] sorted, double absoluteScale) {
        if (sorted == null || sorted.length < HypeCalculator.MIN_POPULATION) {
            return clamp(100 * (1 - Math.exp(-Math.max(0, value) / absoluteScale)));
        }
        int below = 0, equal = 0;
        for (double v : sorted) {
            if (v < value - 1e-9) {
                below++;
            } else if (Math.abs(v - value) <= 1e-9) {
                equal++;
            }
        }
        return clamp(100.0 * (below + 0.5 * equal) / sorted.length);
    }

    static double sigmoid(double x) {
        return 1 / (1 + Math.exp(-x));
    }

    static double clamp(double v) {
        return Double.isNaN(v) ? 0 : Math.max(0, Math.min(100, v));
    }

    static double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }

    static double at(double[] a, int i) {
        return a != null && i >= 0 && i < a.length ? a[i] : 0;
    }

    static double sum(double[] a, int from, int to) {
        double s = 0;
        for (int i = Math.max(0, from); a != null && i < Math.min(a.length, to); i++) {
            s += a[i];
        }
        return s;
    }
}
