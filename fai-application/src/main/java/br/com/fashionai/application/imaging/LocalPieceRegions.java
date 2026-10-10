package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * Propostas de região para peças separadas sobre uma superfície (grade de catálogo, roupas na cama ou no chão), sem
 * classificador de roupa: só o que se mede na foto.
 * <ol>
 *   <li>Fundo pela borda: cor mediana e espalhamento robusto (90º percentil da distância à mediana) — uma cama com
 *       dobras ou um piso com textura dá um limiar maior; um fundo de estúdio, o limiar mínimo.</li>
 *   <li>Agrupamento de cores (k-means, {@value #CLUSTERS} cores): cada cor vira uma máscara; abertura (tira fios e
 *       sombras finas), fechamento (fecha furos de estampa) e componentes conexos → caixas. A decisão de fundo é por
 *       componente, não por cor: o que encosta em dois lados da foto, ou cobre quase tudo, é a cama/o piso/um móvel —
 *       uma camiseta preta não some porque a mesa de cabeceira também é escura.</li>
 *   <li>Uma peça com luz e sombra cai em duas cores: componentes vizinhos de cores próximas se fundem; a estampa dentro
 *       da peça (caixa contida) fica na peça.</li>
 *   <li>Mais de {@link #MAX_REGIONS} peças: ficam as maiores, em ordem de leitura. Cor dominante por região
 *       ({@link PixelStats}), não a média da foto.</li>
 * </ol>
 * Com uma região só, o limiar global de fundo e a segmentação por grafo ({@link FabricRegionGraph}) dão a segunda e a
 * terceira opinião. Tudo em até 480 px; nenhuma contagem ou arranjo de peças é presumido.
 */
public final class LocalPieceRegions {
    private LocalPieceRegions() {
    }

    public static final int MAX_REGIONS = 16;
    /** cores do agrupamento: cama com luz/sombra/dobra (3) + até 6 peças de cores distintas */
    static final int CLUSTERS = 9;
    static final double MIN_AREA = 0.01, MAX_AREA = 0.75, MIN_SIDE = 0.05, MIN_FILL = 0.2;
    /** cor a esta distância (RGB) da cor da borda é "família do fundo" (sombra, dobra), não uma peça */
    static final double BACKGROUND_FAMILY = 32;

    public record Region(double x, double y, double width, double height, int rgb) {
    }

    public static List<Region> detect(BufferedImage photo) {
        BufferedImage img = ImageOps.scaleToFit(photo, 480, 480);
        int w = img.getWidth(), h = img.getHeight();
        int[] pixels = img.getRGB(0, 0, w, h, null, 0, w);
        // as duas leituras; fica a que separou mais peças (grade de catálogo: o limiar; cama com dobras: as cores);
        // em empate, o limiar (a leitura mais conservadora)
        List<Region> clustered = byClusters(pixels, w, h);
        List<Region> thresholded = byBackground(img, pixels, w, h);
        return thresholded.size() >= clustered.size() ? thresholded : clustered;
    }

    /** Agrupamento de cores → máscara por cor → componentes; fundo decidido por componente (bordas e área). */
    static List<Region> byClusters(int[] pixels, int w, int h) {
        int size = w * h;
        int[] assign = new int[size];
        int[] centers = kmeans(pixels, CLUSTERS, assign);
        int background = borderMedian(pixels, w, h);
        List<Region> out = new ArrayList<>();
        List<Integer> areas = new ArrayList<>();
        for (int c = 0; c < centers.length; c++) {
            // uma mancha da cor do fundo (sombra, dobra, lado da cama) não é peça — a cama tem a cor da borda
            if (PixelStats.distance(centers[c], background) <= BACKGROUND_FAMILY) {
                continue;
            }
            boolean[] mask = new boolean[size];
            boolean any = false;
            for (int i = 0; i < size; i++) {
                mask[i] = assign[i] == c && (pixels[i] >>> 24) >= 40;
                any |= mask[i];
            }
            if (!any) {
                continue;
            }
            mask = erode(dilate(erode(mask, w, h), w, h), w, h);
            mask = erode(erode(dilate(dilate(mask, w, h), w, h), w, h), w, h);
            components(pixels, mask, w, h, 0.008, out, areas);
        }
        for (int i = out.size() - 1; i >= 0; i--) {
            if (PixelStats.distance(out.get(i).rgb(), background) <= BACKGROUND_FAMILY) {
                out.remove(i);
                areas.remove(i);
            }
        }
        merge(out, areas, w, h);
        return finish(out, areas);
    }

    /** Cor mediana da borda da imagem (por canal): a cor do fundo/da superfície. */
    static int borderMedian(int[] pixels, int w, int h) {
        int n = 2 * w + 2 * h;
        int[][] channels = new int[3][n];
        int k = 0;
        for (int x = 0; x < w; x++) {
            for (int p : new int[]{pixels[x], pixels[(h - 1) * w + x]}) {
                for (int c = 0; c < 3; c++) {
                    channels[c][k] = (p >> (16 - 8 * c)) & 255;
                }
                k++;
            }
        }
        for (int y = 0; y < h; y++) {
            for (int p : new int[]{pixels[y * w], pixels[y * w + w - 1]}) {
                for (int c = 0; c < 3; c++) {
                    channels[c][k] = (p >> (16 - 8 * c)) & 255;
                }
                k++;
            }
        }
        for (int[] channel : channels) {
            Arrays.sort(channel);
        }
        return (channels[0][n / 2] << 16) | (channels[1][n / 2] << 8) | channels[2][n / 2];
    }

    /** Pixels longe da cor mediana da borda (limiar pelo espalhamento da própria borda): a segunda opinião. */
    static List<Region> byBackground(BufferedImage img, int[] pixels, int w, int h) {
        int size = w * h;
        int[] border = new int[2 * w + 2 * h];
        int n = 0, transparent = 0;
        for (int x = 0; x < w; x++) {
            border[n++] = pixels[x];
            border[n++] = pixels[(h - 1) * w + x];
        }
        for (int y = 0; y < h; y++) {
            border[n++] = pixels[y * w];
            border[n++] = pixels[y * w + w - 1];
        }
        int[][] channels = new int[3][n];
        for (int i = 0; i < n; i++) {
            if ((border[i] >>> 24) < 40) {
                transparent++;
            }
            for (int c = 0; c < 3; c++) {
                channels[c][i] = (border[i] >> (16 - 8 * c)) & 255;
            }
        }
        for (int[] channel : channels) {
            Arrays.sort(channel);
        }
        int background = (channels[0][n / 2] << 16) | (channels[1][n / 2] << 8) | channels[2][n / 2];
        boolean alpha = transparent > n * 0.8;
        double[] spread = new double[n];
        for (int i = 0; i < n; i++) {
            spread[i] = PixelStats.distance(border[i], background);
        }
        Arrays.sort(spread);
        double threshold = Math.max(42, Math.min(96, spread[(int) (n * 0.9)] * 1.3 + 12));

        boolean[] fg = new boolean[size];
        for (int i = 0; i < size; i++) {
            fg[i] = (pixels[i] >>> 24) >= 40 && (alpha || PixelStats.distance(pixels[i], background) > threshold);
        }
        fg = erode(dilate(erode(fg, w, h), w, h), w, h);          // abertura
        fg = erode(erode(dilate(dilate(fg, w, h), w, h), w, h), w, h); // fechamento
        List<Region> out = new ArrayList<>();
        List<Integer> areas = new ArrayList<>();
        components(pixels, fg, w, h, MIN_AREA, out, areas);
        List<Region> done = finish(out, areas);
        if (!alpha && done.size() <= 1) {
            List<Region> segmented = FabricRegionGraph.detect(img);
            if (segmented.size() > done.size()) {
                return segmented;
            }
        }
        return done;
    }

    /** Componentes conexos (8 vizinhos) da máscara → regiões; restos de fundo, móveis na borda e fiapos não viram peça. */
    static void components(int[] pixels, boolean[] fg, int w, int h, double minArea, List<Region> out, List<Integer> areas) {
        int size = w * h;
        boolean[] seen = new boolean[size];
        int[] queue = new int[size];
        for (int i = 0; i < size; i++) {
            if (seen[i] || !fg[i]) {
                continue;
            }
            int head = 0, tail = 1, minX = w, maxX = 0, minY = h, maxY = 0;
            queue[0] = i;
            seen[i] = true;
            while (head < tail) {
                int p = queue[head++], x = p % w, y = p / w;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = x + dx, ny = y + dy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
                            continue;
                        }
                        int next = ny * w + nx;
                        if (!seen[next] && fg[next]) {
                            seen[next] = true;
                            queue[tail++] = next;
                        }
                    }
                }
            }
            int bw = maxX - minX + 1, bh = maxY - minY + 1;
            int sides = (minX == 0 ? 1 : 0) + (minY == 0 ? 1 : 0) + (maxX == w - 1 ? 1 : 0) + (maxY == h - 1 ? 1 : 0);
            // encostado numa borda e esticado ao longo dela (cabeceira, lateral da cama, piso): fundo, não peça
            boolean strip = sides == 1 && (((minX == 0 || maxX == w - 1) && bh > h * 0.40) || ((minY == 0 || maxY == h - 1) && bw > w * 0.40));
            if (tail < size * minArea || tail > size * MAX_AREA || sides >= 2 || strip || (sides == 1 && tail > size * 0.15)
                    || bw < w * MIN_SIDE || bh < h * MIN_SIDE || tail < bw * bh * (sides == 1 ? 0.35 : MIN_FILL)) {
                continue;
            }
            out.add(new Region(100.0 * minX / w, 100.0 * minY / h, 100.0 * bw / w, 100.0 * bh / h, PixelStats.dominant(pixels, queue, tail)));
            areas.add(tail);
        }
    }

    /**
     * Uma peça com luz e sombra cai em duas cores vizinhas: funde regiões de cores próximas (≤ 28, menos que a distância
     * entre duas peças de cores parecidas) que se tocam (folga de 0,8 % da foto). Uma caixa quase contida em outra
     * (estampa, etiqueta, gola de outra cor) fica na maior.
     */
    static void merge(List<Region> out, List<Integer> areas, int w, int h) {
        boolean changed = true;
        while (changed) {
            changed = false;
            for (int i = 0; i < out.size() && !changed; i++) {
                for (int j = i + 1; j < out.size(); j++) {
                    Region a = out.get(i), b = out.get(j);
                    double inter = overlap(a, b);
                    boolean nested = inter >= 0.6 * Math.min(a.width() * a.height(), b.width() * b.height());
                    boolean touching = PixelStats.distance(a.rgb(), b.rgb()) <= 28 && overlap(grow(a, 0.8), grow(b, 0.8)) > 0;
                    if (nested || touching) {
                        boolean keepA = areas.get(i) >= areas.get(j);
                        Region big = keepA ? a : b;
                        double x0 = Math.min(a.x(), b.x()), y0 = Math.min(a.y(), b.y());
                        double x1 = Math.max(a.x() + a.width(), b.x() + b.width()), y1 = Math.max(a.y() + a.height(), b.y() + b.height());
                        Region joined = nested ? big : new Region(x0, y0, x1 - x0, y1 - y0, big.rgb());
                        int area = nested ? Math.max(areas.get(i), areas.get(j)) : areas.get(i) + areas.get(j);
                        out.set(i, joined);
                        areas.set(i, area);
                        out.remove(j);
                        areas.remove(j);
                        changed = true;
                        break;
                    }
                }
            }
        }
    }

    private static double overlap(Region a, Region b) {
        double x0 = Math.max(a.x(), b.x()), y0 = Math.max(a.y(), b.y());
        double x1 = Math.min(a.x() + a.width(), b.x() + b.width()), y1 = Math.min(a.y() + a.height(), b.y() + b.height());
        return x1 <= x0 || y1 <= y0 ? 0 : (x1 - x0) * (y1 - y0);
    }

    private static Region grow(Region r, double pct) {
        return new Region(r.x() - pct, r.y() - pct, r.width() + 2 * pct, r.height() + 2 * pct, r.rgb());
    }

    /** Teto de peças (as maiores) e ordem de leitura. */
    static List<Region> finish(List<Region> out, List<Integer> areas) {
        if (out.size() > MAX_REGIONS) {
            Integer[] order = new Integer[out.size()];
            for (int i = 0; i < order.length; i++) {
                order[i] = i;
            }
            Arrays.sort(order, (a, b) -> Integer.compare(areas.get(b), areas.get(a)));
            List<Region> largest = new ArrayList<>();
            for (int i = 0; i < MAX_REGIONS; i++) {
                largest.add(out.get(order[i]));
            }
            out = largest;
        }
        // ordem de leitura (linhas de ~12 % da altura, depois da esquerda para a direita): o slot n é a n-ésima peça da foto
        out.sort(Comparator.comparingInt((Region r) -> (int) ((r.y() + r.height() / 2) / 12)).thenComparingDouble(Region::x));
        return List.copyOf(out);
    }

    /** k-means RGB determinístico (sementes por amostragem do ponto mais distante); devolve os centros e preenche {@code assign}. */
    static int[] kmeans(int[] pixels, int k, int[] assign) {
        int n = pixels.length;
        double[][] c = new double[k][3];
        int[] cand = new int[Math.min(n, 4096)];
        for (int i = 0; i < cand.length; i++) {
            cand[i] = pixels[(int) ((long) i * n / cand.length)];
        }
        c[0] = rgb(cand[0]);
        for (int j = 1; j < k; j++) {                                   // a amostra mais longe de todos os centros já escolhidos
            double best = -1;
            int bestP = cand[0];
            for (int p : cand) {
                double d = Double.MAX_VALUE;
                for (int q = 0; q < j; q++) {
                    d = Math.min(d, dist2(p, c[q]));
                }
                if (d > best) {
                    best = d;
                    bestP = p;
                }
            }
            c[j] = rgb(bestP);
        }
        for (int iter = 0; iter < 10; iter++) {
            double[][] sum = new double[k][3];
            int[] count = new int[k];
            for (int i = 0; i < n; i++) {
                int best = 0;
                double bd = Double.MAX_VALUE;
                for (int j = 0; j < k; j++) {
                    double d = dist2(pixels[i], c[j]);
                    if (d < bd) {
                        bd = d;
                        best = j;
                    }
                }
                assign[i] = best;
                double[] v = rgb(pixels[i]);
                sum[best][0] += v[0];
                sum[best][1] += v[1];
                sum[best][2] += v[2];
                count[best]++;
            }
            for (int j = 0; j < k; j++) {
                if (count[j] > 0) {
                    c[j] = new double[]{sum[j][0] / count[j], sum[j][1] / count[j], sum[j][2] / count[j]};
                }
            }
        }
        int[] centers = new int[k];
        for (int j = 0; j < k; j++) {
            centers[j] = ((int) c[j][0] << 16) | ((int) c[j][1] << 8) | (int) c[j][2];
        }
        return centers;
    }

    private static double[] rgb(int p) {
        return new double[]{(p >> 16) & 255, (p >> 8) & 255, p & 255};
    }

    private static double dist2(int p, double[] c) {
        double dr = ((p >> 16) & 255) - c[0], dg = ((p >> 8) & 255) - c[1], db = (p & 255) - c[2];
        return dr * dr + dg * dg + db * db;
    }

    private static boolean[] erode(boolean[] in, int w, int h) {
        boolean[] out = new boolean[in.length];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                out[i] = in[i] && (x == 0 || in[i - 1]) && (x == w - 1 || in[i + 1]) && (y == 0 || in[i - w]) && (y == h - 1 || in[i + w]);
            }
        }
        return out;
    }

    private static boolean[] dilate(boolean[] in, int w, int h) {
        boolean[] out = new boolean[in.length];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                out[i] = in[i] || (x > 0 && in[i - 1]) || (x < w - 1 && in[i + 1]) || (y > 0 && in[i - w]) || (y < h - 1 && in[i + w]);
            }
        }
        return out;
    }
}
