package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalVision;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * PRODUCT DETECTION + SEGMENTATION + DISTRACTOR REMOVAL (determinístico, sem geração). A máscara vem do recorte local
 * ({@link ImageOps#removeBackgroundLocal}) ou do alfa da própria foto (PNG oficial já recortado). Depois:
 * <ol>
 *   <li>componentes conexos: o maior é o produto; o par do calçado (componente ≥ 25% do maior) fica; peças de outro
 *       componente que tocam a caixa do produto (manga solta, alça) ficam; o resto é distrator (outra peça, objeto de
 *       cena) e sai da máscara — nunca é "apagado" da foto, só fica fora do recorte;</li>
 *   <li>cabide: no topo de peça de cima, linhas muito mais estreitas que a peça (gancho) saem da máscara;</li>
 *   <li>pessoa: pele cuja cor destoa da cor dominante da peça (pele sobre camiseta azul conta; couro caramelo não) —
 *       evidência fraca, somada ao segmentador de pessoa quando ele existe;</li>
 *   <li>qualidade de borda: contorno serrilhado (fundo parecido com a peça) baixa o edgeQuality.</li>
 * </ol>
 * Botões, zíper, cadarço, fivela, alças, logo e costuras fazem parte do componente da peça e nunca são removidos.
 */
public final class ProductSegmenter {
    static final int ALPHA_ON = 24;
    static final double PAIR_MIN = 0.25;
    static final double NOISE_MAX = 0.005;
    static final double HANGER_WIDTH = 0.08;
    static final double HANGER_MAX_HEIGHT = 0.25;

    /**
     * @param width,height     dimensões da máscara (a foto pode ter sido reduzida para no máximo 1600 px)
     * @param mask             só o produto (sem distratores e sem cabide)
     * @param productBox       caixa do produto, normalizada na foto
     * @param distractors      caixas dos distratores, normalizadas
     * @param distractorShare  área dos distratores ÷ área do produto
     * @param foreignSkin      fração do produto com pele de cor diferente da peça (evidência de pessoa)
     * @param truncatedSides   lados em que o produto encosta na borda da foto (peça cortada na origem)
     */
    public record Segmentation(BufferedImage cutout, int width, int height, boolean[] mask, NRect productBox,
                               List<NRect> distractors, double distractorShare, double coverage, double confidence,
                               int backgroundRgb, Set<String> truncatedSides, double edgeQuality, boolean hangerTrimmed,
                               double foreignSkin, String warning) {
        public boolean empty() {
            return productBox.area() <= 0;
        }

        /** Cópia do recorte só com o produto (alfa zerado fora da máscara): entrada dos landmarks e do master. */
        public BufferedImage productOnly() {
            BufferedImage out = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
            int[] px = cutout.getRGB(0, 0, width, height, null, 0, width);
            for (int i = 0; i < px.length; i++) {
                if (!mask[i]) {
                    px[i] = 0;
                }
            }
            out.setRGB(0, 0, width, height, px, 0, width);
            return out;
        }
    }

    public Segmentation segment(BufferedImage src, PieceType type) {
        ImageOps.Cutout cut = alreadyCut(src);
        if (cut == null) {
            cut = ImageOps.removeBackgroundLocal(src);
        }
        BufferedImage img = cut.image();
        int w = img.getWidth(), h = img.getHeight(), n = w * h;
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        boolean[] fg = new boolean[n];
        for (int i = 0; i < n; i++) {
            fg[i] = ((px[i] >>> 24) & 0xFF) > ALPHA_ON;
        }
        int[] labels = new int[n];
        List<int[]> comps = components(fg, w, h, labels); // {label, size, x0, y0, x1, y1}
        if (comps.isEmpty()) {
            return new Segmentation(img, w, h, new boolean[n], new NRect(0, 0, 0, 0), List.of(), 0, 0, cut.confidence(),
                    cut.backgroundRgb(), Set.of(), 0, false, 0, "NO_PRODUCT");
        }
        int[] main = comps.get(0);
        int x0 = main[2], y0 = main[3], x1 = main[4], y1 = main[5];
        Set<Integer> keep = new java.util.HashSet<>(List.of(main[0]));
        List<int[]> distract = new ArrayList<>();
        for (int c = 1; c < comps.size(); c++) {
            int[] k = comps.get(c);
            double rel = (double) k[1] / main[1];
            if (rel < NOISE_MAX) {
                continue;
            }
            boolean touches = k[2] <= main[4] && k[4] >= main[2] && k[3] <= main[5] && k[5] >= main[3];
            boolean pair = type == PieceType.SHOES_PIECE && rel >= PAIR_MIN;
            if (pair || (touches && rel < 0.5)) {
                keep.add(k[0]);
                x0 = Math.min(x0, k[2]);
                y0 = Math.min(y0, k[3]);
                x1 = Math.max(x1, k[4]);
                y1 = Math.max(y1, k[5]);
            } else {
                distract.add(k);
            }
        }
        boolean[] mask = new boolean[n];
        long area = 0;
        for (int i = 0; i < n; i++) {
            if (fg[i] && keep.contains(labels[i])) {
                mask[i] = true;
                area++;
            }
        }
        boolean hanger = false;
        if (type == PieceType.UPPER_PIECE || type == PieceType.FULL_BODY_PIECE) {
            int trimmed = trimHanger(mask, w, x0, y0, x1, y1);
            if (trimmed > y0) {
                hanger = true;
                y0 = trimmed;
            }
        }
        double distractorArea = distract.stream().mapToLong(k -> k[1]).sum();
        List<NRect> distractorBoxes = distract.stream()
                .map(k -> new NRect((double) k[2] / w, (double) k[3] / h, (double) (k[4] - k[2] + 1) / w, (double) (k[5] - k[3] + 1) / h))
                .toList();
        Set<String> truncated = new LinkedHashSet<>();
        if (x0 <= 1) {
            truncated.add("left");
        }
        if (y0 <= 1) {
            truncated.add("top");
        }
        if (x1 >= w - 2) {
            truncated.add("right");
        }
        if (y1 >= h - 2) {
            truncated.add("bottom");
        }
        NRect box = new NRect((double) x0 / w, (double) y0 / h, (double) (x1 - x0 + 1) / w, (double) (y1 - y0 + 1) / h);
        return new Segmentation(img, w, h, mask, box, distractorBoxes, area == 0 ? 0 : distractorArea / area,
                (double) area / n, cut.confidence(), cut.backgroundRgb(), truncated, edgeQuality(mask, w, h, x0, y0, x1, y1),
                hanger, foreignSkin(px, mask), cut.warning());
    }

    /** PNG/WebP oficial já recortado (≥ 5% de pixels transparentes): o alfa da marca é a máscara, sem recorte local. */
    static ImageOps.Cutout alreadyCut(BufferedImage src) {
        if (!src.getColorModel().hasAlpha()) {
            return null;
        }
        BufferedImage img = ImageOps.scaleToFit(ImageOps.toArgb(src), 1600, 1600);
        int[] px = img.getRGB(0, 0, img.getWidth(), img.getHeight(), null, 0, img.getWidth());
        long clear = 0;
        for (int p : px) {
            if (((p >>> 24) & 0xFF) <= ALPHA_ON) {
                clear++;
            }
        }
        double share = (double) clear / px.length;
        return share < 0.05 ? null : new ImageOps.Cutout(img, 1 - share, 0.95, 0xFFFFFF);
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

    /** Linhas do topo muito mais estreitas que a peça (gancho do cabide) saem da máscara; devolve o novo topo. */
    static int trimHanger(boolean[] mask, int w, int x0, int y0, int x1, int y1) {
        int bw = x1 - x0 + 1, bh = y1 - y0 + 1, limit = y0 + (int) (bh * HANGER_MAX_HEIGHT);
        int y = y0;
        while (y < limit && rowWidth(mask, w, y, x0, x1) < bw * HANGER_WIDTH) {
            y++;
        }
        if (y == y0 || y >= limit) {
            return y0;                           // nada estreito no topo, ou a peça inteira é estreita (não é cabide)
        }
        for (int yy = y0; yy < y; yy++) {
            for (int x = x0; x <= x1; x++) {
                mask[yy * w + x] = false;
            }
        }
        return y;
    }

    static int rowWidth(boolean[] mask, int w, int y, int x0, int x1) {
        int c = 0;
        for (int x = x0; x <= x1; x++) {
            if (mask[y * w + x]) {
                c++;
            }
        }
        return c;
    }

    /** Contorno ÷ perímetro da caixa: peça lisa fica perto de 1–2 (mangas somam); recorte serrilhado passa de 3. */
    static double edgeQuality(boolean[] mask, int w, int h, int x0, int y0, int x1, int y1) {
        long border = 0;
        for (int y = y0; y <= y1; y++) {
            for (int x = x0; x <= x1; x++) {
                int i = y * w + x;
                if (mask[i] && (x == 0 || y == 0 || x == w - 1 || y == h - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w])) {
                    border++;
                }
            }
        }
        double ratio = border / (2.0 * ((x1 - x0 + 1) + (y1 - y0 + 1)));
        return clamp01(1 - (ratio - 1.8) / 3);
    }

    /** Pele cuja cor está longe da cor mediana da peça: pessoa vestindo (braço, pescoço, perna), não couro caramelo. */
    static double foreignSkin(int[] px, boolean[] mask) {
        int[] r = new int[256], g = new int[256], b = new int[256];
        int n = 0;
        for (int i = 0; i < px.length; i++) {
            if (mask[i]) {
                r[(px[i] >> 16) & 0xFF]++;
                g[(px[i] >> 8) & 0xFF]++;
                b[px[i] & 0xFF]++;
                n++;
            }
        }
        if (n == 0) {
            return 0;
        }
        int mr = median(r, n), mg = median(g, n), mb = median(b, n);
        long foreign = 0;
        for (int i = 0; i < px.length; i++) {
            if (!mask[i]) {
                continue;
            }
            int p = px[i], dr = ((p >> 16) & 0xFF) - mr, dg = ((p >> 8) & 0xFF) - mg, db = (p & 0xFF) - mb;
            if (dr * dr + dg * dg + db * db > 70 * 70 && LocalVision.skinRatio(new int[]{p}) > 0) {
                foreign++;
            }
        }
        return (double) foreign / n;
    }

    private static int median(int[] hist, int n) {
        int acc = 0;
        for (int v = 0; v < 256; v++) {
            acc += hist[v];
            if (acc * 2 >= n) {
                return v;
            }
        }
        return 255;
    }

    static double clamp01(double v) {
        return Math.max(0, Math.min(1, v));
    }
}
