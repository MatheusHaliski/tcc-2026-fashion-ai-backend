package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pipeline de filtro dos logos que vêm da internet (RF4 · buscador de marcas). Todo logo aceito sai igual:
 * <b>fundo branco, desenho/letras em preto, bordas nítidas</b>. Logos que não dá para deixar assim são recusados em vez
 * de exibidos borrados.
 * <ol>
 *   <li>achatamento da transparência sobre branco;</li>
 *   <li>fundo estimado pela moldura da imagem (mediana da borda) — fundo com muita variação é foto ou banner → recusa;</li>
 *   <li>tinta = distância de cada pixel à cor do fundo (vale para logo colorido, claro sobre escuro ou escuro sobre claro);</li>
 *   <li>limiar de Otsu separa tinta e fundo; contraste baixo → recusa;</li>
 *   <li>nitidez: largura média da transição tinta→fundo (pixels de meio-tom por pixel de contorno) e gradiente no
 *       contorno; transição larga = logo borrado → recusa;</li>
 *   <li>recorte justo com margem, ampliação no máximo 2× (acima disso seria borrado → recusa por resolução);</li>
 *   <li>binarização suave (curva em S estreita sobre o limiar): preto puro no desenho, branco puro no fundo e 1 px de
 *       antisserrilhado no contorno;</li>
 *   <li>saídas: versão quadrada (avatar do logo) e versão larga (slot de logo do formulário).</li>
 * </ol>
 */
public final class LogoFilter {
    public static final int SQUARE = 320;
    public static final int WIDE_H = 160;
    public static final int WIDE_MAX_W = 640;
    static final int MIN_SOURCE_SIDE = 96;
    static final double MIN_UNIFORM_BORDER = 0.6;
    static final double MIN_CONTRAST = 0.35;
    static final double MAX_EDGE_WIDTH = 2.2;
    static final double MIN_EDGE_GRADIENT = 0.30;
    static final double MAX_UPSCALE = 2.0;

    private LogoFilter() {
    }

    public record Result(boolean accepted, String reason, BufferedImage square, BufferedImage wide, Map<String, Object> metrics, List<String> steps) {
        static Result reject(String reason, Map<String, Object> metrics, List<String> steps) {
            return new Result(false, reason, null, null, metrics, steps);
        }
    }

    /** Logo vetorial: renderiza direto em preto sobre branco e passa pela mesma checagem (sempre nítido). */
    public static Result fromVector(SvgPathRenderer.Vector v) {
        BufferedImage hi = SvgPathRenderer.render(v, 1024, 0.06);
        Result r = filter(hi, "vetor (SVG)");
        r.steps().add(0, Msg.t("logoFilter.svg_vetorial_renderizado_sem_perda"));
        return r;
    }

    /** Logo em pixels (PNG/JPEG baixado da internet). */
    public static Result fromRaster(BufferedImage src) {
        return filter(src, "imagem " + src.getWidth() + "×" + src.getHeight());
    }

