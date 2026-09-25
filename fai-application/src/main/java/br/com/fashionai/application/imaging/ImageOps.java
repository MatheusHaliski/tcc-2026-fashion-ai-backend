package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.List;
import java.util.ArrayList;
import java.util.Deque;

/** Utilitários Java2D compartilhados pelos pipelines RF4 (Flat Lay), RF5/RF11 (card) e RF18 (provador). */
public final class ImageOps {
    public static final long MAX_UPLOAD_BYTES = 10L * 1024 * 1024;

    private ImageOps() {
    }

    /** RF4.CA01 / RN11: só JPG, PNG e WebP até 10 MB — pelo conteúdo (magic bytes), não pela extensão. */
    public static String detectMime(byte[] bytes) {
        if (bytes == null || bytes.length < 12) {
            return null;
        }
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if ((bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') {
            return "image/png";
        }
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    public static String requireAcceptedImage(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw ApiException.badRequest("ARQUIVO_VAZIO", Msg.t("imageOps.envie_uma_foto_da_peca"));
        }
        if (bytes.length > MAX_UPLOAD_BYTES) {
            throw ApiException.badRequest("ARQUIVO_GRANDE", Msg.t("imageOps.a_foto_tem_mais_de"));
        }
        String mime = detectMime(bytes);
        if (mime == null) {
            throw ApiException.badRequest("FORMATO_INVALIDO", Msg.t("imageOps.formato_nao_aceito_use_jpg"));
        }
        return mime;
    }

    public static BufferedImage decode(byte[] bytes) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
            if (img == null) {
                throw ApiException.badRequest("IMAGEM_ILEGIVEL", Msg.t("imageOps.nao_conseguimos_ler_a_imagem"));
            }
            return toArgb(img);
        } catch (IOException ex) {
            throw ApiException.badRequest("IMAGEM_ILEGIVEL", Msg.t("imageOps.nao_conseguimos_ler_a_imagem"));
        }
    }

    public static BufferedImage toArgb(BufferedImage src) {
        if (src.getType() == BufferedImage.TYPE_INT_ARGB) {
            return src;
        }
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    public static byte[] png(BufferedImage img) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
    }

    public static byte[] jpeg(BufferedImage img, float quality) {
        BufferedImage rgb = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, img.getWidth(), img.getHeight());
        g.drawImage(img, 0, 0, null);
        g.dispose();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.setOutput(ios);
            writer.write(null, new IIOImage(rgb, null, null), param);
            writer.dispose();
            ios.flush();
            return out.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** Recorte quadrado para avatar: centro na horizontal e terço superior na vertical (onde o rosto costuma estar). */
    public static BufferedImage centerSquare(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight(), side = Math.min(w, h);
        int x = (w - side) / 2, y = (int) Math.round((h - side) * 0.3);
        return img.getSubimage(x, y, side, side);
    }

    public static BufferedImage scaleToFit(BufferedImage img, int maxW, int maxH) {
        double s = Math.min(maxW / (double) img.getWidth(), maxH / (double) img.getHeight());
        if (s >= 1) {
            return img;
        }
        return scale(img, Math.max(1, (int) Math.round(img.getWidth() * s)), Math.max(1, (int) Math.round(img.getHeight() * s)));
    }

    public static BufferedImage scale(BufferedImage img, int w, int h) {
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        quality(g);
        g.drawImage(img, 0, 0, w, h, null);
        g.dispose();
        return out;
    }

    public static void quality(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    }

    /**
     * @param warning motivo legível quando o recorte local parece ter apagado parte da peça (fundo parecido com a peça);
     *                nesse caso a confiança fica abaixo de 0,45 e o RF4 mantém a foto original
     */
    public record Cutout(BufferedImage image, double coverage, double confidence, int backgroundRgb, String warning) {
        public Cutout(BufferedImage image, double coverage, double confidence, int backgroundRgb) {
            this(image, coverage, confidence, backgroundRgb, null);
        }
    }

    /**
     * Remoção de fundo local (plano B do RF4 quando rembg/remove.bg não respondem). Versão 2:
     * <ol>
     *   <li>modelo de fundo com até 3 tons de borda (k-means em Lab), para paredes com gradiente e luz irregular;</li>
     *   <li>tolerância adaptativa, derivada da variação real da borda, em vez de um valor fixo;</li>
     *   <li>crescimento que não atravessa bordas: o vizinho só entra se for parecido com o fundo <b>e</b> com o pixel de
     *       onde veio (uma peça creme numa parede bege ainda tem contorno, e ali o preenchimento para);</li>
     *   <li>sombra da peça no chão/parede (mesmo matiz, mais escura) também sai;</li>
     *   <li>limpeza: ficam o maior componente e os que têm ao menos 12% dele (par de sapatos); somem as manchas;</li>
     *   <li>autocrítica: se a forma que sobrou parece "partida" ({@link #looksBroken}), a confiança cai abaixo de 0,45 e o
     *       aviso explica o motivo — o RF4 mantém a foto original em vez de seguir com uma peça mutilada.</li>
     * </ol>
     */
    public static Cutout removeBackgroundLocal(BufferedImage src) {
        BufferedImage img = scaleToFit(src, 1600, 1600);
        int w = img.getWidth();
        int h = img.getHeight();
        int n = w * h;
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        float[] L = new float[n], A = new float[n], B = new float[n];
        for (int i = 0; i < n; i++) {
            double[] lab = br.com.fashionai.application.ai.local.ColorMath.lab(px[i]);
            L[i] = (float) lab[0];
            A[i] = (float) lab[1];
            B[i] = (float) lab[2];
        }
        // ruído de câmera de celular some antes de medir bordas (desfoque de caixa 2×, raio 1, só para a decisão)
        L = StudioPipeline.boxBlur(L, w, h, 1, 2);
        A = StudioPipeline.boxBlur(A, w, h, 1, 2);
        B = StudioPipeline.boxBlur(B, w, h, 1, 2);
        // 1) tons de fundo: k-means (k=3) sobre a borda — sem os lados que a peça atravessa (foto que cortou a barra
        // ou a manga): ali a "borda" é a própria peça e viraria cor de fundo, abrindo buracos nela
        int[] border = borderIndices(w, h);
        double[][] centers = kmeansLab(border, L, A, B, 3);
        border = cleanSides(border, w, h, L, A, B, centers[0]);
        centers = kmeansLab(border, L, A, B, 3);
        double[] borderDist = new double[border.length];
        for (int k = 0; k < border.length; k++) {
            borderDist[k] = nearest(centers, L[border[k]], A[border[k]], B[border[k]])[0];
        }
        double[] sorted = borderDist.clone();
        Arrays.sort(sorted);
        double p80 = sorted[(int) (sorted.length * 0.80)];
        // 2) tolerância adaptativa: fundo liso → rígida; fundo ruidoso → mais folga (limitada)
        double tol = Math.max(6.0, Math.min(15, p80 * 1.8 + 3.5));
        double stepTol = Math.max(2.2, Math.min(8, p80 * 0.9 + 1.6));
        boolean[] background = new boolean[n];
        Deque<Integer> queue = new ArrayDeque<>();
        // sementes: toda a borda (inclusive os lados ocupados) que tem a cor do fundo limpo
        for (int i : borderIndices(w, h)) {
            if (nearest(centers, L[i], A[i], B[i])[0] < tol || ((px[i] >>> 24) & 0xFF) < 16) {
                background[i] = true;
                queue.add(i);
            }
        }
        // 3–4) crescimento com barreira de borda + sombra
        int[] dx = {-1, 1, -w, w};
        while (!queue.isEmpty()) {
            int i = queue.poll();
            int x = i % w;
            for (int d = 0; d < 4; d++) {
                if ((d == 0 && x == 0) || (d == 1 && x == w - 1)) {
                    continue;
                }
                int j = i + dx[d];
                if (j < 0 || j >= n || background[j]) {
                    continue;
                }
                if (((px[j] >>> 24) & 0xFF) < 16) {
                    background[j] = true;
                    queue.add(j);
                    continue;
                }
                double step = Math.sqrt(sq(L[i] - L[j]) + sq(A[i] - A[j]) + sq(B[i] - B[j]));
                if (step >= stepTol) {
                    continue;
                }
                double[] near = nearest(centers, L[j], A[j], B[j]);
                double[] c = centers[(int) near[1]];
                boolean like = near[0] < tol;
                double chroma = Math.sqrt(sq(A[j] - c[1]) + sq(B[j] - c[2]));
                boolean shadow = L[j] < c[0] - 2 && L[j] > c[0] - 32 && chroma < 7;
                if (like || shadow) {
                    background[j] = true;
                    queue.add(j);
                }
            }
        }
        // 5) limpeza por componentes conexos do primeiro plano
        keepMainComponents(background, w, h, 0.12);
        int fg = 0;
        double contrast = 0;
        for (int i = 0; i < n; i++) {
            if (background[i]) {
                px[i] = px[i] & 0x00FFFFFF;
            } else {
                fg++;
                contrast += Math.min(60, nearest(centers, L[i], A[i], B[i])[0]);
            }
        }
        feather(px, background, w, h);
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        double coverage = fg / (double) n;
        double avgContrast = fg == 0 ? 0 : contrast / fg / 60.0;
        // contraste baixo com o fundo não é, sozinho, sinal de erro (creme sobre bege com contorno): quem decide é a forma
        double confidence = coverage < 0.02 || coverage > 0.97 ? 0.2 : Math.min(0.95, 0.5 + Math.min(1, avgContrast * 1.5) * 0.45);
        // 6) autocrítica: o preenchimento entrou na peça? (creme numa parede bege, branco em fundo branco)
        double[] shape = shapeStats(background, w, h);
        String warning = null;
        if (fg > 0 && looksBroken(shape)) {
            confidence = Math.min(confidence, 0.3);
            warning = Msg.t("imageOps.o_fundo_parece_ter_a", String.format(java.util.Locale.ROOT, "%.2f", shape[0]),
                    String.format(java.util.Locale.ROOT, "%.2f", shape[2]), String.valueOf((int) shape[3]), String.format(java.util.Locale.ROOT, "%.0f", shape[1] * 100));
        }
        return new Cutout(out, coverage, confidence, borderMedian(px, w, h), warning);
    }

    /**
     * [solidez, fração removida no centro, solidez do conjunto, pedaços grandes]. Solidez = área do primeiro plano ÷ área do seu fecho convexo (cada componente
     * grande tem o seu fecho, então um par de sapatos separado não é penalizado). Fração removida no centro = fundo dentro
     * da caixa central (40–60% da largura e altura do objeto) — uma peça fotografada quase nunca tem o miolo vazio.
     */
    static double[] shapeStats(boolean[] background, int w, int h) {
        int n = w * h;
        int[] label = new int[n];
        List<int[]> comps = new ArrayList<>(); // {área, minX, maxX, minY, maxY}
        List<List<int[]>> spans = new ArrayList<>();
        int[] stack = new int[n];
        for (int s0 = 0; s0 < n; s0++) {
            if (background[s0] || label[s0] != 0) {
                continue;
            }
            int id = comps.size() + 1, top = 0;
            int[] c = {0, Integer.MAX_VALUE, -1, Integer.MAX_VALUE, -1};
            stack[top++] = s0;
            label[s0] = id;
            while (top > 0) {
                int i = stack[--top];
                int x = i % w, y = i / w;
                c[0]++;
                c[1] = Math.min(c[1], x);
                c[2] = Math.max(c[2], x);
                c[3] = Math.min(c[3], y);
                c[4] = Math.max(c[4], y);
                int[] nb = {x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w};
                for (int j : nb) {
                    if (j >= 0 && j < n && !background[j] && label[j] == 0) {
                        label[j] = id;
                        stack[top++] = j;
                    }
                }
            }
            comps.add(c);
        }
        if (comps.isEmpty()) {
            return new double[]{0, 1, 0, 0};
        }
        // extremos por linha de cada componente → fecho convexo (cadeia monótona) → área (fórmula do laço)
        int k = comps.size();
        int[][] rowMin = new int[k][], rowMax = new int[k][];
        for (int c = 0; c < k; c++) {
            int[] cc = comps.get(c);
            rowMin[c] = new int[cc[4] - cc[3] + 1];
            rowMax[c] = new int[cc[4] - cc[3] + 1];
            Arrays.fill(rowMin[c], Integer.MAX_VALUE);
            Arrays.fill(rowMax[c], -1);
        }
        int minX = w, maxX = -1, minY = h, maxY = -1;
        for (int i = 0; i < n; i++) {
            if (label[i] == 0) {
                continue;
            }
            int c = label[i] - 1, x = i % w, y = i / w, r = y - comps.get(c)[3];
            rowMin[c][r] = Math.min(rowMin[c][r], x);
            rowMax[c][r] = Math.max(rowMax[c][r], x);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        double area = 0, hull = 0;
        int biggest = 0;
        for (int[] cc : comps) {
            biggest = Math.max(biggest, cc[0]);
        }
        int large = 0;
        List<long[]> all = new ArrayList<>();
        for (int c = 0; c < k; c++) {
            int[] cc = comps.get(c);
            if (cc[0] < 64) {
                continue;
            }
            if (cc[0] >= biggest * 0.25) {
                large++;
            }
            List<long[]> pts = new ArrayList<>();
            for (int r = 0; r < rowMin[c].length; r++) {
                if (rowMax[c][r] >= 0) {
                    pts.add(new long[]{rowMin[c][r], cc[3] + r});
                    pts.add(new long[]{rowMax[c][r] + 1, cc[3] + r});
                    pts.add(new long[]{rowMin[c][r], cc[3] + r + 1});
                    pts.add(new long[]{rowMax[c][r] + 1, cc[3] + r + 1});
                }
            }
            all.addAll(pts);
            area += cc[0];
            hull += hullArea(pts);
        }
        double unionHull = hullArea(all);
        double solidity = hull <= 0 ? 0 : Math.min(1, area / hull);
        int bw = maxX - minX + 1, bh = maxY - minY + 1, removed = 0, total = 0;
        for (int y = minY + (int) (bh * 0.4); y <= minY + (int) (bh * 0.6); y++) {
            for (int x = minX + (int) (bw * 0.4); x <= minX + (int) (bw * 0.6); x++) {
                total++;
                if (background[y * w + x]) {
                    removed++;
                }
            }
        }
        return new double[]{solidity, total == 0 ? 1 : removed / (double) total,
                unionHull <= 0 ? 0 : Math.min(1, area / unionHull), large};
    }

    /**
     * Recorte com buracos: pouco sólido; miolo vazio com solidez apenas média; ou a peça "partida" em pedaços grandes
     * com muito vazio entre eles (o preenchimento atravessou a peça). Um par de sapatos lado a lado continua passando;
     * se não passar, a interface oferece "usar mesmo assim".
     */
    static boolean looksBroken(double[] shape) {
        return shape[0] < 0.62 || (shape[1] > 0.45 && shape[0] < 0.8) || (shape[3] >= 2 && shape[2] < 0.78);
    }

    private static double hullArea(List<long[]> pts) {
        pts.sort((a, b) -> a[0] != b[0] ? Long.compare(a[0], b[0]) : Long.compare(a[1], b[1]));
        int m = pts.size();
        if (m < 3) {
            return 0;
        }
        long[][] hull = new long[2 * m][];
        int t = 0;
        for (int i = 0; i < m; i++) {
            while (t >= 2 && cross(hull[t - 2], hull[t - 1], pts.get(i)) <= 0) {
                t--;
            }
            hull[t++] = pts.get(i);
        }
        for (int i = m - 2, lower = t + 1; i >= 0; i--) {
            while (t >= lower && cross(hull[t - 2], hull[t - 1], pts.get(i)) <= 0) {
                t--;
            }
            hull[t++] = pts.get(i);
        }
        double a = 0;
        for (int i = 0; i < t - 1; i++) {
            a += hull[i][0] * hull[i + 1][1] - hull[i + 1][0] * hull[i][1];
        }
        return Math.abs(a) / 2;
    }

    private static long cross(long[] o, long[] a, long[] b) {
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    }

    /**
     * Borda sem os lados "ocupados": um lado com menos de 55% dos pixels perto do tom dominante da borda é peça
     * atravessando a foto. Sobra pelo menos um lado (o mais limpo) para o modelo de fundo.
     */
    static int[] cleanSides(int[] border, int w, int h, float[] L, float[] A, float[] B, double[] wall) {
        int[][] sides = {new int[w], new int[w], new int[h], new int[h]};
        for (int x = 0; x < w; x++) {
            sides[0][x] = x;
            sides[1][x] = (h - 1) * w + x;
        }
        for (int y = 0; y < h; y++) {
            sides[2][y] = y * w;
            sides[3][y] = y * w + w - 1;
        }
        double[] share = new double[4];
        for (int s = 0; s < 4; s++) {
            int near = 0;
            for (int i : sides[s]) {
                if (Math.sqrt(sq(L[i] - wall[0]) + sq(A[i] - wall[1]) + sq(B[i] - wall[2])) < 12) {
                    near++;
                }
            }
            share[s] = near / (double) sides[s].length;
        }
        int best = 0;
        for (int s = 1; s < 4; s++) {
            if (share[s] > share[best]) {
                best = s;
            }
        }
        java.util.List<Integer> keep = new java.util.ArrayList<>();
        for (int s = 0; s < 4; s++) {
            if (share[s] >= 0.55 || s == best) {
                for (int i : sides[s]) {
                    keep.add(i);
                }
            }
        }
        if (keep.size() == border.length) {
            return border;
        }
        return keep.stream().mapToInt(Integer::intValue).distinct().toArray();
    }

    private static double sq(double v) {
        return v * v;
    }

    private static int[] borderIndices(int w, int h) {
        int[] out = new int[2 * w + 2 * (h - 2)];
        int k = 0;
        for (int x = 0; x < w; x++) {
            out[k++] = x;
            out[k++] = (h - 1) * w + x;
        }
        for (int y = 1; y < h - 1; y++) {
            out[k++] = y * w;
            out[k++] = y * w + w - 1;
        }
        return out;
    }

    /** k-means simples em Lab; centros ordenados pelo tamanho do grupo (o 1º é o tom de fundo dominante). */
    static double[][] kmeansLab(int[] idx, float[] L, float[] A, float[] B, int k) {
        double[][] c = new double[k][3];
        for (int j = 0; j < k; j++) {
            int i = idx[(int) ((long) j * (idx.length - 1) / Math.max(1, k - 1))];
            c[j] = new double[]{L[i], A[i], B[i]};
        }
        int[] count = new int[k];
        for (int it = 0; it < 12; it++) {
            double[][] sum = new double[k][3];
            Arrays.fill(count, 0);
            for (int i : idx) {
                int best = (int) nearest(c, L[i], A[i], B[i])[1];
                sum[best][0] += L[i];
                sum[best][1] += A[i];
                sum[best][2] += B[i];
                count[best]++;
            }
            for (int j = 0; j < k; j++) {
                if (count[j] > 0) {
                    c[j] = new double[]{sum[j][0] / count[j], sum[j][1] / count[j], sum[j][2] / count[j]};
                }
            }
        }
        // grupos com menos de 4% da borda costumam ser a própria peça tocando a borda: descartados do modelo
        List<double[]> keep = new ArrayList<>();
        Integer[] order = new Integer[k];
        for (int j = 0; j < k; j++) {
            order[j] = j;
        }
        final int[] cnt = count;
        Arrays.sort(order, (x, y) -> Integer.compare(cnt[y], cnt[x]));
        for (int j : order) {
            if (cnt[j] >= idx.length * 0.04 || keep.isEmpty()) {
                keep.add(c[j]);
            }
        }
        return keep.toArray(new double[0][]);
    }

    /** [distância ao centro mais próximo, índice do centro]. */
    static double[] nearest(double[][] c, double l, double a, double b) {
        double best = Double.MAX_VALUE;
        int bi = 0;
        for (int j = 0; j < c.length; j++) {
            double d = sq(c[j][0] - l) + sq(c[j][1] - a) + sq(c[j][2] - b);
            if (d < best) {
                best = d;
                bi = j;
            }
        }
        return new double[]{Math.sqrt(best), bi};
    }

    /** Mantém o maior componente de primeiro plano e os que têm ao menos {@code minShare} dele; o resto vira fundo. */
    static void keepMainComponents(boolean[] background, int w, int h, double minShare) {
        int n = w * h;
        int[] label = new int[n];
        List<Integer> sizes = new ArrayList<>();
        sizes.add(0);
        int[] stack = new int[n];
        for (int s0 = 0; s0 < n; s0++) {
            if (background[s0] || label[s0] != 0) {
                continue;
            }
            int id = sizes.size(), top = 0, size = 0;
            stack[top++] = s0;
            label[s0] = id;
            while (top > 0) {
                int i = stack[--top];
                size++;
                int x = i % w;
                int[] nb = {x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w};
                for (int j : nb) {
                    if (j >= 0 && j < n && !background[j] && label[j] == 0) {
                        label[j] = id;
                        stack[top++] = j;
                    }
                }
            }
            sizes.add(size);
        }
        int max = 0;
        for (int sz : sizes) {
            max = Math.max(max, sz);
        }
        for (int i = 0; i < n; i++) {
            if (!background[i] && sizes.get(label[i]) < max * minShare) {
                background[i] = true;
            }
        }
    }

    private static void feather(int[] px, boolean[] background, int w, int h) {
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int i = y * w + x;
                if (background[i]) {
                    continue;
                }
                int bgNeighbors = (background[i - 1] ? 1 : 0) + (background[i + 1] ? 1 : 0) + (background[i - w] ? 1 : 0)
                        + (background[i + w] ? 1 : 0);
                if (bgNeighbors > 0) {
                    int alpha = 255 - bgNeighbors * 45;
                    px[i] = (alpha << 24) | (px[i] & 0x00FFFFFF);
                }
            }
        }
    }

    private static double labDistance(double[] lab, int rgb) {
        double[] l = br.com.fashionai.application.ai.local.ColorMath.lab(rgb);
        return Math.sqrt(Math.pow(lab[0] - l[0], 2) + Math.pow(lab[1] - l[1], 2) + Math.pow(lab[2] - l[2], 2));
    }

    private static int borderMedian(int[] px, int w, int h) {
        int n = 2 * w + 2 * h;
        int[] r = new int[n];
        int[] g = new int[n];
        int[] b = new int[n];
        int k = 0;
        for (int x = 0; x < w; x++) {
            for (int p : new int[]{px[x], px[(h - 1) * w + x]}) {
                r[k] = (p >> 16) & 0xFF;
                g[k] = (p >> 8) & 0xFF;
                b[k++] = p & 0xFF;
            }
        }
        for (int y = 0; y < h; y++) {
            for (int p : new int[]{px[y * w], px[y * w + w - 1]}) {
                r[k] = (p >> 16) & 0xFF;
                g[k] = (p >> 8) & 0xFF;
                b[k++] = p & 0xFF;
            }
        }
        Arrays.sort(r, 0, k);
        Arrays.sort(g, 0, k);
        Arrays.sort(b, 0, k);
        return (r[k / 2] << 16) | (g[k / 2] << 8) | b[k / 2];
    }

    public record Box(int x, int y, int w, int h) {
        public boolean empty() {
            return w <= 0 || h <= 0;
        }
    }

    public static Box alphaBounds(BufferedImage img) {
        int w = img.getWidth();
        int h = img.getHeight();
        int minX = w;
        int minY = h;
        int maxX = -1;
        int maxY = -1;
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (((px[y * w + x] >>> 24) & 0xFF) > 24) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }
        return maxX < 0 ? new Box(0, 0, 0, 0) : new Box(minX, minY, maxX - minX + 1, maxY - minY + 1);
    }

    /** Ângulo principal (graus) da máscara pela PCA das coordenadas do primeiro plano — base do deskew. */
    public static double principalAngle(BufferedImage img) {
        return principalAxis(img)[0];
    }

    /**
     * [ângulo (graus), alongamento]. Alongamento = razão entre os desvios nos eixos principal e secundário (√ dos
     * autovalores). Perto de 1 (jaqueta com mangas, bolsa quadrada) o "eixo" é ruído e não serve para corrigir inclinação.
     */
    public static double[] principalAxis(BufferedImage img) {
        int w = img.getWidth();
        int h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        double sx = 0;
        double sy = 0;
        long n = 0;
        for (int y = 0; y < h; y += 2) {
            for (int x = 0; x < w; x += 2) {
                if (((px[y * w + x] >>> 24) & 0xFF) > 128) {
                    sx += x;
                    sy += y;
                    n++;
                }
            }
        }
        if (n < 50) {
            return new double[]{0, 1};
        }
        double mx = sx / n;
        double my = sy / n;
        double cxx = 0;
        double cyy = 0;
        double cxy = 0;
        for (int y = 0; y < h; y += 2) {
            for (int x = 0; x < w; x += 2) {
                if (((px[y * w + x] >>> 24) & 0xFF) > 128) {
                    double dx = x - mx;
                    double dy = y - my;
                    cxx += dx * dx;
                    cyy += dy * dy;
                    cxy += dx * dy;
                }
            }
        }
        double tr = cxx + cyy, det = cxx * cyy - cxy * cxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
        double l1 = tr / 2 + disc, l2 = Math.max(1e-9, tr / 2 - disc);
        return new double[]{Math.toDegrees(0.5 * Math.atan2(2 * cxy, cxx - cyy)), Math.sqrt(l1 / l2)};
    }

    /** Alongamento mínimo para confiar no eixo principal (calça, cachecol, tênis de perfil passam; jaqueta aberta não). */
    public static final double DESKEW_MIN_ELONGATION = 1.35;

    /** Correção de inclinação: alinha o eixo principal ao eixo mais próximo (0° ou 90°) quando 3° < desvio < 25°. */
    public static double deskewAngle(double principal) {
        double nearest = Math.round(principal / 90.0) * 90.0;
        double deviation = principal - nearest;
        return Math.abs(deviation) > 3 && Math.abs(deviation) < 25 ? -deviation : 0;
    }

    public static BufferedImage rotate(BufferedImage img, double degrees) {
        if (degrees == 0) {
            return img;
        }
        double rad = Math.toRadians(degrees);
        double sin = Math.abs(Math.sin(rad));
        double cos = Math.abs(Math.cos(rad));
        int w = img.getWidth();
        int h = img.getHeight();
        int nw = (int) Math.floor(w * cos + h * sin);
        int nh = (int) Math.floor(h * cos + w * sin);
        BufferedImage out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        quality(g);
        AffineTransform at = new AffineTransform();
        at.translate((nw - w) / 2.0, (nh - h) / 2.0);
        at.rotate(rad, w / 2.0, h / 2.0);
        g.drawRenderedImage(img, at);
        g.dispose();
        return out;
    }

    public static BufferedImage crop(BufferedImage img, Box box) {
        if (box.empty()) {
            return img;
        }
        return img.getSubimage(box.x(), box.y(), box.w(), box.h());
    }

    /** Composição Flat Lay: centraliza no canvas quadrado com margem, fundo transparente ou sólido, sombra suave. */
    public static BufferedImage composeCentered(BufferedImage cutout, int size, double padding, Color background,
                                                boolean shadow) {
        BufferedImage canvas = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        quality(g);
        if (background != null) {
            g.setColor(background);
            g.fillRect(0, 0, size, size);
        }
        int inner = (int) Math.round(size * (1 - 2 * padding));
        double s = Math.min(inner / (double) cutout.getWidth(), inner / (double) cutout.getHeight());
        int w = (int) Math.round(cutout.getWidth() * s);
        int h = (int) Math.round(cutout.getHeight() * s);
        int x = (size - w) / 2;
        int y = (size - h) / 2;
        if (shadow) {
            BufferedImage sh = ImageFilters.shadowOf(scale(cutout, w, h), 0.22f, 10);
            g.drawImage(sh, x + 6, y + 10, null);
        }
        g.setComposite(AlphaComposite.SrcOver);
        g.drawImage(cutout, x, y, w, h, null);
        g.dispose();
        return canvas;
    }

    public static int[] foregroundPixels(BufferedImage img, int step) {
        int w = img.getWidth();
        int h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        int count = 0;
        int[] out = new int[(w / step + 1) * (h / step + 1)];
        for (int y = 0; y < h; y += step) {
            for (int x = 0; x < w; x += step) {
                int p = px[y * w + x];
                if (((p >>> 24) & 0xFF) > 128) {
                    out[count++] = p & 0xFFFFFF;
                }
            }
        }
        return Arrays.copyOf(out, count);
    }
}
