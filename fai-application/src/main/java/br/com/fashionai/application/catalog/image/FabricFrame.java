package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.GarmentCrop;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalVision;

import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Quadro 3:4 só de tecido, para o lote de enquadramento por categoria (scripts/catalog/category_frame.py,
 * CATALOG_FRAME_34_FABRIC_V2): dentro do quadro não pode aparecer fundo, arte de fundo, cabide, pessoa (pele, rosto,
 * mãos) nem outro objeto — a peça ocupa 100% da área.
 *
 * <p>Máscara do tecido: com fundo de estúdio (borda uniforme, mesmo com degradê), tudo o que não é fundo, por
 * preenchimento a partir da borda — peça escura ou clara inteira, que o recorte local às vezes perde —, só o maior
 * componente (adereço separado fica de fora); com fundo cheio de coisas, a máscara do segmentador, e só se ele estiver
 * confiante. Dela sai a pele de cor diferente da peça (rosto, braços, mãos, pernas) e, em foto com modelo, tudo abaixo
 * da barra da peça de cima (a calça não é a camiseta); por fim é erodida alguns pixels para a borda (e a interpolação)
 * não entrarem no quadro. O quadro é o maior retângulo 3:4 inteiramente dentro dessa máscara que contém o ponto da
 * categoria/subcategoria (o que mostrar de cada peça):
 * <ul>
 *   <li>parte de cima: o peito, abaixo da gola, sem as mangas; peças abertas na frente (jaqueta, blazer, casaco,
 *       cardigã, colete, parka, corta-vento, quimono) no painel da frente, fora da abertura central;</li>
 *   <li>parte de baixo: o gancho com o zíper/braguilha (cintura → gancho, sem uma perna isolada vencer); saia, saia-short,
 *       legging e culote no painel da frente abaixo do cós;</li>
 *   <li>corpo inteiro: o corpete (vestido, macacão, jardineira, conjunto);</li>
 *   <li>calçado: o cabedal (cadarços quando o pipeline os achou), sem a sola;</li>
 *   <li>acessório têxtil (bolsas, mochila, carteira, boné, chapéu, gorro, cachecol, gravata, luvas, meias): o corpo do
 *       objeto; acessório sem tecido (joias, relógio, óculos, acessório de cabelo) e cinto (tira estreita com fivela) não
 *       têm quadro de tecido.</li>
 * </ul>
 * Sem tecido suficiente (quadro estreito demais para a foto ou para a peça), não há quadro: a foto não é reenquadrada,
 * em vez de mostrar fundo.
 */
public final class FabricFrame {
    public static final String VERSION = "FABRIC_FRAME_34_V1";
    static final int ASPECT_W = 3, ASPECT_H = 4;
    /** largura mínima do tecido no quadro, em pixels da máscara (a saída de 900 px amplia no máximo ~6×) */
    static final int MIN_WIDTH_PX = 120;
    /** largura mínima do quadro em relação à largura da peça: menos que isso é um detalhe, não a peça */
    static final double MIN_PRODUCT_FRACTION = 0.14;
    /** caixa do primeiro plano menor que isso (fração da foto) é um fragmento, não a peça */
    static final double MIN_BOX_AREA = 0.06;
    /** mancha da cor do fundo dentro da peça a partir da qual é buraco (fração da foto); menor é detalhe da estampa */
    static final double MIN_HOLE_AREA = 0.0012;
    /** mancha de pele a partir da qual é pessoa (fração da foto) */
    static final double MIN_SKIN_AREA = 0.0004;
    static final Set<String> OPEN_FRONT = Set.of("jacket", "blazer", "coat", "cardigan", "vest", "parka", "windbreaker", "kimono");
    static final Set<String> NO_FLY = Set.of("skirt", "skort", "leggings", "culottes");
    /** sem superfície de tecido para um quadro: joias, relógio, óculos, acessório de cabelo; cinto é uma tira estreita com a
     *  fivela de metal no meio */
    static final Set<String> NON_TEXTILE = Set.of("sunglasses", "eyeglasses", "necklace", "bracelet", "earrings", "ring", "watch", "hair_accessory", "belt");

