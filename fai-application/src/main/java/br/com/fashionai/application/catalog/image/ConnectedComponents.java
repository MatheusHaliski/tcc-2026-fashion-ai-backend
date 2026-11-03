package br.com.fashionai.application.catalog.image;

import java.util.ArrayList;
import java.util.List;

/**
 * Componentes conexos de uma máscara booleana (4-conexa), usados pela segmentação do produto, pela máscara do tecido e
 * pela regra do produto: cada componente é {label, tamanho, x0, y0, x1, y1}.
 */
final class ConnectedComponents {
    private ConnectedComponents() {
    }

    /** Rotulagem 4-conexa; devolve os componentes do maior para o menor. */
    static List<int[]> components(boolean[] fg, int w, int h, int[] labels) {
        List<int[]> out = new ArrayList<>();
        int[] stack = new int[fg.length];
        int next = 0;
        for (int s = 0; s < fg.length; s++) {
            if (!fg[s] || labels[s] != 0) {
                continue;
            }
            int label = ++next, top = 0, size = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
            stack[top++] = s;
            labels[s] = label;
            while (top > 0) {
                int i = stack[--top], x = i % w, y = i / w;
                size++;
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x);
                y1 = Math.max(y1, y);
                if (x > 0 && fg[i - 1] && labels[i - 1] == 0) {
                    labels[i - 1] = label;
                    stack[top++] = i - 1;
                }
                if (x < w - 1 && fg[i + 1] && labels[i + 1] == 0) {
                    labels[i + 1] = label;
                    stack[top++] = i + 1;
                }
                if (y > 0 && fg[i - w] && labels[i - w] == 0) {
                    labels[i - w] = label;
                    stack[top++] = i - w;
                }
                if (y < h - 1 && fg[i + w] && labels[i + w] == 0) {
                    labels[i + w] = label;
                    stack[top++] = i + w;
                }
            }
            out.add(new int[]{label, size, x0, y0, x1, y1});
        }
        out.sort((a, b) -> Integer.compare(b[1], a[1]));
        return out;
    }
}
