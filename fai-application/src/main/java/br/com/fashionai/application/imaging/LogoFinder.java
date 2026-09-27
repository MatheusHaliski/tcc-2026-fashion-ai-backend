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

    /**
     * @param box   caixa relativa à peça (0–1: x0, y0, x1, y1) · @param source "ia" ou "local"
     * @param print a marca achada faz parte de uma estampa (frase, gráfico grande): não é logo a destacar
     */
    record Logo(double[] box, double confidence, String source, boolean print) {
        Logo(double[] box, double confidence, String source) {
            this(box, confidence, source, false);
        }
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
        // candidatos (pontuação, caixa na imagem, caixa relativa à peça): o melhor que não for estampa é o logo
        java.util.List<Object[]> candidates = new java.util.ArrayList<>();
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
            if (score >= 4) {
                double pad = Math.max(size * 0.20, minSide * 0.015);
                candidates.add(new Object[]{score, new int[]{x0, y0, x1, y1}, new double[]{
                        clamp01((x0 - pad - gb.x()) / gb.w()), clamp01((y0 - pad - gb.y()) / gb.h()),
                        clamp01((x1 + pad - gb.x()) / gb.w()), clamp01((y1 + pad - gb.y()) / gb.h())}});
            }
        }
        candidates.sort((a, b) -> Double.compare((double) b[0], (double) a[0]));
        Logo print = null;
        for (Object[] c : candidates) {
            double score = (double) c[0];
            int[] rect = (int[]) c[1];
            double[] box = (double[]) c[2];
            if (isPrint(distinct, in, label, w, h, rect, gb, minSide)) {
                if (print == null) {
                    print = new Logo(box, Math.min(0.8, 0.35 + score / 40), "local", true);
                }
                continue;                                   // a frase fica intacta; um selo de marca ao lado ainda vale
            }
            return new Logo(box, Math.min(0.8, 0.35 + score / 40), "local", false);
        }
        return print != null ? print : detectDetail(img, in, dist, gb, minSide, margin, L);
    }

    /**
     * Estampa × logo. Um logo é uma marca compacta e isolada, em geral fora do eixo (peito esquerdo, bolso, barra).
     * Estampa é: (1) um bloco largo no eixo do peito (frase ou gráfico frontal, ≥ 18% da largura da peça);
     * (2) texto em 2+ linhas; ou (3) vários blocos próximos que juntos passam de 30% da peça ({@link #partOfPrint}).
     */
    static boolean isPrint(boolean[] distinct, boolean[][] in, int[] label, int w, int h, int[] rect, ImageOps.Box gb, int minSide) {
        double cx = ((rect[0] + rect[2]) / 2.0 - gb.x()) / gb.w(), bw = (rect[2] - rect[0] + 1) / (double) gb.w();
        if (cx > 0.40 && cx < 0.60 && bw >= 0.18) {
            return true;
        }
        if (textLines(distinct, w, rect) >= 2) {
            return true;
        }
        return partOfPrint(distinct, in, label, w, h, rect, minSide);
    }

    /** Linhas de texto no bloco: faixas horizontais com pixels de marca separadas por vãos (entrelinha). */
    static int textLines(boolean[] distinct, int w, int[] rect) {
        int bh = rect[3] - rect[1] + 1, bw = rect[2] - rect[0] + 1;
        int[] rows = new int[bh];
        for (int y = rect[1]; y <= rect[3]; y++) {
            for (int x = rect[0]; x <= rect[2]; x++) {
                if (distinct[y * w + x]) {
                    rows[y - rect[1]]++;
                }
            }
        }
        int lines = 0, run = 0, minRun = Math.max(3, bh / 10);
        boolean inLine = false;
        for (int v : rows) {
            boolean on = v >= Math.max(2, bw * 0.06);
            if (on) {
                run++;
                if (!inLine && run >= minRun) {
                    lines++;
                    inLine = true;
                }
            } else {
                run = 0;
                inLine = false;
            }
        }
        return lines;
    }

    /**
     * Estampa × logo: um logo é uma marca isolada e pequena (bordado no peito, etiqueta, símbolo). Uma frase
     * ("THE BEST PLAN") ou um gráfico grande aparece como vários blocos de cor próximos que, juntos, ocupam boa parte
     * do peito. Aproxima os blocos (dilatação de ~3,5% da peça, que junta letras, palavras e linhas de uma frase) e
     * olha o grupo que contém a marca achada: se ele passa de 30% da peça ou reúne 3+ blocos do tamanho de uma
     * palavra, é estampa — fica intacta, sem foco extra nem foto de detalhe.
     */
    static boolean partOfPrint(boolean[] distinct, boolean[][] in, int[] label, int w, int h, int[] rect, int minSide) {
        if (rect == null) {
            return false;
        }
        int n = w * h, r = Math.max(2, (int) Math.round(minSide * 0.035));
        // dilatação separável (caixa r × r) restrita à peça
        boolean[] row = new boolean[n], grown = new boolean[n];
        for (int y = 0; y < h; y++) {
            int last = -100000;
            for (int x = 0; x < w; x++) {
                if (distinct[y * w + x]) {
                    last = x;
                }
                if (x - last <= r) {
                    row[y * w + x] = true;
                }
            }
            last = 100000;
            for (int x = w - 1; x >= 0; x--) {
                if (distinct[y * w + x]) {
                    last = x;
                }
                if (last - x <= r) {
                    row[y * w + x] = true;
                }
            }
        }
        for (int x = 0; x < w; x++) {
            int last = -100000;
            for (int y = 0; y < h; y++) {
                if (row[y * w + x]) {
                    last = y;
                }
                if (y - last <= r && in[y][x]) {
                    grown[y * w + x] = true;
                }
            }
            last = 100000;
            for (int y = h - 1; y >= 0; y--) {
                if (row[y * w + x]) {
                    last = y;
                }
                if (last - y <= r && in[y][x]) {
                    grown[y * w + x] = true;
                }
            }
        }
        int seed = -1;
        for (int y = rect[1]; y <= rect[3] && seed < 0; y++) {
            for (int x = rect[0]; x <= rect[2]; x++) {
                if (distinct[y * w + x] && grown[y * w + x]) {
                    seed = y * w + x;
                    break;
                }
            }
        }
        if (seed < 0) {
            return false;
        }
        boolean[] seen = new boolean[n];
        java.util.ArrayDeque<Integer> q = new java.util.ArrayDeque<>();
        q.add(seed);
        seen[seed] = true;
        int x0 = w, y0 = h, x1 = -1, y1 = -1;
        while (!q.isEmpty()) {
            int i = q.poll(), x = i % w, y = i / w;
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
            int[] nb = {x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w};
            for (int j : nb) {
                if (j >= 0 && j < n && grown[j] && !seen[j]) {
                    seen[j] = true;
                    q.add(j);
                }
            }
        }
        int size = Math.max(x1 - x0 + 1, y1 - y0 + 1);
        if (size > minSide * 0.30) {
            return true;
        }
        // blocos do tamanho de palavra dentro do grupo: os grupos do detector (letras de uma palavra já unidas)
        java.util.Map<Integer, int[]> boxes = new java.util.HashMap<>();
        for (int y = y0; y <= y1; y++) {
            for (int x = x0; x <= x1; x++) {
                int i = y * w + x;
                if (!seen[i] || label[i] == 0) {
                    continue;
                }
                int fx = x, fy = y;
                int[] b = boxes.computeIfAbsent(label[i], k -> new int[]{fx, fy, fx, fy});
                b[0] = Math.min(b[0], x);
                b[1] = Math.min(b[1], y);
                b[2] = Math.max(b[2], x);
                b[3] = Math.max(b[3], y);
            }
        }
        long words = boxes.values().stream().filter(b -> Math.max(b[2] - b[0] + 1, b[3] - b[1] + 1) >= minSide * 0.04).count();
        return words >= 3;
    }

    /**
     * Segundo detector: selo, patch bordado ou etiqueta sobre peça em color block (onde "cor diferente do entorno"
     * marca a peça inteira). Um logo concentra <b>contraste de luminância</b> numa área pequena e redonda — letras
     * claras sobre fundo escuro (ou o contrário), bordas de selo —, enquanto divisas de cor (cadarço, zíper, vivo,
     * bolso) mudam a cor mas pouco a luminância, e são linhas. Mede o desvio-padrão local da luminância e pega a
     * mancha compacta de maior desvio longe do contorno.
     */
    static Logo detectDetail(BufferedImage img, boolean[][] in, double[][] dist, ImageOps.Box gb, int minSide, int margin, float[] L) {
        int w = img.getWidth(), h = img.getHeight(), n = w * h;
        int r = Math.max(3, (int) (minSide * 0.025));
        float[] m1 = new float[n], m2 = new float[n], wt = new float[n];
        for (int i = 0; i < n; i++) {
            if (in[i / w][i % w]) {
                wt[i] = 1;
                m1[i] = L[i];
                m2[i] = L[i] * L[i];
            }
        }
        float[] bw = StudioPipeline.boxBlur(wt, w, h, r, 2), b1 = StudioPipeline.boxBlur(m1, w, h, r, 2), b2 = StudioPipeline.boxBlur(m2, w, h, r, 2);
        float[] sd = new float[n];
        double inner = margin * 0.6;
        float peak = 0;
        for (int i = 0; i < n; i++) {
            if (bw[i] < 0.95f || dist[i / w][i % w] <= inner) {
                continue;                                   // janela que pega a parede: o contorno não é logo
            }
            float mean = b1[i] / bw[i];
            sd[i] = (float) Math.sqrt(Math.max(0, b2[i] / bw[i] - mean * mean));
            peak = Math.max(peak, sd[i]);
        }
        if (peak < 14) {
            return null;                                    // peça lisa: nada de logo inventado
        }
        float t = Math.max(11f, peak * 0.55f);
        int[] label = new int[n];
        java.util.ArrayDeque<Integer> q = new java.util.ArrayDeque<>();
        double bestScore = 0;
        double[] bestBox = null;
        double printScore = 0;
        double[] printBox = null;
        int id = 0;
        for (int s0 = 0; s0 < n; s0++) {
            if (label[s0] != 0 || sd[s0] < t) {
                continue;
            }
            id++;
            int x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
            double sumSd = 0, sumX = 0, sumY = 0;
            q.add(s0);
            label[s0] = id;
            while (!q.isEmpty()) {
                int i = q.poll(), x = i % w, y = i / w;
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x);
                y1 = Math.max(y1, y);
                area++;
                sumSd += sd[i];
                sumX += x;
                sumY += y;
                int[] nb = {x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w};
                for (int j : nb) {
                    if (j >= 0 && j < n && label[j] == 0 && sd[j] >= t) {
                        label[j] = id;
                        q.add(j);
                    }
                }
            }
            int bw0 = x1 - x0 + 1, bh0 = y1 - y0 + 1, size = Math.max(bw0, bh0);
            double aspect = size / (double) Math.max(1, Math.min(bw0, bh0));
            double compact = area / (double) (bw0 * bh0);
            int cx = (int) Math.round(sumX / area), cy = (int) Math.round(sumY / area);
            if (size < minSide * 0.05 || size > minSide * 0.36 || aspect > 2.0 || compact < 0.5 || dist[cy][cx] <= margin) {
                continue;                                   // pontinho, área grande, linha (zíper, cadarço) ou borda
            }
            double score = (sumSd / area) / 10.0 * Math.sqrt(area) * compact * (1.0 / aspect);
            // a janela do desvio alarga a mancha em r px de cada lado: a caixa volta ao tamanho do selo
            double pad = Math.max(size * 0.06, minSide * 0.01) - r * 0.5;
            double[] box = {
                    clamp01((x0 - pad - gb.x()) / gb.w()), clamp01((y0 - pad - gb.y()) / gb.h()),
                    clamp01((x1 + pad - gb.x()) / gb.w()), clamp01((y1 + pad - gb.y()) / gb.h())};
            // estampa frontal (bloco largo no eixo do peito): fica de fora do logo, mas é registrada
            double bcx = (box[0] + box[2]) / 2, boxW = box[2] - box[0];
            if (bcx > 0.40 && bcx < 0.60 && boxW >= 0.18) {
                if (score > printScore) {
                    printScore = score;
                    printBox = box;
                }
                continue;
            }
            if (score > bestScore) {
                bestScore = score;
                bestBox = box;
            }
        }
        if (bestBox == null || bestScore < 20) {
            return printBox != null && printScore >= 20 ? new Logo(printBox, Math.min(0.75, 0.3 + printScore / 400), "local", true) : null;
        }
        return new Logo(bestBox, Math.min(0.75, 0.3 + bestScore / 400), "local");
    }

    private static int percentile(int[] hist, int total, double p) {
        long target = Math.round(total * p), acc = 0;
        for (int v = 0; v < hist.length; v++) {
            acc += hist[v];
            if (acc >= target) {
                return v;
            }
        }
        return hist.length - 1;
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
