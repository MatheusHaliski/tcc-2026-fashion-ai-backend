package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Bordas por cor em foto com modelo: cós (subindo) e barra da peça de cima (descendo) pela troca brusca da cor média
 * no miolo, e a máscara da parte de baixo sem o que desce de cima do cós (aba de jaqueta, barra de camisa).
 */
final class GarmentColorEdges {
    private GarmentColorEdges() {
    }

    /**
     * Cós numa foto com modelo: subindo de {@code refY} até {@code top}, a primeira mudança <b>brusca</b> de cor no miolo — a
     * média das 4 linhas de cima contra a das 6 de baixo (o desbotado gradual do jeans não conta; a barra da camisa, a
     * barriga ou o cinto contam). Devolve a primeira linha da calça, ou −1 sem mudança.
     */
    static int waistEdge(int[] px, boolean[] g, int w, int cx, int half, int refY, int top) {
        int x0 = Math.max(0, cx - half), x1 = Math.min(w, cx + half);
        int found = -1;
        double best = 0;
        for (int y = refY - 6; y >= top + 4; y--) {
            double[] below = meanColor(px, g, w, x0, x1, y, y + 6);
            if (below == null) continue;
            double[] above = meanColor(px, g, w, x0, x1, y - 4, y);
            double d = above == null ? 999 : Math.sqrt(Math.pow(above[0] - below[0], 2) + Math.pow(above[1] - below[1], 2) + Math.pow(above[2] - below[2], 2));
            if (d > 45 && d > best) { best = d; found = y; }
            else if (found > 0 && y < found - 8) break;            // a mudança mais forte da primeira faixa que mudou
        }
        return found;
    }

    /**
     * Barra da peça de cima numa foto com modelo: descendo de {@code from}, a primeira mudança brusca de cor no miolo (6 linhas
     * de cima contra 4 de baixo; a peça acabando — pele, fundo — também conta). Devolve a primeira linha depois da peça, ou −1.
     */
    static int abruptEdgeDown(int[] px, boolean[] g, int w, int cx, int half, int from, int to) {
        int x0 = Math.max(0, cx - half), x1 = Math.min(w, cx + half);
        int found = -1;
        double best = 0;
        for (int y = from + 6; y <= to - 4; y++) {
            double[] above = meanColor(px, g, w, x0, x1, y - 6, y);
            if (above == null) continue;
            double[] below = meanColor(px, g, w, x0, x1, y, y + 4);
            double d = below == null ? 999 : Math.sqrt(Math.pow(above[0] - below[0], 2) + Math.pow(above[1] - below[1], 2) + Math.pow(above[2] - below[2], 2));
            if (d > 45 && d > best) { best = d; found = y; }
            else if (found > 0 && y > found + 8) break;
        }
        return found;
    }

    static double[] meanColor(int[] px, boolean[] g, int w, int x0, int x1, int y0, int y1) {
        double r = 0, gg = 0, b = 0;
        int n = 0, all = 0;
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                all++;
                int i = y * w + x;
                if (!g[i]) continue;
                r += (px[i] >> 16) & 0xFF; gg += (px[i] >> 8) & 0xFF; b += px[i] & 0xFF; n++;
            }
        }
        return n < Math.max(4, all * 0.3) ? null : new double[]{r / n, gg / n, b / n};
    }

    /**
     * Máscara sem o que desce de cima do cós: as cores da peça de cima (medidas nas linhas logo acima do cós) que aparecem
     * entre o cós e a barra, longe das cores da calça (medidas no miolo do quadril) e ligadas à linha do cós — aba de jaqueta,
     * barra de camisa por fora. Desbotado, sombra e costura da própria calça não têm a cor da peça de cima e ficam.
     */
    static boolean[] lowerColors(int[] px, boolean[] g, int w, int h, int cx, int halfW, int waist, int crotch) {
        int[][] pants = FabricColors.garmentColors(px, g, w, new ImageOps.Box(cx - halfW, waist, 2 * halfW, Math.max(1, crotch - waist)), PieceType.LOWER_PIECE);
        int[][] upper = dominant(px, g, w, Math.max(0, waist - Math.max(10, h / 25)), waist);
        if (upper.length == 0) return g;
        boolean[] other = new boolean[g.length];
        for (int y = Math.max(0, waist); y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                other[i] = g[i] && near(px[i], upper, 45) && !near(px[i], pants, 60);
            }
        }
        int[] labels = new int[other.length];
        List<int[]> comps = ConnectedComponents.components(other, w, h, labels);   // {label, tamanho, x0, y0, x1, y1}
        Set<Integer> drop = new java.util.HashSet<>();
        for (int[] k : comps) if (k[3] <= waist + 2 && k[1] >= w * h * 0.0005) drop.add(k[0]);
        boolean[] out = g.clone();
        for (int i = 0; i < out.length; i++) if (other[i] && drop.contains(labels[i])) out[i] = false;
        return out;
    }

    /** Até 4 cores dominantes (≥ 5%) da máscara nas linhas [y0, y1), na largura toda. */
    static int[][] dominant(int[] px, boolean[] g, int w, int y0, int y1) {
        Map<Integer, long[]> bins = new java.util.HashMap<>();
        for (int y = y0; y < y1; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                if (!g[i]) continue;
                int p = px[i], key = (((p >> 16) & 0xFF) >> 5) << 6 | (((p >> 8) & 0xFF) >> 5) << 3 | ((p & 0xFF) >> 5);
                long[] e = bins.computeIfAbsent(key, k -> new long[4]);
                e[0]++; e[1] += (p >> 16) & 0xFF; e[2] += (p >> 8) & 0xFF; e[3] += p & 0xFF;
            }
        }
        long total = bins.values().stream().mapToLong(e -> e[0]).sum();
        return bins.values().stream().sorted((a, b) -> Long.compare(b[0], a[0])).limit(4).filter(e -> e[0] >= total * 0.05)
                .map(e -> new int[]{(int) (e[1] / e[0]), (int) (e[2] / e[0]), (int) (e[3] / e[0])}).toArray(int[][]::new);
    }

    static boolean near(int p, int[][] colors, int dist) {
        for (int[] c : colors) {
            int dr = ((p >> 16) & 0xFF) - c[0], dg = ((p >> 8) & 0xFF) - c[1], db = (p & 0xFF) - c[2];
            if (dr * dr + dg * dg + db * db <= dist * dist) return true;
        }
        return false;
    }
}
