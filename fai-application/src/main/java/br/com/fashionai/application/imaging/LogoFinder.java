package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;

/**
 * RF4 · Estúdio — logo da peça: onde está e como dar foco a ele.
 * <p>
 * A posição vem de preferência da IA de visão (o Piece Analyzer devolve a caixa do logotipo junto com a análise).
 * Sem IA, o detector local procura uma mancha compacta com cor bem diferente do tecido em volta (etiqueta, estampa,
 * bordado, letras), descartando linhas (zíper, costuras), blocos de cor grandes e o que encosta no contorno.
 * <p>
 * Com o logo, o estúdio dá nitidez extra só a ele na foto principal e gera a <b>foto de detalhe</b> 4:5 enquadrada no
 * logo, com o resto levemente desfocado (profundidade de campo de foto de produto).
 */
final class LogoFinder {
    private LogoFinder() {
    }

    /** @param box caixa relativa à peça (0–1: x0, y0, x1, y1) · @param source "ia" ou "local" */
    record Logo(double[] box, double confidence, String source) {
    }

    /**
     * Detector local: logos, etiquetas, estampas e bordados aparecem como manchas <b>compactas</b> com cor bem
     * diferente do tecido em volta. Linhas (zíper, vivos, costuras) são descartadas pelo alongamento; blocos de cor
     * grandes (color block) pelo tamanho; e o que encosta no contorno da peça (punhos, barra) pela margem.
     */
    static Logo detect(BufferedImage piece) {
        BufferedImage img = ImageOps.scaleToFit(piece, 700, 700);
        int w = img.getWidth(), h = img.getHeight(), n = w * h;
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        boolean[][] in = new boolean[h][w];
        float[] L = new float[n], A = new float[n], B = new float[n];
        for (int i = 0; i < n; i++) {
            in[i / w][i % w] = (px[i] >>> 24) >= 200;
            double[] lab = br.com.fashionai.application.ai.local.ColorMath.lab(px[i]);
            L[i] = (float) lab[0];
            A[i] = (float) lab[1];
            B[i] = (float) lab[2];
        }
        double[][] dist = ReliefModelGenerator.distance(in, w, h);
        ImageOps.Box gb = ImageOps.alphaBounds(img);
        int minSide = Math.min(gb.w(), gb.h());
        if (minSide < 60) {
            return null;
        }
        // cor "do tecido em volta": média larga em Lab, só com pixels da peça (a parede transparente não conta)
        int rad = Math.max(4, (int) (minSide * 0.06));
        float[] wgt = new float[n];
        float[] lw = new float[n], aw = new float[n], bw = new float[n];
        for (int i = 0; i < n; i++) {
            if (in[i / w][i % w]) {
                wgt[i] = 1;
                lw[i] = L[i];
                aw[i] = A[i];
                bw[i] = B[i];
            }
        }
        float[] mw = StudioPipeline.boxBlur(wgt, w, h, rad, 2), ml = StudioPipeline.boxBlur(lw, w, h, rad, 2),
                ma = StudioPipeline.boxBlur(aw, w, h, rad, 2), mb = StudioPipeline.boxBlur(bw, w, h, rad, 2);
        int margin = Math.max(4, minSide / 30);
        boolean[] distinct = new boolean[n];
        float[] contrast = new float[n];
        for (int i = 0; i < n; i++) {
            int x = i % w, y = i / w;
            if (!in[y][x] || dist[y][x] <= margin || mw[i] < 0.5f) {
                continue;
            }
            float dl = L[i] - ml[i] / mw[i], da = A[i] - ma[i] / mw[i], db = B[i] - mb[i] / mw[i];
            contrast[i] = (float) Math.sqrt(dl * dl + da * da + db * db);
            distinct[i] = contrast[i] > 28;
        }
        // letras de uma palavra viram um grupo: dilatação curta antes de rotular
        int grow = Math.max(1, (int) (minSide * 0.012));
        boolean[] grown = distinct.clone();
        for (int pass = 0; pass < grow; pass++) {
            boolean[] next = grown.clone();
            for (int y = 1; y < h - 1; y++) {
                for (int x = 1; x < w - 1; x++) {
                    int i = y * w + x;
                    if (!grown[i] && (grown[i - 1] || grown[i + 1] || grown[i - w] || grown[i + w]) && in[y][x]) {
                        next[i] = true;
                    }
                }
            }
            grown = next;
        }
        int[] label = new int[n];
        java.util.ArrayDeque<Integer> q = new java.util.ArrayDeque<>();
        double bestScore = 0;
        double[] bestBox = null;
        int id = 0;
        for (int s0 = 0; s0 < n; s0++) {
            if (!grown[s0] || label[s0] != 0) {
                continue;
            }
            id++;
            int x0 = w, y0 = h, x1 = -1, y1 = -1, core = 0;
            double sumC = 0;
            boolean touches = false;
            q.add(s0);
            label[s0] = id;
            while (!q.isEmpty()) {
                int i = q.poll(), x = i % w, y = i / w;
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x);
                y1 = Math.max(y1, y);
                if (distinct[i]) {
                    core++;
                    sumC += contrast[i];
                }
                if (dist[y][x] <= margin + 1) {
                    touches = true;
                }
                int[] nb = {x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w};
                for (int j : nb) {
                    if (j >= 0 && j < n && grown[j] && label[j] == 0) {
                        label[j] = id;
                        q.add(j);
                    }
                }
            }
            int bw0 = x1 - x0 + 1, bh0 = y1 - y0 + 1, size = Math.max(bw0, bh0);
            double aspect = size / (double) Math.max(1, Math.min(bw0, bh0));
            if (touches || core < 12 || size < minSide * 0.02 || size > minSide * 0.22 || aspect > 3.2) {
                continue;                                   // borda da peça, sujeira, bloco de cor grande ou linha
            }
            double meanC = sumC / core;
            double fillRatio = core / (double) (bw0 * bh0);
            double score = (meanC / 60.0) * Math.sqrt(core) * (0.5 + Math.min(0.5, fillRatio));
            if (score > bestScore) {
                bestScore = score;
                double pad = Math.max(size * 0.20, minSide * 0.015);
                bestBox = new double[]{
                        clamp01((x0 - pad - gb.x()) / gb.w()), clamp01((y0 - pad - gb.y()) / gb.h()),
                        clamp01((x1 + pad - gb.x()) / gb.w()), clamp01((y1 + pad - gb.y()) / gb.h())};
            }
        }
        if (bestBox == null || bestScore < 4) {
            return null;
        }
        return new Logo(bestBox, Math.min(0.8, 0.35 + bestScore / 40), "local");
    }

    private static double clamp01(double v) {
        return Math.max(0, Math.min(1, v));
    }

    /** Foto principal: nitidez extra só na área do logo (transição suave), o resto fica como está. */
    static BufferedImage focus(BufferedImage piece, double[] box) {
        int w = piece.getWidth(), h = piece.getHeight();
        int[] px = piece.getRGB(0, 0, w, h, null, 0, w);
        float[] y = StudioQuality.luminance(px);
        float[] blur = StudioPipeline.boxBlur(y, w, h, 2, 2);
        double cx0 = box[0] * w, cy0 = box[1] * h, cx1 = box[2] * w, cy1 = box[3] * h;
        double feather = Math.max(6, Math.max(cx1 - cx0, cy1 - cy0) * 0.35);
        int[] out = px.clone();
        for (int yy = (int) Math.max(0, cy0 - feather); yy < Math.min(h, cy1 + feather); yy++) {
            for (int x = (int) Math.max(0, cx0 - feather); x < Math.min(w, cx1 + feather); x++) {
                int i = yy * w + x, p = px[i];
                if ((p >>> 24) == 0) {
                    continue;
                }
                double dx = Math.max(0, Math.max(cx0 - x, x - cx1)), dy = Math.max(0, Math.max(cy0 - yy, yy - cy1));
                float wt = 1 - StudioQuality.smoothstep(0, (float) feather, (float) Math.hypot(dx, dy));
                float delta = 0.9f * wt * (y[i] - blur[i]);
                out[i] = (p & 0xFF000000) | (StudioQuality.clamp(((p >> 16) & 255) + delta) << 16)
                        | (StudioQuality.clamp(((p >> 8) & 255) + delta) << 8) | StudioQuality.clamp((p & 255) + delta);
            }
        }
        BufferedImage res = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        res.setRGB(0, 0, w, h, out, 0, w);
        return res;
    }

    /**
     * Foto de detalhe 4:5 (1200×1500) centrada no logo: recorte da peça em alta, fundo de estúdio onde a peça
     * acaba, logo nítido e desfoque que cresce com a distância dele (foco seletivo).
     */
    static BufferedImage detail(BufferedImage piece, double[] box, StudioPipeline.Backdrop bd) {
        int W = 1200, H = 1500;
        int pw = piece.getWidth(), ph = piece.getHeight();
        double lx0 = box[0] * pw, ly0 = box[1] * ph, lx1 = box[2] * pw, ly1 = box[3] * ph;
        double cx = (lx0 + lx1) / 2, cy = (ly0 + ly1) / 2;
        double cw = Math.max(Math.max(lx1 - lx0, (ly1 - ly0) * 0.8) * 2.8, Math.min(pw, ph) * 0.30);
        cw = Math.min(cw, Math.max(pw, ph) * 0.9);
        double ch = cw * H / W;
        double x0 = cx - cw / 2, y0 = cy - ch / 2;
        int[] out = StudioFraming.backdrop(W, H, bd);
        // amostra a peça (bilinear no espaço da peça) para cada pixel do detalhe
        int[] src = piece.getRGB(0, 0, pw, ph, null, 0, pw);
        double sx = cw / W, sy = ch / H;
        for (int y = 0; y < H; y++) {
            for (int x = 0; x < W; x++) {
                double u = x0 + (x + 0.5) * sx - 0.5, v = y0 + (y + 0.5) * sy - 0.5;
                int p = sample(src, pw, ph, u, v);
                float a = (p >>> 24) / 255f;
                if (a <= 0) {
                    continue;
                }
                int q = out[y * W + x];
                out[y * W + x] = 0xFF000000 | (mix((q >> 16) & 255, (p >> 16) & 255, a) << 16)
                        | (mix((q >> 8) & 255, (p >> 8) & 255, a) << 8) | mix(q & 255, p & 255, a);
            }
        }
        // foco: nitidez no logo, desfoque progressivo fora dele
        float[] r = new float[W * H], g = new float[W * H], b = new float[W * H];
        for (int i = 0; i < out.length; i++) {
            r[i] = (out[i] >> 16) & 255;
            g[i] = (out[i] >> 8) & 255;
            b[i] = out[i] & 255;
        }
        float[] rb = StudioPipeline.boxBlur(r, W, H, 4, 2), gbv = StudioPipeline.boxBlur(g, W, H, 4, 2), bb = StudioPipeline.boxBlur(b, W, H, 4, 2);
        float[] rs = StudioPipeline.boxBlur(r, W, H, 1, 2), gs = StudioPipeline.boxBlur(g, W, H, 1, 2), bs = StudioPipeline.boxBlur(b, W, H, 1, 2);
        double bx0 = (lx0 - x0) / sx, by0 = (ly0 - y0) / sy, bx1 = (lx1 - x0) / sx, by1 = (ly1 - y0) / sy;
        double near = H * 0.06, far = H * 0.45;
        for (int y = 0; y < H; y++) {
            for (int x = 0; x < W; x++) {
                int i = y * W + x;
                double dx = Math.max(0, Math.max(bx0 - x, x - bx1)), dy = Math.max(0, Math.max(by0 - y, y - by1));
                float d = (float) Math.hypot(dx, dy);
                float blurW = 0.8f * StudioQuality.smoothstep((float) near, (float) far, d);
                float sharpW = 1 - StudioQuality.smoothstep(0, (float) near, d);
                float nr = r[i] + (rb[i] - r[i]) * blurW + 0.8f * sharpW * (r[i] - rs[i]);
                float ng = g[i] + (gbv[i] - g[i]) * blurW + 0.8f * sharpW * (g[i] - gs[i]);
                float nb = b[i] + (bb[i] - b[i]) * blurW + 0.8f * sharpW * (b[i] - bs[i]);
                out[i] = 0xFF000000 | (StudioQuality.clamp(nr) << 16) | (StudioQuality.clamp(ng) << 8) | StudioQuality.clamp(nb);
            }
        }
        BufferedImage res = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        res.setRGB(0, 0, W, H, out, 0, W);
        return res;
    }

    private static int sample(int[] src, int w, int h, double u, double v) {
        if (u < -1 || v < -1 || u > w || v > h) {
            return 0;
        }
        int x0 = (int) Math.floor(u), y0 = (int) Math.floor(v);
        double fx = u - x0, fy = v - y0;
        int[] c = new int[4];
        for (int k = 0; k < 4; k++) {
            int xx = x0 + (k & 1), yy = y0 + (k >> 1);
            c[k] = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : src[yy * w + xx];
        }
        double[] acc = new double[4];
        double[] wts = {(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy};
        double aSum = 0;
        for (int k = 0; k < 4; k++) {
            double a = (c[k] >>> 24) / 255.0 * wts[k];
            aSum += a;
            acc[0] += ((c[k] >> 16) & 255) * a;
            acc[1] += ((c[k] >> 8) & 255) * a;
            acc[2] += (c[k] & 255) * a;
        }
        if (aSum <= 1e-6) {
            return 0;
        }
        return ((int) Math.round(aSum * 255) << 24) | ((int) Math.round(acc[0] / aSum) << 16)
                | ((int) Math.round(acc[1] / aSum) << 8) | (int) Math.round(acc[2] / aSum);
    }

    private static int mix(int a, int b, float t) {
        return Math.round(a + (b - a) * t);
    }
}
