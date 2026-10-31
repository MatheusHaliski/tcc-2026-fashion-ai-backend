package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;

/**
 * RF4 · Estúdio — detecção de cortes retos no recorte (foto que cortou a barra ou as mangas), usada pelo enquadramento
 * ({@link StudioFraming#cuts}) para decidir quais lados "sangram" para fora do quadro. Pura: só lê o alfa da peça.
 */
final class StraightCuts {
    private StraightCuts() {
    }

    /**
     * Cortes retos no próprio recorte: foto que cortou a barra/mangas (ou recorte antigo, sem o metadado do Flat Lay).
     * Para cada lado, procura a reta (inclinação até ±6°) que passa pelo maior número de pontos do perfil daquele lado,
     * perto da borda do recorte; ≥ 30% do lado sobre a mesma reta é corte, não barra de roupa desenhada.
     *
     * @return lado → inclinação em graus (0 = reto)
     */
    static java.util.Map<String, Double> cuts(BufferedImage piece) {
        int w = piece.getWidth(), h = piece.getHeight();
        int[] px = piece.getRGB(0, 0, w, h, null, 0, w);
        int[] bottom = new int[w], top = new int[w], left = new int[h], right = new int[h];
        java.util.Arrays.fill(bottom, -1);
        java.util.Arrays.fill(top, -1);
        java.util.Arrays.fill(left, -1);
        java.util.Arrays.fill(right, -1);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if ((px[y * w + x] >>> 24) >= 128) {
                    if (top[x] < 0) {
                        top[x] = y;
                    }
                    bottom[x] = y;
                    if (left[y] < 0) {
                        left[y] = x;
                    }
                    right[y] = x;
                }
            }
        }
        int[] invTop = new int[w], invLeft = new int[h];
        for (int x = 0; x < w; x++) {
            invTop[x] = top[x] < 0 ? -1 : h - 1 - top[x];
        }
        for (int y = 0; y < h; y++) {
            invLeft[y] = left[y] < 0 ? -1 : w - 1 - left[y];
        }
        java.util.Map<String, Double> out = new java.util.LinkedHashMap<>();
        // base/topo: ≥ 30% da largura; laterais: ≥ 40% da altura (a borda de uma manga reta não é corte)
        double[] b = line(bottom, h, 0.30), t = line(invTop, h, 0.30), l = line(invLeft, w, 0.40), r = line(right, w, 0.40);
        if (b != null) {
            out.put("bottom", b[0]);
        }
        if (t != null) {
            out.put("top", -t[0]);
        }
        // corte lateral de foto fica no mesmo ângulo da câmera (o do corte de base/topo, ou reto); lateral de roupa
        // afunilada ou evasê tem outra inclinação e não é corte
        double camera = b != null ? b[0] : t != null ? -t[0] : 0;
        if (l != null && Math.abs(-l[0] - camera) <= 1.2) {
            out.put("left", -l[0]);
        }
        if (r != null && Math.abs(r[0] - camera) <= 1.2) {
            out.put("right", r[0]);
        }
        return out;
    }

    /**
     * Perfil "extremo" (maior coordenada por posição): melhor reta perto do limite (último 15%) por votação de
     * inclinações, numa faixa de 3 px (corte de foto é reto de verdade); devolve {ângulo em graus, pontos} ou null.
     */
    private static double[] line(int[] profile, int limit, double minShare) {
        int n = profile.length, bestCount = 0;
        double bestSlope = 0;
        for (double m = -0.105; m <= 0.105; m += 0.0025) {
            java.util.Map<Integer, Integer> bins = new java.util.HashMap<>();
            for (int i = 0; i < n; i++) {
                if (profile[i] < limit * 0.85) {
                    continue;
                }
                int bin = (int) Math.floor((profile[i] - m * i) / 1.5);
                bins.merge(bin, 1, Integer::sum);
            }
            for (java.util.Map.Entry<Integer, Integer> e : bins.entrySet()) {
                int c = e.getValue() + bins.getOrDefault(e.getKey() + 1, 0);
                if (c > bestCount) {
                    bestCount = c;
                    bestSlope = m;
                }
            }
        }
        return bestCount >= n * minShare ? new double[]{Math.toDegrees(Math.atan(bestSlope)), bestCount} : null;
    }
}