    /**
     * @param crop          quadro normalizado na foto (null sem quadro)
     * @param target        o que o quadro mostra (chest, front_panel, fly, front_below_waistband, bodice, upper, body)
     * @param anchorSource  PIPELINE_LANDMARK quando veio de um landmark detectado; senão ESTIMATED_*
     * @param skinExcluded  fração do produto tirada da máscara por ser pele (evidência de pessoa)
     */
    public record Result(boolean ok, String reason, NRect crop, String target, String anchorSource, double anchorX, double anchorY,
                         NRect region, double fabricCoverage, double skinExcluded, int cropWidthPx, int erosionPx) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("version", VERSION);
            m.put("ok", ok);
            m.put("reason", reason);
            m.put("crop", crop == null ? null : crop.toMap());
            m.put("aspect", "3:4");
            m.put("target", target);
            m.put("anchor", Map.of("x", NRect.r4(anchorX), "y", NRect.r4(anchorY), "source", anchorSource == null ? "" : anchorSource));
            m.put("region", region == null ? null : region.toMap());
            m.put("fabricCoverage", NRect.r4(fabricCoverage));
            m.put("skinExcluded", NRect.r4(skinExcluded));
            m.put("cropWidthPx", cropWidthPx);
            m.put("erosionPx", erosionPx);
            return m;
        }

        static Result none(String reason, String target, double skin) {
            return new Result(false, reason, null, target, null, 0, 0, null, 0, skin, 0, 0);
        }
    }

    private FabricFrame() { }

    /** Máscara do tecido antes da erosão, com a caixa de tudo o que é primeiro plano (peça e quem a veste). */
    record Mask(int w, int h, int[] px, boolean[] fabric, ImageOps.Box box, double skinShare, String reason) {
        boolean person() { return skinShare >= 0.01; }
    }

    public static Result find(ProductSegmenter.Segmentation seg, PieceType type, String subcategory, FramingStrategy.Focus focus) {
        String sub = subcategory == null ? "" : subcategory.trim().toLowerCase(Locale.ROOT);
        String target = target(type, sub);
        if (type == PieceType.ACCESSORY_PIECE && NON_TEXTILE.contains(sub)) {
            return Result.none("NOT_TEXTILE_ACCESSORY", target, 0);
        }
        Mask m = mask(seg, type);
        if (m.reason() != null) return Result.none(m.reason(), target, m.skinShare());
        int w = m.w(), h = m.h();
        Plan plan = plan(type, sub, m.fabric(), m.px(), w, h, m.box(), focus, m.person());
        if (plan.reason() != null) return Result.none(plan.reason(), target, m.skinShare());
        int erosion = Math.max(2, (int) Math.round(Math.min(w, h) * 0.004));
        boolean[] fabric = erode(m.fabric(), w, h, erosion);
        NRect region = new NRect(plan.region().x() / (double) w, plan.region().y() / (double) h, plan.region().w() / (double) w, plan.region().h() / (double) h);
        ImageOps.Box c = anchored(fabric, w, h, plan.region(), plan.ax(), plan.ay());
        double ax = plan.ax() / w, ay = plan.ay() / h, skin = m.skinShare();
        if (c == null) {
            return new Result(false, "NO_FABRIC_REGION", null, target, plan.source(), ax, ay, region, 0, skin, 0, erosion);
        }
        double coverage = coverage(fabric, w, c);
        NRect crop = new NRect(c.x() / (double) w, c.y() / (double) h, c.w() / (double) w, c.h() / (double) h);
        if (coverage < 1) {
            return new Result(false, "FABRIC_COVERAGE_BELOW_100", crop, target, plan.source(), ax, ay, region, coverage, skin, c.w(), erosion);
        }
        if (c.w() < MIN_WIDTH_PX || c.w() < m.box().w() * MIN_PRODUCT_FRACTION) {
            return new Result(false, "FABRIC_REGION_TOO_SMALL", crop, target, plan.source(), ax, ay, region, coverage, skin, c.w(), erosion);
        }
        return new Result(true, null, crop, target, plan.source(), ax, ay, region, coverage, skin, c.w(), erosion);
    }

    /**
     * Máscara do tecido: primeiro plano do fundo de estúdio (ou do segmentador confiante), só o maior componente, sem pixel
     * da cor do fundo em lugar nenhum (fundo cercado pela alça da bolsa, entre o braço e o corpo) e sem pele estranha à peça.
     */
    static Mask mask(ProductSegmenter.Segmentation seg, PieceType type) {
        if (seg == null) return new Mask(0, 0, null, null, null, 0, "NO_PRODUCT");
        int w = seg.width(), h = seg.height();
        int[] px = seg.cutout().getRGB(0, 0, w, h, null, 0, w);
        int[] bg = studioBackground(px, w, h);
        boolean[] fg;
        if (bg != null) {
            fg = studioForeground(px, w, h, bg);
        } else {
            // fundo sem cor uniforme (cena, parede com objetos): só a máscara do segmentador, e só se ele estiver confiante
            if (seg.empty() || seg.confidence() < 0.6) return new Mask(w, h, px, null, null, 0, "BACKGROUND_NOT_UNIFORM");
            fg = new boolean[w * h];
            for (int i = 0; i < fg.length; i++) fg[i] = seg.mask()[i] && (px[i] >>> 24) >= 160;
        }
        fg = largestComponent(fg, w, h);
        int fx0 = w, fy0 = h, fx1 = -1, fy1 = -1;
        for (int i = 0; i < fg.length; i++) if (fg[i]) { int x = i % w, y = i / w; fx0 = Math.min(fx0, x); fy0 = Math.min(fy0, y); fx1 = Math.max(fx1, x); fy1 = Math.max(fy1, y); }
        if (fx1 < 0) return new Mask(w, h, px, null, null, 0, "NO_PRODUCT");
        int[][] garment = garmentColors(px, fg, w, new ImageOps.Box(fx0, fy0, fx1 - fx0 + 1, fy1 - fy0 + 1), type);
        // candidatos a "não tecido" dentro do primeiro plano: cor do fundo (buraco cercado) e pele estranha à peça
        boolean[] hole = new boolean[w * h], skinPx = new boolean[w * h];
        for (int i = 0; i < hole.length; i++) {
            if (!fg[i]) continue;
            if (bg != null && dist2(px[i], bg) <= 18 * 18) hole[i] = true;
            else if (foreignSkin(px[i], garment)) skinPx[i] = true;
        }
        // só manchas de tamanho de verdade (fundo cercado pela alça, entre o braço e o corpo; rosto, mão, perna): pontinhos
        // claros ou bege de uma estampa continuam tecido
        hole = keepLarge(hole, w, h, (int) Math.round(w * h * MIN_HOLE_AREA));
        skinPx = keepLarge(skinPx, w, h, (int) Math.round(w * h * MIN_SKIN_AREA));
        boolean[] fabric = new boolean[w * h];
        long product = 0, skin = 0;
        int x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (int i = 0; i < fabric.length; i++) {
            if (!fg[i]) continue;
            product++;
            int x = i % w, y = i / w;
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            if (hole[i]) continue;                                          // cor do fundo: buraco cercado, nunca tecido
            if (skinPx[i]) { skin++; continue; }                            // pele de cor diferente da peça: pessoa
            fabric[i] = true;
        }
        if (product == 0) return new Mask(w, h, px, null, null, 0, "NO_PRODUCT");
        ImageOps.Box box = new ImageOps.Box(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        // fragmento: só um detalhe sobrou do primeiro plano (peça da cor do fundo), não a peça
        if ((double) box.w() * box.h() < (double) w * h * MIN_BOX_AREA) return new Mask(w, h, px, null, box, 0, "SEGMENTATION_FRAGMENT");
        return new Mask(w, h, px, fabric, box, (double) skin / product, null);
    }

    /** Cor do fundo de estúdio: a borda da foto quase toda de uma cor (aceita degradê/vinheta); senão null. */
    static int[] studioBackground(int[] px, int w, int h) {
        int[] border = new int[2 * (w + h)];
        int k = 0;
        for (int x = 0; x < w; x++) { border[k++] = px[x]; border[k++] = px[(h - 1) * w + x]; }
        for (int y = 0; y < h; y++) { border[k++] = px[y * w]; border[k++] = px[y * w + w - 1]; }
        int[] bg = garmentMedian(border, null);
        int near = 0;
        for (int i = 0; i < k; i++) near += dist2(border[i], bg) <= 30 * 30 ? 1 : 0;
        return near >= k * 0.6 ? bg : null;
    }

    /** Preenche a partir da borda tudo o que é fundo; o resto é a peça (e quem a veste). */
    static boolean[] studioForeground(int[] px, int w, int h, int[] bg) {
        int n = w * h;
        boolean[] background = new boolean[n];
        int[] queue = new int[n];
        int head = 0, tail = 0;
        for (int i = 0; i < n; i++) {
            int x = i % w, y = i / w;
            if ((x == 0 || y == 0 || x == w - 1 || y == h - 1) && dist2(px[i], bg) <= 30 * 30) { background[i] = true; queue[tail++] = i; }
        }
        while (head < tail) {
            int i = queue[head++], x = i % w, y = i / w;
            int[] next = {x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1};
            for (int j : next) {
                if (j < 0 || background[j]) continue;
                // perto da cor do fundo, ou um passo suave a partir do fundo vizinho (degradê), sem se afastar demais
                int d = dist2(px[j], bg);
                if (d <= 30 * 30 || (dist2(px[j], px[i]) <= 7 * 7 && d <= 64 * 64)) { background[j] = true; queue[tail++] = j; }
            }
        }
        boolean[] fg = new boolean[n];
        for (int i = 0; i < n; i++) fg[i] = !background[i];
        return fg;
    }

    /** Só os componentes com ao menos {@code min} pixels. */
    static boolean[] keepLarge(boolean[] in, int w, int h, int min) {
        int[] labels = new int[in.length];
        java.util.List<int[]> comps = ProductSegmenter.components(in, w, h, labels);
        java.util.Set<Integer> keep = new java.util.HashSet<>();
        for (int[] c : comps) if (c[1] >= min) keep.add(c[0]);
        boolean[] out = new boolean[in.length];
        for (int i = 0; i < in.length; i++) out[i] = in[i] && keep.contains(labels[i]);
        return out;
    }

    /** Só o maior componente: um adereço solto na foto não é a peça. */
    static boolean[] largestComponent(boolean[] fg, int w, int h) {
        int[] labels = new int[fg.length];
        java.util.List<int[]> comps = ProductSegmenter.components(fg, w, h, labels);
        boolean[] out = new boolean[fg.length];
        if (comps.isEmpty()) return out;
        int keep = comps.get(0)[0];
        for (int i = 0; i < fg.length; i++) out[i] = labels[i] == keep;
        return out;
    }

    /**
     * Maior retângulo 3:4 inteiramente em tecido (dentro da região) que contém o ponto da categoria; o ponto fica a ~1/3 do
     * topo quando dá. Busca binária no tamanho (se um tamanho cabe com o ponto dentro, um menor também cabe) e varredura das
     * posições com soma de prefixos. Ponto fora do tecido: o pixel de tecido mais próximo dentro da região.
     */
    static ImageOps.Box anchored(boolean[] fabric, int w, int h, ImageOps.Box region, double fx, double fy) {
        if (region.w() <= 0 || region.h() <= 0) return null;
        int[] pre = new int[(w + 1) * (h + 1)];
        for (int y = 0; y < h; y++) {
            int run = 0;
            for (int x = 0; x < w; x++) {
                boolean free = fabric[y * w + x] && x >= region.x() && x < region.x() + region.w() && y >= region.y() && y < region.y() + region.h();
                run += free ? 0 : 1;
                pre[(y + 1) * (w + 1) + x + 1] = pre[y * (w + 1) + x + 1] + run;
            }
        }
        int[] a = nearestFree(fabric, w, region, (int) Math.round(fx), (int) Math.round(fy));
        if (a == null) return null;
        int ax = a[0], ay = a[1];
        int lo = 1, hi = Math.min(region.w() / ASPECT_W, region.h() / ASPECT_H);
        ImageOps.Box best = null;
        while (lo <= hi) {
            int u = (lo + hi) >>> 1;
            ImageOps.Box found = place(pre, w, region, ax, ay, u * ASPECT_W, u * ASPECT_H);
            if (found != null) { best = found; lo = u + 1; } else hi = u - 1;
        }
        return best;
    }

    private static ImageOps.Box place(int[] pre, int w, ImageOps.Box region, int ax, int ay, int cw, int ch) {
        int xMin = Math.max(region.x(), ax - cw + 1), xMax = Math.min(region.x() + region.w() - cw, ax);
        int yMin = Math.max(region.y(), ay - ch + 1), yMax = Math.min(region.y() + region.h() - ch, ay);
        if (xMin > xMax || yMin > yMax) return null;
        int step = Math.max(1, Math.min(cw, ch) / 48);
        double wantX = ax - cw / 2.0, wantY = ay - ch * 0.32;
        ImageOps.Box best = null;
        double bestD = Double.MAX_VALUE;
        for (int y = yMin; y <= yMax; y = y < yMax && y + step > yMax ? yMax : y + step) {
            for (int x = xMin; x <= xMax; x = x < xMax && x + step > xMax ? xMax : x + step) {
                int blocked = pre[(y + ch) * (w + 1) + x + cw] - pre[y * (w + 1) + x + cw] - pre[(y + ch) * (w + 1) + x] + pre[y * (w + 1) + x];
                if (blocked == 0) {
                    double d = (x - wantX) * (x - wantX) + (y - wantY) * (y - wantY);
                    if (d < bestD) { bestD = d; best = new ImageOps.Box(x, y, cw, ch); }
                }
                if (x == xMax) break;
            }
            if (y == yMax) break;
        }
        return best;
    }

    private static int[] nearestFree(boolean[] fabric, int w, ImageOps.Box region, int x, int y) {
        int maxR = Math.max(region.w(), region.h());
        for (int r = 0; r <= maxR; r++) {
            for (int dy = -r; dy <= r; dy++) {
                for (int dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) != r) continue;
                    int xx = x + dx, yy = y + dy;
                    if (xx < region.x() || yy < region.y() || xx >= region.x() + region.w() || yy >= region.y() + region.h()) continue;
                    if (fabric[yy * w + xx]) return new int[]{xx, yy};
                }
            }
            if (r > 0 && r % 64 == 0 && r > maxR / 3) break;   // longe demais do ponto da categoria: não é o mesmo lugar
        }
        return null;
    }

    /**
     * Borda da peça numa foto com modelo, pela cor: a partir de {@code refY}, andando de {@code step} (+1 desce, −1 sobe)
     * pelo miolo, a primeira faixa de linhas cuja cor média muda muito (camiseta → calça ao descer; calça → camisa/jaqueta
     * ao subir; ou a pele da barriga). Sem mudança, {@code endY}.
     */
    static int colorEdge(int[] px, boolean[] fabric, int w, int cx, int half, int refY, int endY, int step) {
        int x0 = Math.max(0, cx - half), x1 = Math.min(w, cx + half);
        int r0 = step > 0 ? refY : Math.max(0, refY - 12), r1 = step > 0 ? refY + 12 : refY;
        double[] ref = rowMean(px, fabric, w, x0, x1, Math.min(r0, r1), Math.max(r0, r1));
        if (ref == null) return endY;
        int streak = 0;
        for (int y = refY + 12 * step; step > 0 ? y < endY : y > endY; y += step) {
            double[] m = rowMean(px, fabric, w, x0, x1, y, y + 1);
            boolean change = m == null || Math.pow(m[0] - ref[0], 2) + Math.pow(m[1] - ref[1], 2) + Math.pow(m[2] - ref[2], 2) > 60 * 60;
            streak = change ? streak + 1 : 0;
            if (streak >= 4) return y - streak * step;
        }
        return endY;
    }

    /**
     * Abertura na frente pela cor: na faixa do peito, o miolo difere dos dois painéis, que são parecidos entre si (jaqueta ou
     * moletom aberto mostrando a camiseta por baixo, ou o forro/fundo).
     */
    static boolean openByColor(int[] px, boolean[] fabric, int w, int cx, int half, int y0, int y1) {
        int band = Math.max(3, half / 6);
        double[] mid = rowMean(px, fabric, w, cx - band, cx + band, y0, y1);
        double[] left = rowMean(px, fabric, w, cx - half, cx - half + 2 * band, y0, y1);
        double[] right = rowMean(px, fabric, w, cx + half - 2 * band, cx + half, y0, y1);
        if (mid == null || left == null || right == null) return false;
        return d(mid, left) > 45 && d(mid, right) > 45 && d(left, right) < 35;
    }

    private static double d(double[] a, double[] b) {
        return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
    }

    private static double[] rowMean(int[] px, boolean[] fabric, int w, int x0, int x1, int y0, int y1) {
        double r = 0, g = 0, b = 0;
        int n = 0, all = 0;
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                all++;
                int i = y * w + x;
                if (!fabric[i]) continue;
                r += (px[i] >> 16) & 0xFF; g += (px[i] >> 8) & 0xFF; b += px[i] & 0xFF; n++;
            }
        }
        return n < Math.max(4, all * 0.3) ? null : new double[]{r / n, g / n, b / n};
    }

    private static int dist2(int p, int[] c) {
        int dr = ((p >> 16) & 0xFF) - c[0], dg = ((p >> 8) & 0xFF) - c[1], db = (p & 0xFF) - c[2];
        return dr * dr + dg * dg + db * db;
    }

    private static int dist2(int p, int q) {
        int dr = ((p >> 16) & 0xFF) - ((q >> 16) & 0xFF), dg = ((p >> 8) & 0xFF) - ((q >> 8) & 0xFF), db = (p & 0xFF) - (q & 0xFF);
        return dr * dr + dg * dg + db * db;
    }

    static String target(PieceType type, String sub) {
        return switch (type) {
            case UPPER_PIECE -> OPEN_FRONT.contains(sub) ? "front_panel" : "chest";
            case LOWER_PIECE -> NO_FLY.contains(sub) ? "front_below_waistband" : "fly";
            case FULL_BODY_PIECE -> "bodice";
            case SHOES_PIECE -> "upper";
            case ACCESSORY_PIECE -> "body";
        };
    }

    record Plan(ImageOps.Box region, double ax, double ay, String source, String reason) {
        Plan(ImageOps.Box region, double ax, double ay, String source) { this(region, ax, ay, source, null); }
        static Plan refuse(String reason) { return new Plan(new ImageOps.Box(0, 0, 0, 0), 0, 0, null, reason); }
    }

    /** Região (em pixels da máscara) e ponto de ancoragem de cada categoria/subcategoria. */
    static Plan plan(PieceType type, String sub, boolean[] fabric, int[] px, int w, int h, ImageOps.Box b, FramingStrategy.Focus focus,
                             boolean person) {
        double cx = centerX(fabric, w, b);
        switch (type) {
            case UPPER_PIECE, FULL_BODY_PIECE -> {
                // linha dos ombros: a primeira linha larga da peça (rosto, pescoço e alças são estreitos ou pele)
                int shoulders = firstWideRow(fabric, w, b, 0.5);
                // com modelo, a peça de cima começa no alto da pessoa; tecido largo só embaixo é a calça/short — a peça de
                // cima sumiu da máscara (da cor do fundo) e o quadro cairia na peça errada
                if (person && shoulders - b.y() > b.h() * 0.45) return Plan.refuse("GARMENT_NOT_ISOLATED");
                double torsoH = b.y() + b.h() - shoulders;
                int top = (int) Math.round(shoulders + (person ? b.h() * 0.035 : torsoH * 0.06));
                int bottom = (int) Math.round(b.y() + b.h() - (person ? 0 : torsoH * 0.03));
                int half = (int) Math.round(b.w() * (person ? 0.22 : 0.32));
                if (person) {
                    // a calça (ou a pele da barriga) abaixo da barra não é esta peça: corta na primeira mudança forte de cor
                    bottom = Math.min(bottom, colorEdge(px, fabric, w, (int) Math.round(cx), Math.max(4, half / 2), top, bottom, 1));
                    // e pela proporção do corpo, para escuro sobre escuro (polo preta com calça marinho): o tronco, dos ombros à
                    // cintura natural, mede ~1× a altura da cabeça com o pescoço (e o cabelo); 0,8× deixa o quadro no peito
                    int head = shoulders - b.y();
                    if (head > b.h() * 0.05) bottom = Math.min(bottom, shoulders + (int) Math.round(head * 0.8));
                }
                if (type == PieceType.FULL_BODY_PIECE) bottom = (int) Math.round(Math.min(bottom, top + (bottom - top) * 0.6));
                // sem as mangas: o miolo da largura da peça; aberta na frente, só um painel (a abertura central mostra o que
                // está por baixo — outra peça ou o fundo —, que não é o tecido desta peça)
                boolean open = OPEN_FRONT.contains(sub) || openByColor(px, fabric, w, (int) Math.round(cx), half,
                        top + (bottom - top) / 6, top + (bottom - top) / 2);
                int left = (int) Math.round(cx) - half, width = open ? (int) Math.round(half - b.w() * 0.04) : half * 2;
                ImageOps.Box region = clip(new ImageOps.Box(left, top, width, Math.max(1, bottom - top)), w, h);
                double ax = open ? left + width * 0.5 : cx;   // painel da frente, fora da abertura central
                double ay = top + (bottom - top) * 0.3;
                return new Plan(region, ax, ay, open ? "ESTIMATED_FRONT_PANEL" : "ESTIMATED_CHEST");
            }
            case LOWER_PIECE -> {
                if (NO_FLY.contains(sub)) {
                    int top = (int) Math.round(b.y() + b.h() * 0.08);                 // abaixo do cós
                    int bottom = (int) Math.round(b.y() + b.h() * (sub.equals("leggings") ? 0.45 : 0.75));
                    int half = (int) Math.round(b.w() * 0.4);
                    ImageOps.Box region = clip(new ImageOps.Box((int) Math.round(cx) - half, top, half * 2, Math.max(1, bottom - top)), w, h);
                    return new Plan(region, cx, top + (bottom - top) * 0.3, "ESTIMATED_FRONT_PANEL");
                }
                GarmentCrop.LowerRegion lower = GarmentCrop.lowerRegion(alphaOf(fabric, w, h), person);
                ImageOps.Box region = lower.box().w() > 0 ? lower.box() : b;
                int crotch = region.y() + region.h();
                if (lower.estimatedPerson()) {
                    // com modelo, cintura → gancho fica na faixa logo acima do gancho (acima dela é a camisa/jaqueta)
                    int top = Math.max(region.y(), (int) Math.round(crotch - b.h() * 0.14));
                    region = new ImageOps.Box(region.x(), top, region.w(), Math.max(1, crotch - top));
                }
                // o cós: subindo a partir de logo acima do gancho (sempre a calça), a primeira mudança forte de cor — acima dela é
                // a camisa/jaqueta por cima (ou um cós de outra cor); a região começa ali
                // shorts/bermuda: a barra (com pesponto) fica no fim da região — a referência sobe para longe dela
                boolean shorts = sub.contains("shorts");
                int refY = (int) Math.round(crotch - Math.max(6, region.h() * (shorts ? 0.3 : 0.1)));
                int waist = colorEdge(px, fabric, w, (int) Math.round(cx), Math.max(4, (int) (region.w() * 0.15)), refY, region.y(), -1);
                if (waist > region.y()) region = new ImageOps.Box(region.x(), waist, region.w(), Math.max(1, crotch - waist));
                // só o miolo do quadril: jaqueta aberta caindo nas laterais e as mãos nos bolsos ficam de fora
                int halfHip = (int) Math.round(region.w() * 0.27);
                region = clip(new ImageOps.Box((int) Math.round(cx) - halfHip, region.y(), halfHip * 2, region.h()), w, h);
                // braguilha: no miolo, na metade de baixo do caminho cós → gancho
                double ay = region.y() + region.h() * (shorts ? 0.45 : 0.55);
                if (focus != null && focus.name() != null && focus.name().toLowerCase(Locale.ROOT).matches(".*(zipper|fastening|fly).*")) {
                    NRect r = focus.rect();
                    return new Plan(region, r.cx() * w, r.cy() * h, "PIPELINE_LANDMARK");
                }
                return new Plan(region, cx, ay, "ESTIMATED_FLY");
            }
            case SHOES_PIECE -> {
                // cabedal: sem a sola (faixa de baixo) e sem a ponta do cano
                int top = (int) Math.round(b.y() + b.h() * 0.05), bottom = (int) Math.round(b.y() + b.h() * 0.80);
                ImageOps.Box region = clip(new ImageOps.Box(b.x(), top, b.w(), Math.max(1, bottom - top)), w, h);
                if (focus != null && focus.name() != null && focus.name().toLowerCase(Locale.ROOT).contains("lace")) {
                    NRect r = focus.rect();
                    return new Plan(region, r.cx() * w, r.cy() * h, "PIPELINE_LANDMARK");
                }
                return new Plan(region, cx, b.y() + b.h() * 0.42, "ESTIMATED_UPPER");
            }
            default -> {
                int inset = (int) Math.round(Math.min(b.w(), b.h()) * 0.04);
                ImageOps.Box region = clip(new ImageOps.Box(b.x() + inset, b.y() + inset, b.w() - 2 * inset, b.h() - 2 * inset), w, h);
                return new Plan(region, cx, b.y() + b.h() * 0.5, "ESTIMATED_BODY");
            }
        }
    }

    private static BufferedImage alphaOf(boolean[] fabric, int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        int[] row = new int[w];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) row[x] = fabric[y * w + x] ? 0xFF000000 : 0;
            img.setRGB(0, y, w, 1, row, 0, w);
        }
        return img;
    }

    /** A primeira linha (de cima para baixo) em que o tecido ocupa ao menos {@code share} da largura da peça. */
    static int firstWideRow(boolean[] fabric, int w, ImageOps.Box b, double share) {
        for (int y = b.y(); y < b.y() + b.h(); y++) {
            int n = 0;
            for (int x = b.x(); x < b.x() + b.w(); x++) n += fabric[y * w + x] ? 1 : 0;
            if (n >= b.w() * share) return y;
        }
        return b.y();
    }

    /** Centro horizontal do tecido (mediana das colunas), não o meio da caixa: manga aberta não puxa o centro. */
    static double centerX(boolean[] fabric, int w, ImageOps.Box b) {
        long[] cols = new long[b.w()];
        long total = 0;
        for (int y = b.y(); y < b.y() + b.h(); y++) {
            for (int x = b.x(); x < b.x() + b.w(); x++) {
                if (fabric[y * w + x]) { cols[x - b.x()]++; total++; }
            }
        }
        if (total == 0) return b.x() + b.w() / 2.0;
        long acc = 0;
        for (int i = 0; i < cols.length; i++) {
            acc += cols[i];
            if (acc * 2 >= total) return b.x() + i + 0.5;
        }
        return b.x() + b.w() / 2.0;
    }

    static int[] garmentMedian(int[] px, boolean[] mask) {
        int[] r = new int[256], g = new int[256], bl = new int[256];
        int n = 0;
        for (int i = 0; i < px.length; i++) {
            if (mask != null && !mask[i]) continue;
            r[(px[i] >> 16) & 0xFF]++; g[(px[i] >> 8) & 0xFF]++; bl[px[i] & 0xFF]++; n++;
        }
        return new int[]{median(r, n), median(g, n), median(bl, n)};
    }

    /** Pele (Cb/Cr) longe das cores da peça: uma camiseta bege continua tecido; o braço de quem veste, não. */
    static boolean foreignSkin(int p, int[][] garment) {
        if (LocalVision.skinRatio(new int[]{p}) <= 0) return false;
        for (int[] c : garment) if (dist2(p, c) <= 70 * 70) return false;
        return true;
    }

    static boolean foreignSkin(int p, int[] median) {
        return foreignSkin(p, new int[][]{median});
    }

    /**
     * Cores da peça medidas onde a categoria diz que ela está (peito, cintura/coxa, miolo do calçado ou do acessório) — não no
     * primeiro plano inteiro, que tem calça, sapato e cabelo: até 3 cores dominantes (peça estampada ou em blocos de cor).
     */
    static int[][] garmentColors(int[] px, boolean[] fg, int w, ImageOps.Box b, PieceType type) {
        double fy0 = 0.3, fy1 = 0.55, fx = 0.14;
        if (type == PieceType.LOWER_PIECE) { fy0 = 0.4; fy1 = 0.62; }
        else if (type == PieceType.SHOES_PIECE || type == PieceType.ACCESSORY_PIECE) { fy0 = 0.3; fy1 = 0.7; fx = 0.25; }
        int x0 = (int) (b.x() + b.w() * (0.5 - fx)), x1 = (int) (b.x() + b.w() * (0.5 + fx));
        int y0 = (int) (b.y() + b.h() * fy0), y1 = (int) (b.y() + b.h() * fy1);
        java.util.Map<Integer, long[]> bins = new java.util.HashMap<>();
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                int i = y * w + x;
                if (!fg[i]) continue;
                int p = px[i], key = (((p >> 16) & 0xFF) >> 5) << 6 | (((p >> 8) & 0xFF) >> 5) << 3 | ((p & 0xFF) >> 5);
                long[] e = bins.computeIfAbsent(key, k -> new long[4]);
                e[0]++; e[1] += (p >> 16) & 0xFF; e[2] += (p >> 8) & 0xFF; e[3] += p & 0xFF;
            }
        }
        if (bins.isEmpty()) return new int[][]{garmentMedian(px, fg)};
        long total = bins.values().stream().mapToLong(e -> e[0]).sum();
        return bins.values().stream().sorted((a, c) -> Long.compare(c[0], a[0])).limit(3).filter(e -> e[0] >= total * 0.08)
                .map(e -> new int[]{(int) (e[1] / e[0]), (int) (e[2] / e[0]), (int) (e[3] / e[0])}).toArray(int[][]::new);
    }

    /** Erosão quadrada de raio r (duas passadas separáveis com somas de prefixo): O(w × h). */
    static boolean[] erode(boolean[] in, int w, int h, int r) {
        boolean[] mid = new boolean[in.length], out = new boolean[in.length];
        int[] pre = new int[Math.max(w, h) + 1];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) pre[x + 1] = pre[x] + (in[y * w + x] ? 0 : 1);
            for (int x = 0; x < w; x++) {
                int a = x - r, z = x + r + 1;
                mid[y * w + x] = a >= 0 && z <= w && pre[z] - pre[a] == 0;
            }
        }
        for (int x = 0; x < w; x++) {
            for (int y = 0; y < h; y++) pre[y + 1] = pre[y] + (mid[y * w + x] ? 0 : 1);
            for (int y = 0; y < h; y++) {
                int a = y - r, z = y + r + 1;
                out[y * w + x] = a >= 0 && z <= h && pre[z] - pre[a] == 0;
            }
        }
        return out;
    }

    static double coverage(boolean[] fabric, int w, ImageOps.Box c) {
        long on = 0, all = (long) c.w() * c.h();
        for (int y = c.y(); y < c.y() + c.h(); y++) {
            for (int x = c.x(); x < c.x() + c.w(); x++) on += fabric[y * w + x] ? 1 : 0;
        }
        return all == 0 ? 0 : (double) on / all;
    }

    private static ImageOps.Box clip(ImageOps.Box b, int w, int h) {
        int x0 = Math.max(0, b.x()), y0 = Math.max(0, b.y()), x1 = Math.min(w, b.x() + b.w()), y1 = Math.min(h, b.y() + b.h());
        return new ImageOps.Box(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    }

    private static int median(int[] hist, int n) {
        int acc = 0;
        for (int v = 0; v < 256; v++) {
            acc += hist[v];
            if (acc * 2 >= n) return v;
        }
        return 255;
    }
}
