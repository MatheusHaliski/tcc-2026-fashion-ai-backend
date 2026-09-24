package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;

/**
 * RF4 · Estúdio — acabamento de imagem: tira o granulado sem amolecer costuras, deixa o contorno liso (sem degraus
 * da ampliação nem franja da parede) e só dá nitidez onde existe borda de verdade. É o que separa uma foto de celular
 * "realçada" (grão estourado) de uma foto de produto limpa.
 */
final class StudioQuality {
    private StudioQuality() {
    }

    /**
     * Ruído da foto (Immerkær, 1996): média de |laplaciano| na área lisa e opaca da peça, em níveis de cinza.
     * Bordas fortes ficam de fora para a textura/costura não parecer ruído.
     */
    static double noiseSigma(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight();
        if (w < 5 || h < 5) {
            return 0;
        }
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        float[] y = luminance(px);
        int step = Math.max(1, Math.max(w, h) / 900);
        double sum = 0;
        long n = 0;
        for (int yy = 1; yy < h - 1; yy += step) {
            for (int x = 1; x < w - 1; x += step) {
                int i = yy * w + x;
                if ((px[i] >>> 24) < 250 || (px[i - w - 1] >>> 24) < 250 || (px[i + w + 1] >>> 24) < 250
                        || (px[i - w + 1] >>> 24) < 250 || (px[i + w - 1] >>> 24) < 250) {
                    continue;
                }
                float gx = (y[i - w + 1] + 2 * y[i + 1] + y[i + w + 1]) - (y[i - w - 1] + 2 * y[i - 1] + y[i + w - 1]);
                float gy = (y[i + w - 1] + 2 * y[i + w] + y[i + w + 1]) - (y[i - w - 1] + 2 * y[i - w] + y[i - w + 1]);
                if (Math.abs(gx) + Math.abs(gy) > 60) {
                    continue;                                   // borda: não é ruído
                }
                double conv = y[i - w - 1] - 2 * y[i - w] + y[i - w + 1] - 2 * y[i - 1] + 4 * y[i] - 2 * y[i + 1]
                        + y[i + w - 1] - 2 * y[i + w] + y[i + w + 1];
                sum += Math.abs(conv);
                n++;
            }
        }
        return n == 0 ? 0 : Math.sqrt(Math.PI / 2) * sum / (6.0 * n);
    }

