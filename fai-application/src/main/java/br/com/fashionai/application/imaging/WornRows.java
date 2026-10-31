package br.com.fashionai.application.imaging;

/**
 * RF4 · peças vestidas — varreduras do perfil por linha da pessoa ({@link WornPieceRegions#detect}): primeira/última
 * linha com contagem mínima e a linha do maior salto de cor da roupa (barra da camiseta sobre o cós, fim da calça).
 */
final class WornRows {
    private WornRows() {
    }

    /**
     * Linha em que a cor média da roupa mais muda entre o que está acima e o que está abaixo (ambos com ao menos
     * {@code minSide} linhas); −1 quando o maior salto fica abaixo de {@link WornPieceRegions#SPLIT_DIST}.
     */
    static int colourCut(int[] clothes, long[] sr, long[] sg, long[] sb, int from, int to, int minSide) {
        int best = -1;
        double bestDist = WornPieceRegions.SPLIT_DIST;
        for (int y = from + minSide; y <= to - minSide + 1; y++) {
            long ar = 0, ag = 0, ab = 0, an = 0, br = 0, bg = 0, bb = 0, bn = 0;
            for (int r = from; r < y; r++) {
                ar += sr[r];
                ag += sg[r];
                ab += sb[r];
                an += clothes[r];
            }
            for (int r = y; r <= to; r++) {
                br += sr[r];
                bg += sg[r];
                bb += sb[r];
                bn += clothes[r];
            }
            if (an < minSide * WornPieceRegions.MIN_ROW || bn < minSide * WornPieceRegions.MIN_ROW) {
                continue;
            }
            double d = PixelStats.distance(PixelStats.rgb(ar, ag, ab, an), PixelStats.rgb(br, bg, bb, bn));
            if (d > bestDist) {
                bestDist = d;
                best = y;
            }
        }
        return best;
    }

    static int first(int[] rows, int min, int from, int to) {
        for (int y = from; y <= to; y++) {
            if (rows[y] >= min) {
                return y;
            }
        }
        return -1;
    }

    static int last(int[] rows, int min, int from, int to) {
        for (int y = to; y >= from; y--) {
            if (rows[y] >= min) {
                return y;
            }
        }
        return -1;
    }
}
