package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalVision;

/**
 * Cor no quadro de tecido: fundo de estúdio pela borda, cores dominantes da peça, pele estranha à peça, bordas de cor
 * (troca camiseta → calça, cós) e abertura na frente pela cor. Funções puras sobre os pixels ARGB.
 */
final class FabricColors {
    private FabricColors() {
    }

    /** Cor do fundo de estúdio: a borda da foto quase toda de uma cor (aceita degradê/vinheta); senão null. */
    static int[] studioBackground(int[] px, int w, int h) {
        int[] border = new int[2 * (w + h)];
        int k = 0;
        for (int x = 0; x < w; x++) { border[k++] = px[x]; border[k++] = px[(h - 1) * w + x]; }
        for (int y = 0; y < h; y++) { border[k++] = px[y * w]; border[k++] = px[y * w + w - 1]; }
        int[] bg = garmentMedian(border, null);
        int near = 0;
        for (int i = 0; i < k; i++) near += dist2(border[i], bg) <= 30 * 30 ? 1 : 0;
        return near >= k * 0.6 ? bg : null;
    }

    static int[] garmentMedian(int[] px, boolean[] mask) {
        int[] r = new int[256], g = new int[256], bl = new int[256];
        int n = 0;
        for (int i = 0; i < px.length; i++) {
            if (mask != null && !mask[i]) continue;
            r[(px[i] >> 16) & 0xFF]++; g[(px[i] >> 8) & 0xFF]++; bl[px[i] & 0xFF]++; n++;
        }
        return new int[]{median(r, n), median(g, n), median(bl, n)};
    }

