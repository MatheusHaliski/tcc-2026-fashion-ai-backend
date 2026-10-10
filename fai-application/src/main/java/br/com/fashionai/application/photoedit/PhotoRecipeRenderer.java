package br.com.fashionai.application.photoedit;

import br.com.fashionai.application.imaging.ImageOps;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.function.UnaryOperator;

/**
 * RF15 · Aplica a receita sobre a foto original, na ordem, de forma determinística (mesma receita + mesma original →
 * mesmos pixels). Nada é gerado: geometria, máscara, fundo neutro, sombra de contato suave, balanço de branco, tom,
 * retoque local por interpolação do anel em volta e nitidez leve.
 */
public final class PhotoRecipeRenderer {
    /** Lado máximo de trabalho: fotos de celular de 12–50 MP são reduzidas antes de editar (sem ampliar nunca). */
    public static final int MAX_SIDE = 3200;
    public static final Color NEUTRAL = new Color(0xF4, 0xF3, 0xF1);

    /** Recorte da peça (ARGB, alfa = máscara) para a imagem no ponto em que o fundo entra. */
    private final UnaryOperator<BufferedImage> cutter;

    public PhotoRecipeRenderer(UnaryOperator<BufferedImage> cutter) {
        this.cutter = cutter;
    }

    public record Rendered(BufferedImage image, boolean backgroundRemoved, boolean syntheticShadow) {
    }

    public Rendered render(BufferedImage original, PhotoRecipe recipe) {
        return render(original, recipe.ops(), MAX_SIDE);
    }

    public Rendered render(BufferedImage original, List<PhotoRecipe.Op> ops, int maxSide) {
        BufferedImage img = ImageOps.toArgb(ImageOps.scaleToFit(original, maxSide, maxSide));
        boolean bg = false, shadow = false;
        for (PhotoRecipe.Op op : ops) {
            switch (op) {
                case PhotoRecipe.Rotate90 r -> img = rotate90(img, r.turns());
                case PhotoRecipe.Straighten s -> img = straighten(img, s.deg());
                case PhotoRecipe.Perspective p -> img = perspective(img, p.quad());
                case PhotoRecipe.Crop c -> img = crop(img, c);
                case PhotoRecipe.Background b -> {
                    img = background(img, b);
                    bg = true;
                    shadow |= "SOFT".equals(b.shadow());
                }
                case PhotoRecipe.WhiteBalance w -> img = whiteBalance(img, w.x(), w.y());
                case PhotoRecipe.Tone t -> img = tone(img, t);
                case PhotoRecipe.Heal h -> img = heal(img, h.spots());
                case PhotoRecipe.Sharpen s -> img = sharpen(img, s.amount());
                case PhotoRecipe.Filter f -> img = filter(img, f.style(), f.strength());
            }
        }
        return new Rendered(img, bg, shadow);
    }

