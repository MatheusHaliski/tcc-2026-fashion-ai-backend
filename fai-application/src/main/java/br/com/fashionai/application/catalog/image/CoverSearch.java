package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

/**
 * Busca do quadro de cobertura na máscara da peça: o maior quadro aw:ah com o topo numa faixa, centrado no eixo e com
 * as linhas da faixa inteiramente em peça (busca binária na meia-largura), mais as medidas por linha usadas pela regra.
 */
final class CoverSearch {
    private CoverSearch() {
    }

    /** Quadro em pixels da máscara: colunas [x, x+w), linhas [y, y+h). */
    record Window(int x, int y, int w, int h) { }

    /**
     * Maior quadro aw:ah com o topo entre {@code yTop} e {@code yLimit}, a base até {@code yBottom}, centrado no eixo
     * {@code cx} (ou até 3 passos para os lados) e com toda linha acima de {@code bandEnd} inteiramente dentro de {@code g}.
     * Entre quadros da mesma largura, o de topo mais alto; entre posições, a mais central.
     */
    static Window cover(boolean[] g, int w, double cx, int step, int yTop, int yLimit, int yBottom, int bandEnd,
                        int aMin, int aMax, int aw, int ah) {
        if (yBottom <= yTop || aMax < aMin) return null;
        Window best = null;
        for (int k = 0; k <= 3; k++) {
            for (int sign : k == 0 ? new int[]{0} : new int[]{-1, 1}) {
                int x = (int) Math.round(cx) + sign * k * step;
                if (x < 1 || x >= w - 1) continue;
                int[] s = halfSpans(g, w, x, yTop, yBottom);
                Window win = largest(s, x, yTop, yLimit, yBottom, bandEnd, aMin, aMax, aw, ah);
                if (win != null && (best == null || win.w() > best.w() || (win.w() == best.w() && win.y() < best.y()))) best = win;
            }
        }
        return best;
    }

    /** Recolhe as laterais em {@code share} da largura de cada lado, mantendo o topo e a proporção (a base sobe junto). */
    static Window inset(Window win, double share, int aw, int ah) {
        int dx = (int) Math.round(win.w() * share);
        int width = win.w() - 2 * dx;
        width -= width % aw;
        int x = win.x() + (win.w() - width) / 2;
        return new Window(x, win.y(), width, width / aw * ah);
    }

    /** Por linha, a maior meia-largura {@code a} com as colunas [x−a, x+a) todas na máscara. */
    static int[] halfSpans(boolean[] g, int w, int x, int y0, int y1) {
        int[] s = new int[y1 - y0];
        for (int y = y0; y < y1; y++) {
            int row = y * w;
            if (!g[row + x]) continue;
            int left = 0, right = 0;
            while (x - left - 1 >= 0 && g[row + x - left - 1]) left++;
            while (x + right < w && g[row + x + right]) right++;
            s[y - y0] = Math.min(left, right);
        }
        return s;
    }

    /** Busca binária na meia-largura (se uma cabe, uma menor também cabe); para cada uma, o primeiro topo que serve. */
    static Window largest(int[] s, int x, int yTop, int yLimit, int yBottom, int bandEnd, int aMin, int aMax, int aw, int ah) {
        int lo = aMin, hi = aMax;
        Window found = null;
        while (lo <= hi) {
            int a = (lo + hi) >>> 1;
            Window win = firstFit(s, x, a, yTop, yLimit, yBottom, bandEnd, aw, ah);
            if (win != null) { found = win; lo = a + 1; } else hi = a - 1;
        }
        return found;
    }

    static Window firstFit(int[] s, int x, int a, int yTop, int yLimit, int yBottom, int bandEnd, int aw, int ah) {
        int width = 2 * a, height = (int) Math.round(width * ah / (double) aw);
        int n = s.length;
        int[] bad = new int[n + 1];                     // linhas da faixa (acima de bandEnd) estreitas demais, acumuladas
        for (int i = 0; i < n; i++) bad[i + 1] = bad[i] + (yTop + i < bandEnd && s[i] < a ? 1 : 0);
        int last = Math.min(yLimit, yBottom - height);
        for (int y = yTop; y <= last; y++) {
            int end = Math.min(y + height, bandEnd);
            if (end <= y || bad[end - yTop] - bad[y - yTop] == 0) return new Window(x - a, y, width, height);
        }
        return null;
    }

    /**
     * Mediana, nas linhas [y0, y1), da largura da máscara na linha dentro de {@code b} (da primeira à última coluna da peça —
     * buracos e listras da cor do fundo no meio não a encurtam); linha sem peça conta 0.
     */
    static int medianRowWidth(boolean[] g, int w, ImageOps.Box b, int y0, int y1) {
        int from = Math.max(b.y(), y0), to = Math.min(b.y() + b.h(), y1);
        if (to <= from) return 0;
        int[] widths = new int[to - from];
        for (int y = from; y < to; y++) {
            int first = -1, last = -1;
            for (int x = b.x(); x < b.x() + b.w(); x++) {
                if (g[y * w + x]) { if (first < 0) first = x; last = x; }
            }
            widths[y - from] = first < 0 ? 0 : last - first + 1;
        }
        java.util.Arrays.sort(widths);
        return widths[widths.length / 2];
    }

    /** Caixa das colunas da máscara nas linhas [y0, y1), dentro de {@code b}; null sem pixel. */
    static ImageOps.Box rowsBox(boolean[] g, int w, ImageOps.Box b, int y0, int y1) {
        int x0 = Integer.MAX_VALUE, x1 = -1;
        for (int y = Math.max(b.y(), y0); y < Math.min(b.y() + b.h(), y1); y++) {
            for (int x = b.x(); x < b.x() + b.w(); x++) {
                if (g[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
            }
        }
        return x1 < 0 ? null : new ImageOps.Box(x0, y0, x1 - x0 + 1, Math.max(1, y1 - y0));
    }
}