    static Result filter(BufferedImage src, String origin) {
        List<String> steps = new ArrayList<>();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("origem", origin);
        int w = src.getWidth(), h = src.getHeight();
        m.put("larguraOrigem", w);
        m.put("alturaOrigem", h);
        if (Math.max(w, h) < MIN_SOURCE_SIDE) {
            return Result.reject("RESOLUCAO_BAIXA", m, steps);
        }
        // 1) transparência → branco; luminância
        float[] lum = new float[w * h];
        float[][] rgb = new float[3][w * h];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int argb = src.getRGB(x, y);
                double a = ((argb >>> 24) & 0xFF) / 255.0;
                if (!src.getColorModel().hasAlpha()) {
                    a = 1;
                }
                double r = ((argb >> 16) & 0xFF) * a + 255 * (1 - a);
                double g = ((argb >> 8) & 0xFF) * a + 255 * (1 - a);
                double b = (argb & 0xFF) * a + 255 * (1 - a);
                int i = y * w + x;
                rgb[0][i] = (float) r;
                rgb[1][i] = (float) g;
                rgb[2][i] = (float) b;
                lum[i] = (float) (0.2126 * r + 0.7152 * g + 0.0722 * b);
            }
        }
        steps.add(Msg.t("logoFilter.transparencia_achatada_sobre_branco"));
        // 2) fundo: PNG com transparência → branco; senão, a cor mais comum da moldura (o logo pode encostar na borda)
        int transparent = 0;
        if (src.getColorModel().hasAlpha()) {
            for (int y = 0; y < h; y += 2) {
                for (int x = 0; x < w; x += 2) {
                    if (((src.getRGB(x, y) >>> 24) & 0xFF) < 16) {
                        transparent++;
                    }
                }
            }
        }
        double[] bg = new double[3];
        double uniform;
        if (transparent > (w / 2) * (h / 2) * 0.05) {
            bg[0] = bg[1] = bg[2] = 255;
            uniform = 1;
            steps.add("fundo transparente");
        } else {
            int ring = Math.max(1, Math.min(w, h) / 64);
            List<Integer> border = new ArrayList<>();
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    if (x < ring || y < ring || x >= w - ring || y >= h - ring) {
                        border.add(y * w + x);
                    }
                }
            }
            // cor mais comum da moldura (histograma 16×16×16)
            int[] hist = new int[4096];
            for (int i : border) {
                hist[((int) rgb[0][i] >> 4) << 8 | ((int) rgb[1][i] >> 4) << 4 | ((int) rgb[2][i] >> 4)]++;
            }
            int mode = 0;
            for (int b = 1; b < hist.length; b++) {
                if (hist[b] > hist[mode]) {
                    mode = b;
                }
            }
            double[] sum = new double[3];
            int n = 0, near = 0;
            for (int i : border) {
                int bin = ((int) rgb[0][i] >> 4) << 8 | ((int) rgb[1][i] >> 4) << 4 | ((int) rgb[2][i] >> 4);
                if (bin == mode) {
                    sum[0] += rgb[0][i];
                    sum[1] += rgb[1][i];
                    sum[2] += rgb[2][i];
                    n++;
                }
            }
            for (int c = 0; c < 3; c++) {
                bg[c] = sum[c] / n;
            }
            for (int i : border) {
                double dr = rgb[0][i] - bg[0], dg = rgb[1][i] - bg[1], db = rgb[2][i] - bg[2];
                if (Math.sqrt(dr * dr + dg * dg + db * db) < 40) {
                    near++;
                }
            }
            uniform = (double) near / border.size();
        }
        double bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
        m.put("molduraUniforme", round(uniform));
        m.put("fundoOriginal", String.format("#%02X%02X%02X", (int) bg[0], (int) bg[1], (int) bg[2]));
        if (uniform < MIN_UNIFORM_BORDER) {
            return Result.reject("FUNDO_NAO_UNIFORME", m, steps);
        }
        m.put("invertido", bgLum < 128);
        steps.add(bgLum < 128 ? Msg.t("logoFilter.fundo_escuro_detectado_desenho_claro") : Msg.t("logoFilter.fundo_claro_detectado"));
        // 3) tinta = distância à cor do fundo (0..1)
        float[] ink = new float[w * h];
        int marked = 0;
        for (int i = 0; i < ink.length; i++) {
            double dr = rgb[0][i] - bg[0], dg = rgb[1][i] - bg[1], db = rgb[2][i] - bg[2];
            ink[i] = (float) (Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3 * 255 * 255));
            if (ink[i] > 0.08) {
                marked++;
            }
        }
        if (marked < 30) {
            return Result.reject("SEM_DESENHO", m, steps);
        }
        float[] strong = new float[marked];
        for (int i = 0, k = 0; i < ink.length; i++) {
            if (ink[i] > 0.08) {
                strong[k++] = ink[i];
            }
        }
        double top = percentile(strong, 0.9);
        m.put("contraste", round(top));
        if (top < MIN_CONTRAST) {
            return Result.reject("CONTRASTE_BAIXO", m, steps);
        }
        for (int i = 0; i < ink.length; i++) {
            ink[i] = (float) Math.min(1, ink[i] / top);
        }
        steps.add(Msg.t("logoFilter.desenho_separado_do_fundo_pela"));
        // 4) Otsu
        double t = otsu(ink);
        m.put("limiar", round(t));
        // 5) nitidez no contorno
        Sharpness sh = sharpness(ink, w, h, t);
        m.put("larguraDaBordaPx", round(sh.edgeWidth()));
        m.put("gradienteNaBorda", round(sh.edgeGradient()));
        m.put("pixelsDeContorno", sh.boundary());
        if (sh.boundary() < 40) {
            return Result.reject("SEM_DESENHO", m, steps);
        }
        if (sh.edgeWidth() > MAX_EDGE_WIDTH || sh.edgeGradient() < MIN_EDGE_GRADIENT) {
            return Result.reject("SEM_NITIDEZ", m, steps);
        }
        steps.add(Msg.t("logoFilter.nitidez_conferida_borda_de_px", String.format("%.1f", sh.edgeWidth())));
        // 6) recorte justo
        int x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (ink[y * w + x] > t) {
                    x0 = Math.min(x0, x);
                    y0 = Math.min(y0, y);
                    x1 = Math.max(x1, x);
                    y1 = Math.max(y1, y);
                }
            }
        }
        if (x1 < 0) {
            return Result.reject("SEM_DESENHO", m, steps);
        }
        int bw = x1 - x0 + 1, bh = y1 - y0 + 1;
        double coverage = 0;
        for (int y = y0; y <= y1; y++) {
            for (int x = x0; x <= x1; x++) {
                coverage += ink[y * w + x] > t ? 1 : 0;
            }
        }
        coverage /= (double) bw * bh;
        m.put("cobertura", round(coverage));
        m.put("recorte", bw + "×" + bh);
        if (coverage > 0.92) {
            return Result.reject("BLOCO_SOLIDO", m, steps);
        }
        steps.add(Msg.t("logoFilter.recorte_justo_no_desenho"));
        BufferedImage inkImg = new BufferedImage(bw, bh, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < bh; y++) {
            for (int x = 0; x < bw; x++) {
                int v = Math.round(ink[(y + y0) * w + (x + x0)] * 255);
                inkImg.setRGB(x, y, (v << 16) | (v << 8) | v);
            }
        }
        // 7) escalas finais (no máximo 2× de ampliação)
        double wideScale = Math.min((double) (WIDE_H - 2 * pad(WIDE_H)) / bh, (double) (WIDE_MAX_W - 2 * pad(WIDE_H)) / bw);
        double squareScale = (SQUARE * 0.78) / Math.max(bw, bh);
        double upscale = Math.max(wideScale, squareScale);
        m.put("ampliacao", round(upscale));
        if (upscale > MAX_UPSCALE && Math.max(bw, bh) < 2 * MIN_SOURCE_SIDE) {
            return Result.reject("RESOLUCAO_BAIXA", m, steps);
        }
        BufferedImage wide = compose(inkImg, Math.min(wideScale, MAX_UPSCALE), t, false);
        BufferedImage square = compose(inkImg, Math.min(squareScale, MAX_UPSCALE), t, true);
        steps.add(Msg.t("logoFilter.binarizacao_suave_preto_puro_no"));
        steps.add(Msg.t("logoFilter.saidas_quadrado_e_faixa", SQUARE, SQUARE, wide.getWidth(), wide.getHeight()));
        // 8) conferência final na saída
        float[] out = inkOf(wide);
        Sharpness fin = sharpness(out, wide.getWidth(), wide.getHeight(), 0.5);
        m.put("larguraDaBordaFinalPx", round(fin.edgeWidth()));
        return new Result(true, null, square, wide, m, steps);
    }

    private static int pad(int side) {
        return Math.max(6, side / 10);
    }

    /** Escala o mapa de tinta com boa interpolação e aplica a curva em S: preto no desenho, branco no fundo. */
    static BufferedImage compose(BufferedImage inkImg, double scale, double threshold, boolean square) {
        int sw = Math.max(1, (int) Math.round(inkImg.getWidth() * scale));
        int shh = Math.max(1, (int) Math.round(inkImg.getHeight() * scale));
        BufferedImage scaled = scaleSmooth(inkImg, sw, shh);
        int cw, ch;
        if (square) {
            cw = SQUARE;
            ch = SQUARE;
        } else {
            int p = pad(WIDE_H);
            cw = Math.min(WIDE_MAX_W, sw + 2 * p);
            ch = WIDE_H;
        }
        BufferedImage out = new BufferedImage(cw, ch, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, cw, ch);
        g.dispose();
        int ox = (cw - sw) / 2, oy = (ch - shh) / 2;
        double lo = Math.max(0.02, threshold - 0.18), hi = Math.min(0.98, threshold + 0.18);
        for (int y = 0; y < shh; y++) {
            for (int x = 0; x < sw; x++) {
                int tx = x + ox, ty = y + oy;
                if (tx < 0 || ty < 0 || tx >= cw || ty >= ch) {
                    continue;
                }
                double d = (scaled.getRGB(x, y) & 0xFF) / 255.0;
                double s = d <= lo ? 0 : d >= hi ? 1 : smooth((d - lo) / (hi - lo));
                int v = (int) Math.round(255 * (1 - s));
                out.setRGB(tx, ty, (v << 16) | (v << 8) | v);
            }
        }
        return out;
    }

    private static double smooth(double x) {
        return x * x * (3 - 2 * x);
    }

    /** Redução em etapas de metade (sem serrilhado) e ampliação bicúbica. */
    static BufferedImage scaleSmooth(BufferedImage img, int tw, int th) {
        BufferedImage cur = img;
        int cw = img.getWidth(), ch = img.getHeight();
        while (cw / 2 >= tw && ch / 2 >= th) {
            cw /= 2;
            ch /= 2;
            cur = draw(cur, cw, ch);
        }
        return cw == tw && ch == th ? cur : draw(cur, tw, th);
    }

    private static BufferedImage draw(BufferedImage src, int w, int h) {
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return out;
    }

    record Sharpness(double edgeWidth, double edgeGradient, int boundary) {
    }

    /**
     * Largura da transição: nº de pixels de meio-tom (entre 20% e 80% do caminho fundo→tinta) dividido pelo nº de
     * pixels de contorno. Logo nítido fica perto de 1 px; logo borrado passa de 2 px. O gradiente médio no contorno
     * completa a medida (transição suave = gradiente baixo).
     */
    static Sharpness sharpness(float[] ink, int w, int h, double t) {
        int mid = 0, boundary = 0;
        double grad = 0;
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int i = y * w + x;
                float v = ink[i];
                if (v > 0.2 && v < 0.8) {
                    mid++;
                }
                boolean in = v > t;
                boolean edge = in != (ink[i - 1] > t) || in != (ink[i + 1] > t) || in != (ink[i - w] > t) || in != (ink[i + w] > t);
                if (edge && in) {
                    boundary++;
                    double gx = Math.abs(ink[i + 1] - ink[i - 1]) / 2, gy = Math.abs(ink[i + w] - ink[i - w]) / 2;
                    grad += Math.max(Math.max(Math.abs(v - ink[i - 1]), Math.abs(v - ink[i + 1])),
                            Math.max(Math.max(Math.abs(v - ink[i - w]), Math.abs(v - ink[i + w])), Math.max(gx, gy)));
                }
            }
        }
        return new Sharpness(boundary == 0 ? 99 : (double) mid / boundary, boundary == 0 ? 0 : grad / boundary, boundary);
    }

    static double otsu(float[] v) {
        int[] hist = new int[256];
        for (float f : v) {
            hist[Math.min(255, Math.max(0, Math.round(f * 255)))]++;
        }
        long total = v.length;
        double sum = 0;
        for (int i = 0; i < 256; i++) {
            sum += (double) i * hist[i];
        }
        double sumB = 0, best = -1;
        long wB = 0;
        int th = 128;
        for (int i = 0; i < 256; i++) {
            wB += hist[i];
            if (wB == 0) {
                continue;
            }
            long wF = total - wB;
            if (wF == 0) {
                break;
            }
            sumB += (double) i * hist[i];
            double mB = sumB / wB, mF = (sum - sumB) / wF;
            double between = (double) wB * wF * (mB - mF) * (mB - mF);
            if (between > best) {
                best = between;
                th = i;
            }
        }
        return Math.min(0.85, Math.max(0.15, (th + 0.5) / 255.0));
    }

    static float[] inkOf(BufferedImage img) {
        float[] out = new float[img.getWidth() * img.getHeight()];
        for (int y = 0; y < img.getHeight(); y++) {
            for (int x = 0; x < img.getWidth(); x++) {
                out[y * img.getWidth() + x] = 1 - (img.getRGB(x, y) & 0xFF) / 255f;
            }
        }
        return out;
    }

    private static double percentile(float[] v, double p) {
        float[] c = Arrays.copyOf(v, v.length);
        Arrays.sort(c);
        return c[Math.min(c.length - 1, (int) (p * c.length))];
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