    static BufferedImage rotate90(BufferedImage src, int turns) {
        int t = ((turns % 4) + 4) % 4;
        if (t == 0) {
            return src;
        }
        int w = src.getWidth(), h = src.getHeight();
        boolean swap = t % 2 == 1;
        BufferedImage out = new BufferedImage(swap ? h : w, swap ? w : h, BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int p = src.getRGB(x, y);
                switch (t) {
                    case 1 -> out.setRGB(h - 1 - y, x, p);
                    case 2 -> out.setRGB(w - 1 - x, h - 1 - y, p);
                    default -> out.setRGB(y, w - 1 - x, p);
                }
            }
        }
        return out;
    }

    /** Gira e corta para o maior retângulo interno de mesma proporção (sem cantos transparentes). */
    static BufferedImage straighten(BufferedImage src, double deg) {
        if (Math.abs(deg) < 0.01) {
            return src;
        }
        int w = src.getWidth(), h = src.getHeight();
        double a = Math.toRadians(Math.abs(deg)), sin = Math.sin(a), cos = Math.cos(a);
        // fator de escala para o retângulo w×h girado caber inteiro na imagem original
        double scale = Math.min(w / (w * cos + h * sin), h / (w * sin + h * cos));
        int cw = Math.max(1, (int) Math.floor(w * scale)), ch = Math.max(1, (int) Math.floor(h * scale));
        BufferedImage out = new BufferedImage(cw, ch, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        ImageOps.quality(g);
        AffineTransform at = new AffineTransform();
        at.translate(cw / 2.0, ch / 2.0);
        at.rotate(Math.toRadians(deg));
        at.translate(-w / 2.0, -h / 2.0);
        g.drawRenderedImage(src, at);
        g.dispose();
        return out;
    }

    /** Homografia: o quadrilátero (sup.esq, sup.dir, inf.dir, inf.esq) vira o retângulo de saída; amostragem bilinear. */
    static BufferedImage perspective(BufferedImage src, double[][] quad) {
        int w = src.getWidth(), h = src.getHeight();
        double[][] q = new double[4][2];
        for (int i = 0; i < 4; i++) {
            q[i][0] = quad[i][0] * (w - 1);
            q[i][1] = quad[i][1] * (h - 1);
        }
        int ow = (int) Math.round((Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) + Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1])) / 2) + 1;
        int oh = (int) Math.round((Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])) / 2) + 1;
        ow = Math.max(1, Math.min(ow, MAX_SIDE));
        oh = Math.max(1, Math.min(oh, MAX_SIDE));
        double[] hm = homography(new double[][]{{0, 0}, {ow - 1, 0}, {ow - 1, oh - 1}, {0, oh - 1}}, q);
        int[] in = src.getRGB(0, 0, w, h, null, 0, w);
        int[] out = new int[ow * oh];
        for (int y = 0; y < oh; y++) {
            for (int x = 0; x < ow; x++) {
                double d = hm[6] * x + hm[7] * y + 1;
                double sx = (hm[0] * x + hm[1] * y + hm[2]) / d, sy = (hm[3] * x + hm[4] * y + hm[5]) / d;
                out[y * ow + x] = bilinear(in, w, h, sx, sy);
            }
        }
        BufferedImage o = new BufferedImage(ow, oh, BufferedImage.TYPE_INT_ARGB);
        o.setRGB(0, 0, ow, oh, out, 0, ow);
        return o;
    }

    /** Homografia que leva os pontos {@code from} aos {@code to} (8 incógnitas, eliminação de Gauss). */
    static double[] homography(double[][] from, double[][] to) {
        double[][] a = new double[8][9];
        for (int i = 0; i < 4; i++) {
            double x = from[i][0], y = from[i][1], u = to[i][0], v = to[i][1];
            a[2 * i] = new double[]{x, y, 1, 0, 0, 0, -u * x, -u * y, u};
            a[2 * i + 1] = new double[]{0, 0, 0, x, y, 1, -v * x, -v * y, v};
        }
        for (int c = 0; c < 8; c++) {
            int piv = c;
            for (int r = c + 1; r < 8; r++) {
                if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) {
                    piv = r;
                }
            }
            double[] tmp = a[c];
            a[c] = a[piv];
            a[piv] = tmp;
            double d = a[c][c];
            if (Math.abs(d) < 1e-12) {
                throw new IllegalArgumentException("PERSPECTIVA_DEGENERADA");
            }
            for (int k = c; k < 9; k++) {
                a[c][k] /= d;
            }
            for (int r = 0; r < 8; r++) {
                if (r != c) {
                    double f = a[r][c];
                    for (int k = c; k < 9; k++) {
                        a[r][k] -= f * a[c][k];
                    }
                }
            }
        }
        double[] hm = new double[8];
        for (int i = 0; i < 8; i++) {
            hm[i] = a[i][8];
        }
        return hm;
    }

    static int bilinear(int[] px, int w, int h, double x, double y) {
        if (x < 0 || y < 0 || x > w - 1 || y > h - 1) {
            return 0;
        }
        int x0 = (int) x, y0 = (int) y, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
        double fx = x - x0, fy = y - y0;
        int out = 0;
        for (int sh = 0; sh <= 24; sh += 8) {
            double v = ch(px[y0 * w + x0], sh) * (1 - fx) * (1 - fy) + ch(px[y0 * w + x1], sh) * fx * (1 - fy)
                    + ch(px[y1 * w + x0], sh) * (1 - fx) * fy + ch(px[y1 * w + x1], sh) * fx * fy;
            out |= (clamp255(v) << sh);
        }
        return out;
    }

    static BufferedImage crop(BufferedImage src, PhotoRecipe.Crop c) {
        int w = src.getWidth(), h = src.getHeight();
        int x = clamp((int) Math.round(c.x() * w), 0, w - 1), y = clamp((int) Math.round(c.y() * h), 0, h - 1);
        int cw = clamp((int) Math.round(c.w() * w), 1, w - x), chh = clamp((int) Math.round(c.h() * h), 1, h - y);
        if ("4:5".equals(c.aspect())) {
            // trava a proporção em pixels (a receita vem normalizada; arredondamento não pode esticar nada)
            if (cw * 5 > chh * 4) {
                cw = Math.max(1, chh * 4 / 5);
            } else {
                chh = Math.max(1, cw * 5 / 4);
            }
        }
        BufferedImage out = new BufferedImage(cw, chh, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        g.drawImage(src, -x, -y, null);
        g.dispose();
        return out;
    }

    BufferedImage background(BufferedImage src, PhotoRecipe.Background b) {
        int w = src.getWidth(), h = src.getHeight();
        BufferedImage cut = cutter.apply(src);
        if (cut.getWidth() != w || cut.getHeight() != h) {
            cut = ImageOps.scale(cut, w, h);
        }
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        int[] mask = cut.getRGB(0, 0, w, h, null, 0, w);
        int[] alpha = new int[w * h];
        for (int i = 0; i < alpha.length; i++) {
            alpha[i] = (mask[i] >>> 24) & 0xFF;
        }
        for (PhotoRecipe.Stroke s : b.strokes()) {
            int value = "ADD".equals(s.mode()) ? 255 : 0;
            double r = s.r() * w;
            double[] prev = null;
            for (double[] p : s.pts()) {
                double[] cur = {p[0] * w, p[1] * h};
                if (prev == null) {
                    dab(alpha, w, h, cur[0], cur[1], r, value);
                } else {
                    double len = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
                    int n = Math.max(1, (int) Math.ceil(len / Math.max(1, r / 2)));
                    for (int k = 1; k <= n; k++) {
                        dab(alpha, w, h, prev[0] + (cur[0] - prev[0]) * k / n, prev[1] + (cur[1] - prev[1]) * k / n, r, value);
                    }
                }
                prev = cur;
            }
        }
        BufferedImage piece = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        int[] out = new int[w * h];
        for (int i = 0; i < out.length; i++) {
            out[i] = (Math.min(alpha[i], (px[i] >>> 24) & 0xFF) << 24) | (px[i] & 0xFFFFFF);
        }
        piece.setRGB(0, 0, w, h, out, 0, w);
        BufferedImage result = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = result.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        if (b.kind() != PhotoRecipe.BackgroundKind.TRANSPARENT) {
            g.setColor(b.kind() == PhotoRecipe.BackgroundKind.WHITE ? Color.WHITE : NEUTRAL);
            g.fillRect(0, 0, w, h);
        }
        if ("SOFT".equals(b.shadow())) {
            ImageOps.Box box = ImageOps.alphaBounds(piece);
            if (!box.empty()) {
                drawContactShadow(g, box);
            }
        }
        g.drawImage(piece, 0, 0, null);
        g.dispose();
        return result;
    }

    /** Pincel com borda suave (2 px de transição) — a máscara não fica serrilhada. */
    static void dab(int[] alpha, int w, int h, double cx, double cy, double r, int value) {
        int x0 = Math.max(0, (int) (cx - r - 2)), x1 = Math.min(w - 1, (int) (cx + r + 2));
        int y0 = Math.max(0, (int) (cy - r - 2)), y1 = Math.min(h - 1, (int) (cy + r + 2));
        for (int y = y0; y <= y1; y++) {
            for (int x = x0; x <= x1; x++) {
                double d = Math.hypot(x - cx, y - cy);
                double f = d <= r ? 1 : d >= r + 2 ? 0 : 1 - (d - r) / 2;
                if (f > 0) {
                    int i = y * w + x;
                    alpha[i] = (int) Math.round(alpha[i] + (value - alpha[i]) * f);
                }
            }
        }
    }

    /** Sombra de contato: elipse achatada sob a base da peça, opacidade baixa, bordas em degradê. */
    static void drawContactShadow(Graphics2D g, ImageOps.Box box) {
        double cx = box.x() + box.w() / 2.0, cy = box.y() + box.h();
        double rx = box.w() * 0.45, ry = Math.max(3, box.h() * 0.035);
        for (int k = 12; k >= 1; k--) {
            double f = k / 12.0;
            g.setColor(new Color(0, 0, 0, (int) Math.round(10 * (1 - f) + 2)));
            g.fill(new java.awt.geom.Ellipse2D.Double(cx - rx * f, cy - ry * f, 2 * rx * f, 2 * ry * f));
        }
    }

    /** Ganhos por canal que deixam a amostra (área 1,5% da largura) neutra, preservando a luminância; limitados. */
    static BufferedImage whiteBalance(BufferedImage src, double sx, double sy) {
        int w = src.getWidth(), h = src.getHeight();
        int r = Math.max(2, (int) (w * 0.015)), cx = clamp((int) (sx * w), 0, w - 1), cy = clamp((int) (sy * h), 0, h - 1);
        double sr = 0, sg = 0, sb = 0;
        int n = 0;
        for (int y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
            for (int x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
                int p = src.getRGB(x, y);
                if (((p >>> 24) & 0xFF) < 128) {
                    continue;
                }
                sr += lin((p >> 16) & 0xFF);
                sg += lin((p >> 8) & 0xFF);
                sb += lin(p & 0xFF);
                n++;
            }
        }
        if (n == 0 || sr <= 0 || sg <= 0 || sb <= 0) {
            return src;
        }
        double gray = (sr + sg + sb) / 3;
        double gr = clampD(gray / sr, 0.6, 1.6), gg = clampD(gray / sg, 0.6, 1.6), gb = clampD(gray / sb, 0.6, 1.6);
        return mapLinear(src, (c) -> new double[]{c[0] * gr, c[1] * gg, c[2] * gb});
    }

    static BufferedImage tone(BufferedImage src, PhotoRecipe.Tone t) {
        double gain = Math.pow(2, t.exposureEv());
        double hl = t.highlights() / 100, sh = t.shadows() / 100, ct = t.contrast() / 100, sat = t.saturation() / 100;
        return mapLinear(src, (c) -> {
            double r = c[0] * gain, g = c[1] * gain, b = c[2] * gain;
            double y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            double yy = Math.max(1e-6, Math.min(1, y));
            // realces e sombras atuam pela luminância, preservando o matiz
            double ny = yy + sh * Math.pow(1 - yy, 2) * yy * 1.5 + hl * yy * yy * (1 - yy) * 1.5;
            // contraste em torno do cinza médio, na curva perceptual
            double p = Math.pow(Math.max(0, ny), 1 / 2.2);
            p = 0.5 + (p - 0.5) * (1 + ct);
            ny = Math.pow(clampD(p, 0, 1), 2.2);
            double k = ny / yy;
            r *= k;
            g *= k;
            b *= k;
            double y2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            return new double[]{y2 + (r - y2) * (1 + sat), y2 + (g - y2) * (1 + sat), y2 + (b - y2) * (1 + sat)};
        });
    }

    /** Retoque local: cada mancha recebe a média ponderada (inverso da distância) do anel entre r e 1,6 r. */
    static BufferedImage heal(BufferedImage src, List<double[]> spots) {
        int w = src.getWidth(), h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        for (double[] s : spots) {
            double cx = s[0] * w, cy = s[1] * h, r = Math.max(1.5, s[2] * w), ring = r * 1.6;
            int x0 = Math.max(0, (int) (cx - ring)), x1 = Math.min(w - 1, (int) (cx + ring));
            int y0 = Math.max(0, (int) (cy - ring)), y1 = Math.min(h - 1, (int) (cy + ring));
            java.util.List<int[]> border = new java.util.ArrayList<>();
            for (int y = y0; y <= y1; y++) {
                for (int x = x0; x <= x1; x++) {
                    double d = Math.hypot(x - cx, y - cy);
                    if (d > r && d <= ring) {
                        border.add(new int[]{x, y, px[y * w + x]});
                    }
                }
            }
            if (border.isEmpty()) {
                continue;
            }
            int[] copy = px.clone();
            for (int y = y0; y <= y1; y++) {
                for (int x = x0; x <= x1; x++) {
                    if (Math.hypot(x - cx, y - cy) > r) {
                        continue;
                    }
                    double[] acc = new double[4];
                    double ws = 0;
                    for (int[] bp : border) {
                        double wt = 1 / (1 + Math.hypot(bp[0] - x, bp[1] - y));
                        wt *= wt;
                        for (int c = 0; c < 4; c++) {
                            acc[c] += ch(bp[2], c * 8) * wt;
                        }
                        ws += wt;
                    }
                    int out = 0;
                    for (int c = 0; c < 4; c++) {
                        out |= clamp255(acc[c] / ws) << (c * 8);
                    }
                    copy[y * w + x] = out;
                }
            }
            px = copy;
        }
        BufferedImage o = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        o.setRGB(0, 0, w, h, px, 0, w);
        return o;
    }

    /** Máscara de nitidez com desfoque 3×3; {@code amount} até 1 (0,3 na canônica). */
    static BufferedImage sharpen(BufferedImage src, double amount) {
        if (amount <= 0) {
            return src;
        }
        int w = src.getWidth(), h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w), out = px.clone();
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int i = y * w + x, res = px[i] & 0xFF000000;
                for (int sh = 0; sh <= 16; sh += 8) {
                    double blur = 0;
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            blur += ch(px[i + dy * w + dx], sh);
                        }
                    }
                    blur /= 9;
                    double v = ch(px[i], sh);
                    res |= clamp255(v + (v - blur) * amount * 1.5) << sh;
                }
                out[i] = res;
            }
        }
        BufferedImage o = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        o.setRGB(0, 0, w, h, out, 0, w);
        return o;
    }

    static BufferedImage filter(BufferedImage src, String style, double k) {
        return mapLinear(src, (c) -> {
            double r = c[0], g = c[1], b = c[2], y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            double[] t = switch (style) {
                case "WARM" -> new double[]{r * 1.08, g * 1.02, b * 0.88};
                case "COOL" -> new double[]{r * 0.9, g * 1.0, b * 1.1};
                case "MONO" -> new double[]{y, y, y};
                default -> new double[]{y * 1.05 + 0.02, y * 0.95 + 0.015, y * 0.8};      // VINTAGE: sépia suave
            };
            return new double[]{r + (t[0] - r) * k, g + (t[1] - g) * k, b + (t[2] - b) * k};
        });
    }

    interface LinearMap {
        double[] apply(double[] rgbLinear);
    }

    /** Aplica uma função em RGB linear (0–1), preservando o alfa; tabela sRGB → linear para velocidade. */
    static BufferedImage mapLinear(BufferedImage src, LinearMap f) {
        int w = src.getWidth(), h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        for (int i = 0; i < px.length; i++) {
            int p = px[i], a = p & 0xFF000000;
            if (a == 0) {
                continue;
            }
            double[] o = f.apply(new double[]{LIN[(p >> 16) & 0xFF], LIN[(p >> 8) & 0xFF], LIN[p & 0xFF]});
            px[i] = a | (srgb(o[0]) << 16) | (srgb(o[1]) << 8) | srgb(o[2]);
        }
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        return out;
    }

    static final double[] LIN = new double[256];

    static {
        for (int i = 0; i < 256; i++) {
            LIN[i] = lin(i);
        }
    }

    static double lin(int c) {
        double v = c / 255.0;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }

    static int srgb(double v) {
        double c = clampD(v, 0, 1);
        double s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        return clamp255(s * 255);
    }

    static double ch(int p, int shift) {
        return (p >>> shift) & 0xFF;
    }

    static int clamp255(double v) {
        return (int) Math.max(0, Math.min(255, Math.round(v)));
    }

    static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    static double clampD(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
