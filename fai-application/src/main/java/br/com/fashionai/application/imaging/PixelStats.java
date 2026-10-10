package br.com.fashionai.application.imaging;

/**
 * Cor dominante de um conjunto de pixels: o modo de um histograma grosso (4 bits por canal), com a média dos pixels do
 * bin vencedor. Diferente da média de todos os pixels, não inventa um tom entre dois (estampa preta e branca não vira
 * cinza; brilho e sombra isolados não puxam a cor).
 */
final class PixelStats {
    private static final int BINS = 16 * 16 * 16;

    private PixelStats() {
    }

    /** @param indices posições em {@code pixels} que pertencem à região (só as {@code n} primeiras valem) */
    static int dominant(int[] pixels, int[] indices, int n) {
        if (n <= 0) {
            return 0x808080;
        }
        long[] count = new long[BINS], r = new long[BINS], g = new long[BINS], b = new long[BINS];
        for (int i = 0; i < n; i++) {
            int p = pixels[indices[i]];
            int rr = (p >> 16) & 255, gg = (p >> 8) & 255, bb = p & 255;
            int bin = ((rr >> 4) << 8) | ((gg >> 4) << 4) | (bb >> 4);
            count[bin]++;
            r[bin] += rr;
            g[bin] += gg;
            b[bin] += bb;
        }
        int best = 0;
        for (int i = 1; i < BINS; i++) {
            if (count[i] > count[best]) {
                best = i;
            }
        }
        return (int) (r[best] / count[best]) << 16 | (int) (g[best] / count[best]) << 8 | (int) (b[best] / count[best]);
    }

    /** Distância euclidiana (RGB) entre duas cores. */
    static double distance(int a, int b) {
        int dr = ((a >> 16) & 255) - ((b >> 16) & 255), dg = ((a >> 8) & 255) - ((b >> 8) & 255), db = (a & 255) - (b & 255);
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    static int rgb(long r, long g, long b, long n) {
        return n <= 0 ? 0x808080 : (int) (r / n) << 16 | (int) (g / n) << 8 | (int) (b / n);
    }
}