    /**
     * Filtro bilateral só dentro da peça: suaviza o granulado (vizinhos parecidos) e preserva contornos (vizinhos
     * diferentes pesam quase nada). A força segue o ruído medido; foto limpa passa direto.
     */
    static BufferedImage denoise(BufferedImage src, double sigma) {
        if (sigma < 1.6) {
            return src;
        }
        int w = src.getWidth(), h = src.getHeight();
        int r = Math.max(w, h) > 1400 ? 2 : 3;
        double sr = Math.max(5, Math.min(20, sigma * 2.2));
        double ss = Math.max(0.9, r * 0.6);
        float[] range = new float[256];
        for (int d = 0; d < 256; d++) {
            range[d] = (float) Math.exp(-(d * d) / (2 * sr * sr));
        }
        float[] spatial = new float[(2 * r + 1) * (2 * r + 1)];
        for (int dy = -r; dy <= r; dy++) {
            for (int dx = -r; dx <= r; dx++) {
                spatial[(dy + r) * (2 * r + 1) + dx + r] = (float) Math.exp(-(dx * dx + dy * dy) / (2 * ss * ss));
            }
        }
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        int[] out = px.clone();
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x, p = px[i];
                if ((p >>> 24) < 128) {
                    continue;
                }
                int pr = (p >> 16) & 255, pg = (p >> 8) & 255, pb = p & 255;
                float sw = 0, ar = 0, ag = 0, ab = 0;
                for (int dy = -r; dy <= r; dy++) {
                    int yy = y + dy;
                    if (yy < 0 || yy >= h) {
                        continue;
                    }
                    for (int dx = -r; dx <= r; dx++) {
                        int xx = x + dx;
                        if (xx < 0 || xx >= w) {
                            continue;
                        }
                        int q = px[yy * w + xx];
                        if ((q >>> 24) < 128) {
                            continue;                           // nunca puxa cor da parede para dentro
                        }
                        int qr = (q >> 16) & 255, qg = (q >> 8) & 255, qb = q & 255;
                        int d = (Math.abs(qr - pr) + Math.abs(qg - pg) + Math.abs(qb - pb)) / 3;
                        float wt = spatial[(dy + r) * (2 * r + 1) + dx + r] * range[d];
                        sw += wt;
                        ar += wt * qr;
                        ag += wt * qg;
                        ab += wt * qb;
                    }
                }
                out[i] = (p & 0xFF000000) | (clamp(ar / sw) << 16) | (clamp(ag / sw) << 8) | clamp(ab / sw);
            }
        }
        BufferedImage res = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        res.setRGB(0, 0, w, h, out, 0, w);
        return res;
    }

    /**
     * Contorno de estúdio: o alfa ampliado vira degraus; aqui ele é suavizado e recortado de novo com uma curva
     * (borda lisa e firme) e os pixels da borda recebem a cor de dentro da peça (some a franja cinza da parede).
     */
    static BufferedImage refineEdges(BufferedImage src, double upFactor) {
        int w = src.getWidth(), h = src.getHeight(), n = w * h;
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        float[] a = new float[n];
        for (int i = 0; i < n; i++) {
            a[i] = (px[i] >>> 24) / 255f;
        }
        int r = (int) Math.max(1, Math.round(upFactor * 0.6));
        float[] ab = StudioPipeline.boxBlur(a, w, h, r, 2);
        float[] a2 = new float[n];
        for (int i = 0; i < n; i++) {
            a2[i] = smoothstep(0.30f, 0.70f, ab[i]);
        }
        // núcleo: opaco e com vizinhos opacos a 2 px — a cor dele é a cor "verdadeira" da peça
        boolean[] known = new boolean[n];
        int[] col = new int[n];
        for (int y = 2; y < h - 2; y++) {
            for (int x = 2; x < w - 2; x++) {
                int i = y * w + x;
                if (a[i] >= 0.99f && a[i - 2] >= 0.99f && a[i + 2] >= 0.99f && a[i - 2 * w] >= 0.99f && a[i + 2 * w] >= 0.99f) {
                    known[i] = true;
                    col[i] = px[i] & 0x00FFFFFF;
                }
            }
        }
        // a cor de dentro avança até a borda (algumas passadas de média dos vizinhos já conhecidos)
        for (int pass = 0; pass < r + 4; pass++) {
            boolean[] next = known.clone();
            for (int y = 1; y < h - 1; y++) {
                for (int x = 1; x < w - 1; x++) {
                    int i = y * w + x;
                    if (known[i] || a2[i] <= 0 && a[i] <= 0) {
                        continue;
                    }
                    int cr = 0, cg = 0, cb = 0, c = 0;
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            int j = i + dy * w + dx;
                            if (known[j]) {
                                cr += (col[j] >> 16) & 255;
                                cg += (col[j] >> 8) & 255;
                                cb += col[j] & 255;
                                c++;
                            }
                        }
                    }
                    if (c > 0) {
                        col[i] = ((cr / c) << 16) | ((cg / c) << 8) | (cb / c);
                        next[i] = true;
                    }
                }
            }
            known = next;
        }
        int[] out = new int[n];
        for (int i = 0; i < n; i++) {
            int alpha = Math.round(a2[i] * 255);
            if (alpha == 0) {
                continue;
            }
            boolean core = a[i] >= 0.99f && a2[i] >= 0.99f;
            int rgb = core || !known[i] ? px[i] & 0x00FFFFFF : col[i];
            out[i] = (alpha << 24) | rgb;
        }
        BufferedImage res = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        res.setRGB(0, 0, w, h, out, 0, w);
        return res;
    }

    /**
     * Nitidez com limiar + contraste local + vibração: o detalhe fino só é reforçado onde o gradiente passa do nível
     * do ruído (costura, zíper, trama, contorno), então superfícies lisas continuam lisas.
     */
    static BufferedImage sharpen(BufferedImage src, float clarity, float fine, float vibrance) {
        return sharpen(src, clarity, fine, vibrance, 1);
    }

    /** @param radius raio da nitidez fina — acompanha a ampliação (o detalhe da foto original ficou mais largo) */
    static BufferedImage sharpen(BufferedImage src, float clarity, float fine, float vibrance, int radius) {
        int w = src.getWidth(), h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        float[] y = luminance(px);
        float[] wide = StudioPipeline.boxBlur(y, w, h, Math.max(4, Math.max(w, h) / 70), 3);
        float[] soft = StudioPipeline.boxBlur(y, w, h, Math.max(1, radius), 2);
        int[] out = new int[px.length];
        for (int yy = 0; yy < h; yy++) {
            for (int x = 0; x < w; x++) {
                int i = yy * w + x, p = px[i], a = p >>> 24;
                if (a == 0) {
                    continue;
                }
                float gx = soft[yy * w + Math.min(w - 1, x + 1)] - soft[yy * w + Math.max(0, x - 1)];
                float gy = soft[Math.min(h - 1, yy + 1) * w + x] - soft[Math.max(0, yy - 1) * w + x];
                float edge = smoothstep(3f / radius, 14f / radius, (float) Math.sqrt(gx * gx + gy * gy));
                float delta = clarity * (y[i] - wide[i]) + fine * edge * (y[i] - soft[i]);
                float r = ((p >> 16) & 255) + delta, g = ((p >> 8) & 255) + delta, b = (p & 255) + delta;
                float mean = (r + g + b) / 3f, mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b));
                float sat = mx <= 0 ? 0 : (mx - mn) / Math.max(1f, mx);
                float k = 1f + vibrance * (1f - Math.min(1f, sat));
                r = mean + (r - mean) * k;
                g = mean + (g - mean) * k;
                b = mean + (b - mean) * k;
                out[i] = (a << 24) | (clamp(StudioPipeline.soft(r)) << 16) | (clamp(StudioPipeline.soft(g)) << 8) | clamp(StudioPipeline.soft(b));
            }
        }
        BufferedImage res = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        res.setRGB(0, 0, w, h, out, 0, w);
        return res;
    }

    static float[] luminance(int[] px) {
        float[] y = new float[px.length];
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            y[i] = 0.299f * ((p >> 16) & 255) + 0.587f * ((p >> 8) & 255) + 0.114f * (p & 255);
        }
        return y;
    }

    static float smoothstep(float e0, float e1, float v) {
        float t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
    }

    static int clamp(float v) {
        return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }
}