    /**
     * Cores da peça medidas onde a categoria diz que ela está (peito, cintura/coxa, miolo do calçado ou do acessório) — não no
     * primeiro plano inteiro, que tem calça, sapato e cabelo: até 3 cores dominantes (peça estampada ou em blocos de cor).
     */
    static int[][] garmentColors(int[] px, boolean[] fg, int w, ImageOps.Box b, PieceType type) {
        double fy0 = 0.3, fy1 = 0.55, fx = 0.14;
        if (type == PieceType.LOWER_PIECE) { fy0 = 0.4; fy1 = 0.62; }
        else if (type == PieceType.SHOES_PIECE || type == PieceType.ACCESSORY_PIECE) { fy0 = 0.3; fy1 = 0.7; fx = 0.25; }
        int x0 = (int) (b.x() + b.w() * (0.5 - fx)), x1 = (int) (b.x() + b.w() * (0.5 + fx));
        int y0 = (int) (b.y() + b.h() * fy0), y1 = (int) (b.y() + b.h() * fy1);
        java.util.Map<Integer, long[]> bins = new java.util.HashMap<>();
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                int i = y * w + x;
                if (!fg[i]) continue;
                int p = px[i], key = (((p >> 16) & 0xFF) >> 5) << 6 | (((p >> 8) & 0xFF) >> 5) << 3 | ((p & 0xFF) >> 5);
                long[] e = bins.computeIfAbsent(key, k -> new long[4]);
                e[0]++; e[1] += (p >> 16) & 0xFF; e[2] += (p >> 8) & 0xFF; e[3] += p & 0xFF;
            }
        }
        if (bins.isEmpty()) return new int[][]{garmentMedian(px, fg)};
        long total = bins.values().stream().mapToLong(e -> e[0]).sum();
        return bins.values().stream().sorted((a, c) -> Long.compare(c[0], a[0])).limit(3).filter(e -> e[0] >= total * 0.08)
                .map(e -> new int[]{(int) (e[1] / e[0]), (int) (e[2] / e[0]), (int) (e[3] / e[0])}).toArray(int[][]::new);
    }

    /** Pele (Cb/Cr) longe das cores da peça: uma camiseta bege continua tecido; o braço de quem veste, não. */
    static boolean foreignSkin(int p, int[][] garment) {
        if (LocalVision.skinRatio(new int[]{p}) <= 0) return false;
        for (int[] c : garment) if (dist2(p, c) <= 70 * 70) return false;
        return true;
    }

    static boolean foreignSkin(int p, int[] median) {
        return foreignSkin(p, new int[][]{median});
    }

    /**
     * Borda da peça numa foto com modelo, pela cor: a partir de {@code refY}, andando de {@code step} (+1 desce, −1 sobe)
     * pelo miolo, a primeira faixa de linhas cuja cor média muda muito (camiseta → calça ao descer; calça → camisa/jaqueta
     * ao subir; ou a pele da barriga). Sem mudança, {@code endY}.
     */
    static int colorEdge(int[] px, boolean[] fabric, int w, int cx, int half, int refY, int endY, int step) {
        int x0 = Math.max(0, cx - half), x1 = Math.min(w, cx + half);
        int r0 = step > 0 ? refY : Math.max(0, refY - 12), r1 = step > 0 ? refY + 12 : refY;
        double[] ref = rowMean(px, fabric, w, x0, x1, Math.min(r0, r1), Math.max(r0, r1));
        if (ref == null) return endY;
        int streak = 0;
        for (int y = refY + 12 * step; step > 0 ? y < endY : y > endY; y += step) {
            double[] m = rowMean(px, fabric, w, x0, x1, y, y + 1);
            boolean change = m == null || Math.pow(m[0] - ref[0], 2) + Math.pow(m[1] - ref[1], 2) + Math.pow(m[2] - ref[2], 2) > 60 * 60;
            streak = change ? streak + 1 : 0;
            if (streak >= 4) return y - streak * step;
        }
        return endY;
    }

    /**
     * Abertura na frente pela cor: na faixa do peito, o miolo difere dos dois painéis, que são parecidos entre si (jaqueta ou
     * moletom aberto mostrando a camiseta por baixo, ou o forro/fundo).
     */
    static boolean openByColor(int[] px, boolean[] fabric, int w, int cx, int half, int y0, int y1) {
        int band = Math.max(3, half / 6);
        double[] mid = rowMean(px, fabric, w, cx - band, cx + band, y0, y1);
        double[] left = rowMean(px, fabric, w, cx - half, cx - half + 2 * band, y0, y1);
        double[] right = rowMean(px, fabric, w, cx + half - 2 * band, cx + half, y0, y1);
        if (mid == null || left == null || right == null) return false;
        return d(mid, left) > 45 && d(mid, right) > 45 && d(left, right) < 35;
    }

    private static double d(double[] a, double[] b) {
        return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
    }

    private static double[] rowMean(int[] px, boolean[] fabric, int w, int x0, int x1, int y0, int y1) {
        double r = 0, g = 0, b = 0;
        int n = 0, all = 0;
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                all++;
                int i = y * w + x;
                if (!fabric[i]) continue;
                r += (px[i] >> 16) & 0xFF; g += (px[i] >> 8) & 0xFF; b += px[i] & 0xFF; n++;
            }
        }
        return n < Math.max(4, all * 0.3) ? null : new double[]{r / n, g / n, b / n};
    }

    static int dist2(int p, int[] c) {
        int dr = ((p >> 16) & 0xFF) - c[0], dg = ((p >> 8) & 0xFF) - c[1], db = (p & 0xFF) - c[2];
        return dr * dr + dg * dg + db * db;
    }

    static int dist2(int p, int q) {
        int dr = ((p >> 16) & 0xFF) - ((q >> 16) & 0xFF), dg = ((p >> 8) & 0xFF) - ((q >> 8) & 0xFF), db = (p & 0xFF) - (q & 0xFF);
        return dr * dr + dg * dg + db * db;
    }

    private static int median(int[] hist, int n) {
        int acc = 0;
        for (int v = 0; v < 256; v++) {
            acc += hist[v];
            if (acc * 2 >= n) return v;
        }
        return 255;
    }
}
