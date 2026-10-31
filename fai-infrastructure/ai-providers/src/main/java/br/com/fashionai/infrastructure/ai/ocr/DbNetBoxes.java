package br.com.fashionai.infrastructure.ai.ocr;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Pós-processamento puro da detecção DBNet do PP-OCRv4 (sem ONNX Runtime, sem AWT): tamanho de entrada da rede e
 * mapa de probabilidade → caixas de texto na imagem original. Mesmos parâmetros do RapidOCR: lado menor ≥ 736 px,
 * múltiplo de 32; limiar 0,3; caixa com média ≥ 0,5; expansão (unclip) 1,6; no máximo 60 caixas.
 * <p>
 * Cada caixa é {@code int[]{x0, y0, x1, y1, pixels}} em pixels da imagem original; a lista sai de cima para baixo e,
 * na mesma altura, da esquerda para a direita.
 */
final class DbNetBoxes {
    private static final int MIN_SIDE = 736;
    private static final int MAX_INPUT_SIDE = 2000;
    private static final float DB_THRESH = 0.3f, BOX_THRESH = 0.5f;
    private static final double UNCLIP = 1.6;
    private static final int MAX_BOXES = 60;

    private DbNetBoxes() {
    }

    /** Largura e altura da entrada da rede para uma imagem {@code w × h}: {@code int[]{rw, rh}}, múltiplos de 32. */
    static int[] inputSize(int w, int h) {
        double ratio = Math.min(w, h) < MIN_SIDE ? MIN_SIDE / (double) Math.min(w, h) : 1.0;
        if (Math.max(w, h) * ratio > MAX_INPUT_SIDE) {
            ratio = (double) MAX_INPUT_SIDE / Math.max(w, h);
        }
        int rw = Math.max(32, (int) Math.round(w * ratio / 32.0) * 32);
        int rh = Math.max(32, (int) Math.round(h * ratio / 32.0) * 32);
        return new int[]{rw, rh};
    }

    /** Caixas a partir do mapa {@code prob} ({@code rw × rh}, linha a linha), escaladas para a imagem {@code w × h}. */
    static List<int[]> boxes(float[] prob, int rw, int rh, int w, int h) {
        boolean[] dil = dilate(binarize(prob), rw, rh);
        List<int[]> boxes = new ArrayList<>();
        boolean[] seen = new boolean[dil.length];
        ArrayDeque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < dil.length; i++) {
            if (!dil[i] || seen[i]) {
                continue;
            }
            int x0 = rw, y0 = rh, x1 = -1, y1 = -1, n = 0;
            double sum = 0;
            stack.push(i);
            seen[i] = true;
            while (!stack.isEmpty()) {
                int p = stack.pop();
                int px = p % rw, py = p / rw;
                x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
                sum += prob[p];
                n++;
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = px + dx, ny = py + dy;
                        if (nx >= 0 && ny >= 0 && nx < rw && ny < rh) {
                            int q = ny * rw + nx;
                            if (dil[q] && !seen[q]) {
                                seen[q] = true;
                                stack.push(q);
                            }
                        }
                    }
                }
            }
            int bw = x1 - x0 + 1, bh = y1 - y0 + 1;
            if (Math.min(bw, bh) < 3 || sum / n < BOX_THRESH) {
                continue;
            }
            // unclip: afasta cada lado pela distância área × razão ÷ perímetro (retângulo)
            double d = bw * (double) bh * UNCLIP / (2.0 * (bw + bh));
            double sx = w / (double) rw, sy = h / (double) rh;
            int ax0 = clamp((int) Math.floor((x0 - d) * sx), w), ay0 = clamp((int) Math.floor((y0 - d) * sy), h);
            int ax1 = clamp((int) Math.ceil((x1 + 1 + d) * sx), w), ay1 = clamp((int) Math.ceil((y1 + 1 + d) * sy), h);
            if (ax1 - ax0 >= 5 && ay1 - ay0 >= 5) {
                boxes.add(new int[]{ax0, ay0, ax1, ay1, n});
            }
        }
        boxes = mergeLine(boxes);
        boxes.sort(Comparator.comparingInt((int[] b) -> -b[4]));
        List<int[]> top = new ArrayList<>(boxes.subList(0, Math.min(MAX_BOXES, boxes.size())));
        top.sort(Comparator.<int[]>comparingInt(b -> b[1]).thenComparingInt(b -> b[0]));
        return top;
    }

    private static boolean[] binarize(float[] prob) {
        boolean[] bin = new boolean[prob.length];
        for (int i = 0; i < prob.length; i++) {
            bin[i] = prob[i] > DB_THRESH;
        }
        return bin;
    }

    /** Dilatação 2x2 (use_dilation do PP-OCR): junta letras vizinhas da mesma palavra. */
    private static boolean[] dilate(boolean[] bin, int rw, int rh) {
        boolean[] dil = bin.clone();
        for (int y = 0; y < rh; y++) {
            for (int x = 0; x < rw; x++) {
                if (bin[y * rw + x]) {
                    if (x + 1 < rw) dil[y * rw + x + 1] = true;
                    if (y + 1 < rh) dil[(y + 1) * rw + x] = true;
                    if (x + 1 < rw && y + 1 < rh) dil[(y + 1) * rw + x + 1] = true;
                }
            }
        }
        return dil;
    }

    /**
     * Junta caixas da mesma linha de texto: em letra grande (logo no peito), a primeira ou a última letra às vezes vira
     * um bloco à parte, mais alto que largo, que sozinho seria descartado como texto vertical ("L" + "ACOSTE"). Duas
     * caixas se juntam quando se sobrepõem na vertical (≥ 55% da menor altura), têm altura parecida (razão ≤ 1,6) e o vão
     * entre elas é menor que 0,6 × a altura.
     */
    static List<int[]> mergeLine(List<int[]> in) {
        List<int[]> boxes = new ArrayList<>(in);
        boolean merged = true;
        while (merged) {
            merged = false;
            outer:
            for (int i = 0; i < boxes.size(); i++) {
                for (int j = i + 1; j < boxes.size(); j++) {
                    int[] a = boxes.get(i), b = boxes.get(j);
                    int ha = a[3] - a[1], hb = b[3] - b[1];
                    int overlap = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
                    int gap = Math.max(a[0], b[0]) - Math.min(a[2], b[2]);
                    if (overlap >= 0.55 * Math.min(ha, hb) && Math.max(ha, hb) <= 1.6 * Math.min(ha, hb) && gap < 0.6 * Math.max(ha, hb)) {
                        boxes.set(i, new int[]{Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3]), a[4] + b[4]});
                        boxes.remove(j);
                        merged = true;
                        break outer;
                    }
                }
            }
        }
        return boxes;
    }

    private static int clamp(int v, int max) {
        return Math.max(0, Math.min(max, v));
    }
}
