package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import java.awt.image.BufferedImage;

import static br.com.fashionai.application.catalog.image.FabricColors.dist2;

/**
 * Operações sobre máscaras booleanas do quadro de tecido: primeiro plano do fundo de estúdio, componentes grandes ou o
 * maior, erosão, cobertura, linha larga, centro horizontal e a máscara como alfa.
 */
final class FabricMasks {
    private FabricMasks() {
    }

    /** Preenche a partir da borda tudo o que é fundo; o resto é a peça (e quem a veste). */
    static boolean[] studioForeground(int[] px, int w, int h, int[] bg) {
        int n = w * h;
        boolean[] background = new boolean[n];
        int[] queue = new int[n];
        int head = 0, tail = 0;
        for (int i = 0; i < n; i++) {
            int x = i % w, y = i / w;
            if ((x == 0 || y == 0 || x == w - 1 || y == h - 1) && dist2(px[i], bg) <= 30 * 30) { background[i] = true; queue[tail++] = i; }
        }
        while (head < tail) {
            int i = queue[head++], x = i % w, y = i / w;
            int[] next = {x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1};
            for (int j : next) {
                if (j < 0 || background[j]) continue;
                // perto da cor do fundo, ou um passo suave a partir do fundo vizinho (degradê), sem se afastar demais
                int d = dist2(px[j], bg);
                if (d <= 30 * 30 || (dist2(px[j], px[i]) <= 7 * 7 && d <= 64 * 64)) { background[j] = true; queue[tail++] = j; }
            }
        }
        boolean[] fg = new boolean[n];
        for (int i = 0; i < n; i++) fg[i] = !background[i];
        return fg;
    }

    /** Só os componentes com ao menos {@code min} pixels. */
    static boolean[] keepLarge(boolean[] in, int w, int h, int min) {
        int[] labels = new int[in.length];
        java.util.List<int[]> comps = ConnectedComponents.components(in, w, h, labels);
        java.util.Set<Integer> keep = new java.util.HashSet<>();
        for (int[] c : comps) if (c[1] >= min) keep.add(c[0]);
        boolean[] out = new boolean[in.length];
        for (int i = 0; i < in.length; i++) out[i] = in[i] && keep.contains(labels[i]);
        return out;
    }

    /** Só o maior componente: um adereço solto na foto não é a peça. */
    static boolean[] largestComponent(boolean[] fg, int w, int h) {
        int[] labels = new int[fg.length];
        java.util.List<int[]> comps = ConnectedComponents.components(fg, w, h, labels);
        boolean[] out = new boolean[fg.length];
        if (comps.isEmpty()) return out;
        int keep = comps.get(0)[0];
        for (int i = 0; i < fg.length; i++) out[i] = labels[i] == keep;
        return out;
    }

    static BufferedImage alphaOf(boolean[] fabric, int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        int[] row = new int[w];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) row[x] = fabric[y * w + x] ? 0xFF000000 : 0;
            img.setRGB(0, y, w, 1, row, 0, w);
        }
        return img;
    }

    /** A primeira linha (de cima para baixo) em que o tecido ocupa ao menos {@code share} da largura da peça. */
    static int firstWideRow(boolean[] fabric, int w, ImageOps.Box b, double share) {
        for (int y = b.y(); y < b.y() + b.h(); y++) {
            int n = 0;
            for (int x = b.x(); x < b.x() + b.w(); x++) n += fabric[y * w + x] ? 1 : 0;
            if (n >= b.w() * share) return y;
        }
        return b.y();
    }

    /** Centro horizontal do tecido (mediana das colunas), não o meio da caixa: manga aberta não puxa o centro. */
    static double centerX(boolean[] fabric, int w, ImageOps.Box b) {
        long[] cols = new long[b.w()];
        long total = 0;
        for (int y = b.y(); y < b.y() + b.h(); y++) {
            for (int x = b.x(); x < b.x() + b.w(); x++) {
                if (fabric[y * w + x]) { cols[x - b.x()]++; total++; }
            }
        }
        if (total == 0) return b.x() + b.w() / 2.0;
        long acc = 0;
        for (int i = 0; i < cols.length; i++) {
            acc += cols[i];
            if (acc * 2 >= total) return b.x() + i + 0.5;
        }
        return b.x() + b.w() / 2.0;
    }

    /** Erosão quadrada de raio r (duas passadas separáveis com somas de prefixo): O(w × h). */
    static boolean[] erode(boolean[] in, int w, int h, int r) {
        boolean[] mid = new boolean[in.length], out = new boolean[in.length];
        int[] pre = new int[Math.max(w, h) + 1];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) pre[x + 1] = pre[x] + (in[y * w + x] ? 0 : 1);
            for (int x = 0; x < w; x++) {
                int a = x - r, z = x + r + 1;
                mid[y * w + x] = a >= 0 && z <= w && pre[z] - pre[a] == 0;
            }
        }
        for (int x = 0; x < w; x++) {
            for (int y = 0; y < h; y++) pre[y + 1] = pre[y] + (mid[y * w + x] ? 0 : 1);
            for (int y = 0; y < h; y++) {
                int a = y - r, z = y + r + 1;
                out[y * w + x] = a >= 0 && z <= h && pre[z] - pre[a] == 0;
            }
        }
        return out;
    }

    static double coverage(boolean[] fabric, int w, ImageOps.Box c) {
        long on = 0, all = (long) c.w() * c.h();
        for (int y = c.y(); y < c.y() + c.h(); y++) {
            for (int x = c.x(); x < c.x() + c.w(); x++) on += fabric[y * w + x] ? 1 : 0;
        }
        return all == 0 ? 0 : (double) on / all;
    }
}
