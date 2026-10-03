package br.com.fashionai.application.vision.analysis;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.vision.ModelRef;

import java.awt.image.BufferedImage;

/**
 * RF4 · Embedding visual v1 (descritor local, 96 dimensões, norma L2): histograma HSV da peça (72), forma da máscara
 * (proporção, ocupação e perfil de largura em 8 faixas, 10), orientação de gradientes (8), densidade de borda e
 * estatísticas de luminância (6). Fraco para marca — por isso entra no ensemble com peso baixo e só a partir de
 * vizinhos com marca verificada. O modelo aprendido (FashionCLIP/DINOv2) substitui pela mesma porta.
 */
public final class GarmentEmbedder {
    public static final ModelRef MODEL = ModelRef.GARMENT_EMBEDDING;
    public static final int DIMENSIONS = 96;

    public float[] embed(BufferedImage cutout) {
        BufferedImage s = ImageOps.scaleToFit(ImageOps.toArgb(cutout), 128, 128);
        int w = s.getWidth(), h = s.getHeight();
        int[] px = s.getRGB(0, 0, w, h, null, 0, w);
        float[] v = new float[DIMENSIONS];
        double[] lum = new double[w * h];
        boolean[] on = new boolean[w * h];
        int count = 0;
        float[] hsv = new float[3];
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            if ((p >>> 24) < 128) {
                continue;
            }
            on[i] = true;
            count++;
            int r = p >> 16 & 0xFF, g = p >> 8 & 0xFF, b = p & 0xFF;
            java.awt.Color.RGBtoHSB(r, g, b, hsv);
            int hb = Math.min(7, (int) (hsv[0] * 8)), sb = Math.min(2, (int) (hsv[1] * 3)), vb = Math.min(2, (int) (hsv[2] * 3));
            v[hb * 9 + sb * 3 + vb] += 1;
            lum[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0;
        }
        if (count == 0) {
            return v;
        }
        for (int i = 0; i < 72; i++) {
            v[i] /= count;
        }
        ImageOps.Box box = ImageOps.alphaBounds(s);
        v[72] = (float) Math.min(2, box.w() / (double) Math.max(1, box.h())) / 2f;
        v[73] = (float) (count / (double) Math.max(1, box.w() * box.h()));
        for (int band = 0; band < 8; band++) {
            int y = box.y() + (int) ((band + 0.5) * box.h() / 8.0);
            int l = -1, r = -1;
            for (int x = 0; x < w; x++) {
                if (y < h && on[y * w + x]) {
                    if (l < 0) {
                        l = x;
                    }
                    r = x;
                }
            }
            v[74 + band] = l < 0 ? 0 : (r - l + 1) / (float) Math.max(1, box.w());
        }
        double edges = 0, sumL = 0, sumL2 = 0;
        int interior = 0;
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int i = y * w + x;
                if (!on[i] || !on[i - 1] || !on[i + 1] || !on[i - w] || !on[i + w]) {
                    continue;
                }
                double gx = lum[i + 1] - lum[i - 1], gy = lum[i + w] - lum[i - w];
                double mag = Math.hypot(gx, gy);
                interior++;
                sumL += lum[i];
                sumL2 += lum[i] * lum[i];
                if (mag > 0.08) {
                    edges++;
                    double ang = (Math.atan2(gy, gx) + Math.PI) % Math.PI;
                    v[82 + Math.min(7, (int) (ang / Math.PI * 8))] += 1;
                }
            }
        }
        if (edges > 0) {
            for (int i = 82; i < 90; i++) {
                v[i] /= (float) edges;
            }
        }
        if (interior > 0) {
            double mean = sumL / interior;
            v[90] = (float) (edges / interior);
            v[91] = (float) mean;
            v[92] = (float) Math.sqrt(Math.max(0, sumL2 / interior - mean * mean));
        }
        v[93] = (float) (count / (double) (w * h));
        double norm = 0;
        for (float f : v) {
            norm += f * f;
        }
        norm = Math.sqrt(norm);
        if (norm > 0) {
            for (int i = 0; i < v.length; i++) {
                v[i] /= (float) norm;
            }
        }
        return v;
    }

    public static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) {
            return 0;
        }
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        return na == 0 || nb == 0 ? 0 : dot / Math.sqrt(na * nb);
    }
}
