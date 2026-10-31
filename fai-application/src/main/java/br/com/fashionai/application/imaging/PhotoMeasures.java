package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/**
 * RF4 — medidas de pixel do aceite da foto ({@link PhotoAcceptance#evaluate}): simetria/inclinação da silhueta, fração
 * sem detalhe (preto puro ou branco estourado) e pedaços separados da máscara. Puras, sem i18n nem limiares de aceite.
 */
final class PhotoMeasures {
    private PhotoMeasures() {
    }

    /**
     * [simetria, ângulo]: a maior simetria esquerda × direita girando a silhueta entre −20° e 20° (passo 2°) e o ângulo em
     * que ela acontece — a inclinação da peça no plano, mesmo quando ela não tem eixo "comprido" para a PCA.
     */
    static double[] bestSymmetry(BufferedImage small) {
        double best = -1;
        double angle = 0;
        for (int a = -20; a <= 20; a += 2) {
            double s = Silhouette.symmetry(Silhouette.of(a == 0 ? small : ImageOps.rotate(small, a)));
            // empate técnico: fica com o menor giro (peça já reta)
            if (s > best + 0.005 || Math.abs(s - best) <= 0.005 && Math.abs(a) < Math.abs(angle)) {
                best = Math.max(best, s);
                angle = a;
            }
        }
        return new double[]{best, angle};
    }

    /** Fração da peça sem detalhe: preto puro ou branco estourado (luminância &lt; 2% ou &gt; 98%). */
    static double clippedShare(BufferedImage img) {
        int[] px = img.getRGB(0, 0, img.getWidth(), img.getHeight(), null, 0, img.getWidth());
        long on = 0;
        long clipped = 0;
        for (int p : px) {
            if ((p >>> 24) <= 128) {
                continue;
            }
            on++;
            double l = (((p >> 16) & 0xFF) * 0.299 + ((p >> 8) & 0xFF) * 0.587 + (p & 0xFF) * 0.114) / 255;
            if (l < 0.02 || l > 0.98) {
                clipped++;
            }
        }
        return on == 0 ? 0 : clipped / (double) on;
    }

    /** Pedaços separados da máscara (alfa &gt; 128) com pelo menos {@link PhotoAcceptance#COMPONENT_MIN_SHARE} da área da peça. */
    static int components(BufferedImage img) {
        int w = img.getWidth();
        int h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        boolean[] on = new boolean[w * h];
        int total = 0;
        for (int i = 0; i < px.length; i++) {
            on[i] = (px[i] >>> 24) > 128;
            if (on[i]) {
                total++;
            }
        }
        if (total == 0) {
            return 0;
        }
        boolean[] seen = new boolean[w * h];
        List<Integer> sizes = new ArrayList<>();
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        for (int start = 0; start < on.length; start++) {
            if (!on[start] || seen[start]) {
                continue;
            }
            int size = 0;
            queue.add(start);
            seen[start] = true;
            while (!queue.isEmpty()) {
                int i = queue.poll();
                size++;
                int x = i % w;
                int y = i / w;
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = x + dx;
                        int ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
                            continue;
                        }
                        int j = ny * w + nx;
                        if (on[j] && !seen[j]) {
                            seen[j] = true;
                            queue.add(j);
                        }
                    }
                }
            }
            sizes.add(size);
        }
        final int all = total;
        return (int) sizes.stream().filter(s -> s >= all * PhotoAcceptance.COMPONENT_MIN_SHARE).count();
    }
}
