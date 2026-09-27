package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;

/**
 * RF4 — silhueta da peça e similaridade de forma, a base da comparação "foto × referências do subtipo".
 *
 * <p>A máscara (alfa &gt; 128) é recortada na caixa da peça e reduzida a uma grade {@value #GRID}×{@value #GRID} de
 * ocupação (0–1 por célula, média da área). A similaridade entre duas silhuetas combina quatro medidas, todas em 0–1:
 * <ul>
 *   <li><b>Jaccard da grade</b> (Σmin / Σmax): quanto as duas formas se sobrepõem depois de levadas à mesma caixa —
 *       separa calça (duas pernas) de saia, camiseta (mangas) de regata;</li>
 *   <li><b>proporção</b> (altura/largura), comparada em escala log: bermuda × calça, tênis × bota;</li>
 *   <li><b>perfis</b> de preenchimento por linha e por coluna: onde a peça alarga ou afina (barra, cós, mangas);</li>
 *   <li><b>solidez</b> (área / área da caixa): peça cheia (bolsa, moletom) × vazada (sandália, colar).</li>
 * </ul>
 * A comparação é feita também contra o espelho horizontal (tênis com o bico para o outro lado) e vale a maior.
 * Pesos: 0,55 · 0,15 · 0,20 · 0,10.
 */
public final class Silhouette {
    public static final int GRID = 32;
    /** Lado máximo usado para medir: acima disso a máscara é reduzida (a grade é 32×32; mais resolução não muda nada). */
    static final int WORK = 256;

    private Silhouette() {
    }

    /**
     * @param grid     ocupação por célula, linha a linha ({@value #GRID}²)
     * @param aspect   altura / largura da caixa da peça
     * @param solidity área da peça / área da caixa
     * @param rows     preenchimento médio de cada linha da grade
     * @param cols     preenchimento médio de cada coluna da grade
     */
    public record Descriptor(float[] grid, double aspect, double solidity, float[] rows, float[] cols) {
        public boolean empty() {
            return solidity <= 0;
        }
    }

    public static Descriptor of(BufferedImage rgba) {
        ImageOps.Box box = maskBounds(rgba);
        if (box.empty()) {
            return new Descriptor(new float[GRID * GRID], 1, 0, new float[GRID], new float[GRID]);
        }
        double scale = Math.min(1.0, WORK / (double) Math.max(box.w(), box.h()));
        int w = Math.max(1, (int) Math.round(box.w() * scale));
        int h = Math.max(1, (int) Math.round(box.h() * scale));
        BufferedImage src = rgba.getSubimage(box.x(), box.y(), box.w(), box.h());
        BufferedImage small = scale < 1 ? ImageOps.scale(src, w, h) : src;
        int[] px = small.getRGB(0, 0, w, h, null, 0, w);
        double[] occ = new double[GRID * GRID];
        double[] cnt = new double[GRID * GRID];
        long filled = 0;
        for (int y = 0; y < h; y++) {
            int gy = Math.min(GRID - 1, y * GRID / h);
            for (int x = 0; x < w; x++) {
                int gx = Math.min(GRID - 1, x * GRID / w);
                boolean on = (px[y * w + x] >>> 24) > 128;
                cnt[gy * GRID + gx]++;
                if (on) {
                    occ[gy * GRID + gx]++;
                    filled++;
                }
            }
        }
        float[] grid = new float[GRID * GRID];
        float[] rows = new float[GRID];
        float[] cols = new float[GRID];
        for (int i = 0; i < grid.length; i++) {
            grid[i] = cnt[i] == 0 ? 0 : (float) (occ[i] / cnt[i]);
            rows[i / GRID] += grid[i] / GRID;
            cols[i % GRID] += grid[i] / GRID;
        }
        return new Descriptor(grid, box.h() / (double) box.w(), filled / (double) (w * h), rows, cols);
    }

    /** Similaridade 0–1 (1 = mesma forma), invariante a escala, posição e espelho horizontal. */
    public static double similarity(Descriptor a, Descriptor b) {
        if (a.empty() || b.empty()) {
            return 0;
        }
        double jac = Math.max(jaccard(a.grid(), b.grid(), false), jaccard(a.grid(), b.grid(), true));
        double aspect = Math.exp(-1.5 * Math.abs(Math.log(a.aspect() / b.aspect())));
        double profile = (profile(a.rows(), b.rows(), false) + Math.max(profile(a.cols(), b.cols(), false), profile(a.cols(), b.cols(), true))) / 2;
        double solidity = Math.max(0, 1 - 2 * Math.abs(a.solidity() - b.solidity()));
        return round(0.55 * jac + 0.15 * aspect + 0.20 * profile + 0.10 * solidity);
    }

    /**
     * Simetria esquerda × direita da silhueta (Jaccard da grade com o próprio espelho), 0–1. Roupa esticada e fotografada
     * de frente, com a câmera a 90°, é quase simétrica (≥ 0,8); de lado, dobrada ou torta, cai.
     */
    public static double symmetry(Descriptor d) {
        return d.empty() ? 0 : round(jaccard(d.grid(), d.grid(), true));
    }

    static double jaccard(float[] a, float[] b, boolean mirrorB) {
        double inter = 0;
        double union = 0;
        for (int y = 0; y < GRID; y++) {
            for (int x = 0; x < GRID; x++) {
                float va = a[y * GRID + x];
                float vb = b[y * GRID + (mirrorB ? GRID - 1 - x : x)];
                inter += Math.min(va, vb);
                union += Math.max(va, vb);
            }
        }
        return union == 0 ? 0 : inter / union;
    }

    static double profile(float[] a, float[] b, boolean mirrorB) {
        double diff = 0;
        for (int i = 0; i < a.length; i++) {
            diff += Math.abs(a[i] - b[mirrorB ? a.length - 1 - i : i]);
        }
        return Math.max(0, 1 - diff / a.length * 2);
    }

    /** Caixa da parte opaca (alfa &gt; 128) — sombra e franja semitransparentes não contam como peça. */
    static ImageOps.Box maskBounds(BufferedImage img) {
        int w = img.getWidth();
        int h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        int minX = w, minY = h, maxX = -1, maxY = -1;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if ((px[y * w + x] >>> 24) > 128) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }
        return maxX < 0 ? new ImageOps.Box(0, 0, 0, 0) : new ImageOps.Box(minX, minY, maxX - minX + 1, maxY - minY + 1);
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
