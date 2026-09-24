package br.com.fashionai.application.imaging;

import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.application.imaging.ImageProviderPorts.StudioShotPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.UpscalePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * RF4 · Estúdio — depois do Flat Lay, leva a foto da peça a um acabamento de foto de produto de estúdio:
 * <ol>
 *   <li><b>NITIDEZ</b>: ampliação (Stability Upscale ou bicúbica progressiva) + contraste local ("clarity"), nitidez
 *       e vibração só na peça;</li>
 *   <li><b>VOLUME_LUZ</b>: campo de altura a partir da silhueta → normais → luz de estúdio vinda de cima à esquerda
 *       e luz de borda, para a peça ganhar volume;</li>
 *   <li><b>FUNDO_ESTUDIO</b>: gradiente radial numa cor que contrasta com a peça (peça clara → azul royal);</li>
 *   <li><b>SOMBRA</b>: sombra projetada suave + sombra de contato;</li>
 *   <li><b>COMPOSICAO</b>: 1600×1600, peça ocupando ~84% do quadro;</li>
 *   <li><b>VALIDACAO</b>: nitidez (variância do laplaciano), contraste e resolução, antes × depois.</li>
 * </ol>
 * Com Photoroom configurado, fundo + reiluminação + sombra (2–4) são gerados por IA; qualquer falha externa cai
 * para a etapa local sem interromper o cadastro (RNF8). A saída guarda duas imagens: a foto de estúdio (vitrine)
 * e o recorte realçado, ainda sem fundo, para o provador, os cards e o quarto.
 */
@Component
public class StudioPipeline {
    private static final Logger log = LoggerFactory.getLogger(StudioPipeline.class);
    public static final int SIZE = 1600;
    static final int WORK = 1400;

    public record Backdrop(String id, String label, int center, int edge, int shadow) {
        public String hex() {
            return String.format("#%06X", center);
        }
    }

    public static final List<Backdrop> BACKDROPS = List.of(
            new Backdrop("royal", "Azul royal", 0x2D55C9, 0x0F1F63, 0x040A26),
            new Backdrop("grafite", "Grafite", 0x5E636D, 0x1C1E23, 0x000000),
            new Backdrop("areia", "Areia", 0xF1E8D8, 0xC9B99C, 0x4F3F24),
            new Backdrop("rosa", "Rosa pó", 0xF4CDD4, 0xD28C9B, 0x55202D),
            new Backdrop("oliva", "Oliva", 0x93A266, 0x45512A, 0x171D0B),
            new Backdrop("terracota", "Terracota", 0xDE9468, 0x97462A, 0x381407),
            new Backdrop("branco", "Branco infinito", 0xFFFFFF, 0xE3E3E8, 0x35353F));

    public record Stage(String name, String provider, long ms, BigDecimal costUsd, boolean ok, boolean fallback, String note) {
    }

    public record Result(byte[] studioJpeg, byte[] enhancedPng, Backdrop backdrop, List<Stage> stages, BigDecimal costUsd,
                         boolean fallbackUsed, Map<String, Object> metrics) {
    }

    private final List<UpscalePort> upscalers;
    private final List<StudioShotPort> studios;

    public StudioPipeline(List<UpscalePort> upscalers, List<StudioShotPort> studios) {
        this.upscalers = upscalers;
        this.studios = studios;
    }

    public boolean externalAvailable() {
        return upscalers.stream().anyMatch(UpscalePort::available) || studios.stream().anyMatch(StudioShotPort::available);
    }

    public static Optional<Backdrop> backdrop(String id) {
        return BACKDROPS.stream().filter(b -> b.id().equalsIgnoreCase(id == null ? "" : id)).findFirst();
    }

    /** @param cutout recorte ARGB sem fundo (saída do Flat Lay) · @param backdropId id de {@link #BACKDROPS} ou "auto" */
    public Result run(BufferedImage cutout, String backdropId, boolean allowExternal) {
        List<Stage> stages = new ArrayList<>();
        BigDecimal cost = BigDecimal.ZERO;
        boolean fallback = false;
        long t = System.nanoTime();
        ImageOps.Box box = ImageOps.alphaBounds(cutout);
        if (box.empty()) {
            throw new IllegalArgumentException("recorte vazio");
        }
        BufferedImage piece = ImageOps.toArgb(ImageOps.crop(cutout, box));
        double sharpBefore = sharpness(piece);
        double contrastBefore = contrast(piece);
        int wBefore = piece.getWidth(), hBefore = piece.getHeight();
        Backdrop bd = backdrop(backdropId).orElseGet(() -> autoBackdrop(piece));

        // 1) ampliação + nitidez
        BufferedImage up = null;
        if (allowExternal) {
            for (UpscalePort port : upscalers) {
                if (!port.available()) {
                    continue;
                }
                long t1 = System.nanoTime();
                try {
                    Optional<ProviderImage> res = port.upscale(ImageOps.png(piece));
                    if (res.isPresent()) {
                        up = ImageOps.toArgb(ImageOps.decode(res.get().bytes()));
                        cost = cost.add(res.get().costUsd());
                        stages.add(new Stage("NITIDEZ", res.get().provider(), ms(t1), res.get().costUsd(), true, false, up.getWidth() + "×" + up.getHeight()));
                        break;
                    }
                } catch (RuntimeException e) {
                    log.debug("upscale externo falhou: {}", e.toString());
                }
                stages.add(new Stage("NITIDEZ", "externo", ms(t1), BigDecimal.ZERO, false, true, "falhou; seguindo com o local"));
                fallback = true;
            }
        }
        long t2 = System.nanoTime();
        boolean localUp = up == null;
        if (up == null) {
            up = upscaleLocal(piece);
        } else if (Math.max(up.getWidth(), up.getHeight()) > WORK * 2) {
            up = ImageOps.scaleToFit(up, WORK * 2, WORK * 2);
        }
        BufferedImage enhanced = enhance(up);
        stages.add(new Stage("NITIDEZ", "local", ms(t2), BigDecimal.ZERO, true, false, (localUp ? "ampliação bicúbica progressiva · " : "") + "clarity 0,35 · nitidez 0,6 · vibração +18% · "
                + enhanced.getWidth() + "×" + enhanced.getHeight()));

        // 2–4) com IA: fundo + luz + sombra de uma vez
        BufferedImage finalShot = null;
        BufferedImage lit = null;
        if (allowExternal) {
            for (StudioShotPort port : studios) {
                if (!port.available()) {
                    continue;
                }
                long t3 = System.nanoTime();
                try {
                    Optional<ProviderImage> res = port.studio(ImageOps.png(enhanced), bd.hex(), SIZE);
                    if (res.isPresent()) {
                        finalShot = ImageOps.decode(res.get().bytes());
                        cost = cost.add(res.get().costUsd());
                        stages.add(new Stage("ESTUDIO_IA", res.get().provider(), ms(t3), res.get().costUsd(), true, false,
                                "fundo " + bd.label() + " + reiluminação + sombra suave"));
                        break;
                    }
                } catch (RuntimeException e) {
                    log.debug("estúdio externo falhou: {}", e.toString());
                }
                stages.add(new Stage("ESTUDIO_IA", "externo", ms(t3), BigDecimal.ZERO, false, true, "falhou; estúdio local"));
                fallback = true;
            }
        }
        long t4 = System.nanoTime();
        lit = relight(enhanced);
        stages.add(new Stage("VOLUME_LUZ", "local", ms(t4), BigDecimal.ZERO, true, false, "luz-chave 45° superior esquerda · preenchimento 0,88 · luz de borda"));
        if (finalShot == null) {
            long t5 = System.nanoTime();
            finalShot = compose(lit, bd);
            stages.add(new Stage("FUNDO_ESTUDIO", "local", 0, BigDecimal.ZERO, true, !studios.isEmpty() && allowExternal,
                    bd.label() + " (" + bd.hex() + ") · gradiente radial + vinheta"));
            stages.add(new Stage("SOMBRA", "local", 0, BigDecimal.ZERO, true, false, "projetada (desfoque 3× caixa) + contato"));
            stages.add(new Stage("COMPOSICAO", "local", ms(t5), BigDecimal.ZERO, true, false, SIZE + "×" + SIZE + ", peça em 84%"));
        }

        // 6) validação antes × depois
        long t6 = System.nanoTime();
        double sharpAfter = sharpness(lit);
        double contrastAfter = contrast(lit);
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("sharpnessBefore", round(sharpBefore));
        metrics.put("sharpnessAfter", round(sharpAfter));
        metrics.put("contrastBefore", round(contrastBefore));
        metrics.put("contrastAfter", round(contrastAfter));
        metrics.put("resolutionBefore", wBefore + "×" + hBefore);
        metrics.put("resolutionAfter", finalShot.getWidth() + "×" + finalShot.getHeight());
        metrics.put("backdrop", bd.id());
        stages.add(new Stage("VALIDACAO", "local", ms(t6), BigDecimal.ZERO, sharpAfter >= sharpBefore * 0.95, false,
                String.format("nitidez %.0f → %.0f · contraste %.1f → %.1f", sharpBefore, sharpAfter, contrastBefore, contrastAfter)));
        return new Result(ImageOps.jpeg(finalShot, 0.93f), ImageOps.png(lit), bd, stages, cost, fallback, metrics);
    }

    // ================================================================== escolhas

    /**
     * "Automático": o azul royal é a assinatura do estúdio (foto de referência). Só muda para areia quando a peça
     * sumiria nele — mais da metade dela escura (some na borda escura do degradê) ou azul saturado (mesmo tom do fundo).
     */
    static Backdrop autoBackdrop(BufferedImage piece) {
        int n = 0, clash = 0;
        float[] hsb = new float[3];
        for (int y = 0; y < piece.getHeight(); y += 3) {
            for (int x = 0; x < piece.getWidth(); x += 3) {
                int p = piece.getRGB(x, y);
                if ((p >>> 24) < 128) {
                    continue;
                }
                int r = (p >> 16) & 255, g = (p >> 8) & 255, b = p & 255;
                double lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                java.awt.Color.RGBtoHSB(r, g, b, hsb);
                double hue = hsb[0] * 360;
                boolean dark = lum < 0.2;
                boolean blue = hue >= 195 && hue <= 255 && hsb[1] > 0.3 && lum < 0.7;
                n++;
                if (dark || blue) {
                    clash++;
                }
            }
        }
        if (n == 0) {
            return BACKDROPS.get(0);
        }
        return backdrop(clash / (double) n > 0.5 ? "areia" : "royal").orElse(BACKDROPS.get(0));
    }

    // ================================================================== 1) nitidez

    static BufferedImage upscaleLocal(BufferedImage img) {
        int longest = Math.max(img.getWidth(), img.getHeight());
        if (longest >= WORK) {
            return img;
        }
        BufferedImage cur = img;
        while (Math.max(cur.getWidth(), cur.getHeight()) < WORK) {        // bicúbica progressiva (≤ 1,5× por passo)
            double f = Math.min(1.5, WORK / (double) Math.max(cur.getWidth(), cur.getHeight()));
            cur = ImageOps.scale(cur, (int) Math.round(cur.getWidth() * f), (int) Math.round(cur.getHeight() * f));
        }
        return cur;
    }

    static BufferedImage enhance(BufferedImage src) {
        int w = src.getWidth(), h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        float[] y = new float[w * h];
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            y[i] = 0.299f * ((p >> 16) & 255) + 0.587f * ((p >> 8) & 255) + 0.114f * (p & 255);
        }
        float[] wide = boxBlur(y, w, h, Math.max(4, Math.max(w, h) / 70), 3);   // contraste local
        float[] fine = boxBlur(y, w, h, 1, 2);                                    // nitidez fina
        int[] out = new int[px.length];
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            int a = p >>> 24;
            if (a == 0) {
                out[i] = 0;
                continue;
            }
            float delta = 0.35f * (y[i] - wide[i]) + 0.6f * (y[i] - fine[i]);
            float r = ((p >> 16) & 255) + delta, g = ((p >> 8) & 255) + delta, b = (p & 255) + delta;
            // vibração: realça mais o que é pouco saturado, sem estourar o que já é vivo
            float mean = (r + g + b) / 3f, mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b));
            float sat = mx <= 0 ? 0 : (mx - mn) / Math.max(1f, mx);
            float k = 1f + 0.18f * (1f - Math.min(1f, sat));
            r = mean + (r - mean) * k;
            g = mean + (g - mean) * k;
            b = mean + (b - mean) * k;
            out[i] = (a << 24) | (clamp(soft(r)) << 16) | (clamp(soft(g)) << 8) | clamp(soft(b));
        }
        BufferedImage res = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        res.setRGB(0, 0, w, h, out, 0, w);
        return res;
    }

    // ================================================================== 2) volume e luz

    static BufferedImage relight(BufferedImage src) {
        int w = src.getWidth(), h = src.getHeight();
        int s = 4;                                                        // campo de altura em 1/4 da resolução
        int sw = Math.max(2, w / s), sh = Math.max(2, h / s);
        boolean[][] in = new boolean[sh][sw];
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                in[y][x] = (src.getRGB(Math.min(w - 1, x * s + s / 2), Math.min(h - 1, y * s + s / 2)) >>> 24) > 100;
            }
        }
        double[][] d = ReliefModelGenerator.distance(in, sw, sh);
        double max = 1;
        for (double[] row : d) {
            for (double v : row) {
                max = Math.max(max, v);
            }
        }
        double plateau = Math.max(2, max * 0.45);
        float[] height = new float[sw * sh];
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                double t = Math.min(1, d[y][x] / plateau);
                height[y * sw + x] = (float) Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
            }
        }
        height = boxBlur(height, sw, sh, 2, 2);
        // luz-chave de cima à esquerda, na direção de quem olha (y da imagem cresce para baixo)
        double lx = -0.45, ly = -0.55, lz = 0.70, ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
        lx /= ll;
        ly /= ll;
        lz /= ll;
        float[] shade = new float[sw * sh], rim = new float[sw * sh];
        double k = 3.2;                                                   // exagero do relevo nas normais
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                int i = y * sw + x;
                if (!in[y][x]) {
                    continue;
                }
                double dx = (height[y * sw + Math.min(sw - 1, x + 1)] - height[y * sw + Math.max(0, x - 1)]) * 0.5;
                double dy = (height[Math.min(sh - 1, y + 1) * sw + x] - height[Math.max(0, y - 1) * sw + x]) * 0.5;
                double nx = -dx * k, ny = -dy * k, nz = 1, nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
                double lambert = Math.max(0, (nx * lx + ny * ly + nz * lz) / nl);
                double edge = Math.min(1, d[y][x] / Math.max(1.5, plateau * 0.22));
                double occlusion = 0.90 + 0.10 * edge;                   // bordas recuam (oclusão ambiente)
                double topLight = 1.03 - 0.07 * ((double) y / sh);        // luz de cima: base um pouco mais escura
                shade[i] = (float) ((0.74 + 0.34 * lambert) * occlusion * topLight);
                rim[i] = (float) (lambert > 0.62 ? 0.07 * (1 - edge) : 0);
            }
        }
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        int[] out = new int[px.length];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                int p = px[i], a = p >>> 24;
                if (a == 0) {
                    continue;
                }
                float sv = bilinear(shade, sw, sh, (x + 0.5f) / s - 0.5f, (y + 0.5f) / s - 0.5f);
                float rv = bilinear(rim, sw, sh, (x + 0.5f) / s - 0.5f, (y + 0.5f) / s - 0.5f);
                if (sv <= 0) {
                    sv = 1;
                }
                float r = soft(((p >> 16) & 255) * sv), g = soft(((p >> 8) & 255) * sv), b = soft((p & 255) * sv);
                r += (255 - r) * rv;
                g += (255 - g) * rv;
                b += (255 - b) * rv;
                out[i] = (a << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
            }
        }
        BufferedImage res = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        res.setRGB(0, 0, w, h, out, 0, w);
        return res;
    }

    // ================================================================== 3–5) fundo, sombra e composição

    static BufferedImage compose(BufferedImage piece, Backdrop bd) {
        int n = SIZE;
        double fit = Math.min(n * 0.84 / piece.getHeight(), n * 0.86 / piece.getWidth());
        int pw = (int) Math.round(piece.getWidth() * fit), ph = (int) Math.round(piece.getHeight() * fit);
        BufferedImage scaled = ImageOps.scale(piece, pw, ph);
        int ox = (n - pw) / 2, oy = (int) Math.round(n * 0.52 - ph / 2.0);
        int[] bg = new int[n * n];
        int cr = (bd.center() >> 16) & 255, cg = (bd.center() >> 8) & 255, cb = bd.center() & 255;
        int er = (bd.edge() >> 16) & 255, eg = (bd.edge() >> 8) & 255, eb = bd.edge() & 255;
        for (int y = 0; y < n; y++) {
            for (int x = 0; x < n; x++) {
                double dx = (x - n * 0.5) / (n * 0.78), dy = (y - n * 0.40) / (n * 0.78);
                double t = Math.min(1, Math.sqrt(dx * dx + dy * dy));
                t = t * t * (3 - 2 * t);                                  // smoothstep
                double floor = y > n * 0.80 ? 0.06 * (y - n * 0.80) / (n * 0.20) : 0;   // piso levemente mais escuro
                double m = Math.min(1, t + floor);
                bg[y * n + x] = 0xFF000000 | (lerp(cr, er, m) << 16) | (lerp(cg, eg, m) << 8) | lerp(cb, eb, m);
            }
        }
        // sombra projetada: alfa da peça desfocado, deslocado para baixo/direita
        int s = 4, sn = n / s;
        float[] alpha = new float[sn * sn];
        int[] sp = scaled.getRGB(0, 0, pw, ph, null, 0, pw);
        for (int y = 0; y < ph; y += s) {
            for (int x = 0; x < pw; x += s) {
                int ax = (ox + x) / s + 3, ay = (oy + y) / s + 5;             // +12 px, +20 px
                if (ax >= 0 && ay >= 0 && ax < sn && ay < sn) {
                    alpha[ay * sn + ax] = Math.max(alpha[ay * sn + ax], (sp[y * pw + x] >>> 24) / 255f);
                }
            }
        }
        alpha = boxBlur(alpha, sn, sn, 7, 3);
        // sombra de contato: elipse achatada na base da peça
        float[] contact = new float[sn * sn];
        double ccx = (ox + pw / 2.0) / s, ccy = (oy + ph) / s - 2, rx = pw * 0.40 / s, ry = Math.max(3, n * 0.012 / s);
        for (int y = 0; y < sn; y++) {
            for (int x = 0; x < sn; x++) {
                double ex = (x - ccx) / rx, ey = (y - ccy) / ry;
                double v = 1 - (ex * ex + ey * ey);
                contact[y * sn + x] = (float) Math.max(0, v);
            }
        }
        contact = boxBlur(contact, sn, sn, 4, 3);
        int shr = (bd.shadow() >> 16) & 255, shg = (bd.shadow() >> 8) & 255, shb = bd.shadow() & 255;
        int[] out = bg;
        for (int y = 0; y < n; y++) {
            for (int x = 0; x < n; x++) {
                float sa = 0.42f * bilinear(alpha, sn, sn, (x + 0.5f) / s - 0.5f, (y + 0.5f) / s - 0.5f)
                        + 0.35f * bilinear(contact, sn, sn, (x + 0.5f) / s - 0.5f, (y + 0.5f) / s - 0.5f);
                sa = Math.min(0.62f, sa);
                if (sa > 0.002f) {
                    int p = out[y * n + x];
                    out[y * n + x] = 0xFF000000 | (lerp((p >> 16) & 255, shr, sa) << 16) | (lerp((p >> 8) & 255, shg, sa) << 8) | lerp(p & 255, shb, sa);
                }
            }
        }
        for (int y = 0; y < ph; y++) {
            int cy = oy + y;
            if (cy < 0 || cy >= n) {
                continue;
            }
            for (int x = 0; x < pw; x++) {
                int cx = ox + x;
                if (cx < 0 || cx >= n) {
                    continue;
                }
                int p = sp[y * pw + x];
                float a = (p >>> 24) / 255f;
                if (a <= 0) {
                    continue;
                }
                int q = out[cy * n + cx];
                out[cy * n + cx] = 0xFF000000 | (lerp((q >> 16) & 255, (p >> 16) & 255, a) << 16)
                        | (lerp((q >> 8) & 255, (p >> 8) & 255, a) << 8) | lerp(q & 255, p & 255, a);
            }
        }
        BufferedImage res = new BufferedImage(n, n, BufferedImage.TYPE_INT_RGB);
        res.setRGB(0, 0, n, n, out, 0, n);
        return res;
    }

    // ================================================================== métricas e utilidades

    /** Variância do laplaciano da luminância na área da peça (medida clássica de foco/nitidez). */
    static double sharpness(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight(), step = Math.max(1, Math.max(w, h) / 700);
        double sum = 0, sum2 = 0;
        int n = 0;
        for (int y = step; y < h - step; y += step) {
            for (int x = step; x < w - step; x += step) {
                if ((img.getRGB(x, y) >>> 24) < 250) {
                    continue;
                }
                double lap = 4 * lum(img.getRGB(x, y)) - lum(img.getRGB(x - step, y)) - lum(img.getRGB(x + step, y))
                        - lum(img.getRGB(x, y - step)) - lum(img.getRGB(x, y + step));
                sum += lap;
                sum2 += lap * lap;
                n++;
            }
        }
        return n == 0 ? 0 : sum2 / n - (sum / n) * (sum / n);
    }

    static double contrast(BufferedImage img) {
        double sum = 0, sum2 = 0;
        int n = 0;
        for (int y = 0; y < img.getHeight(); y += 2) {
            for (int x = 0; x < img.getWidth(); x += 2) {
                int p = img.getRGB(x, y);
                if ((p >>> 24) < 250) {
                    continue;
                }
                double l = lum(p);
                sum += l;
                sum2 += l * l;
                n++;
            }
        }
        return n == 0 ? 0 : Math.sqrt(Math.max(0, sum2 / n - (sum / n) * (sum / n)));
    }

    private static double lum(int p) {
        return 0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255);
    }

    /** Desfoque de caixa separável repetido (3 passes ≈ gaussiano). */
    static float[] boxBlur(float[] src, int w, int h, int r, int passes) {
        float[] a = src.clone(), b = new float[src.length];
        for (int pass = 0; pass < passes; pass++) {
            for (int y = 0; y < h; y++) {
                float acc = 0;
                int row = y * w;
                for (int x = -r; x <= r; x++) {
                    acc += a[row + Math.min(w - 1, Math.max(0, x))];
                }
                for (int x = 0; x < w; x++) {
                    b[row + x] = acc / (2 * r + 1);
                    acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
                }
            }
            for (int x = 0; x < w; x++) {
                float acc = 0;
                for (int y = -r; y <= r; y++) {
                    acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
                }
                for (int y = 0; y < h; y++) {
                    a[y * w + x] = acc / (2 * r + 1);
                    acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
                }
            }
        }
        return a;
    }

    static float bilinear(float[] f, int w, int h, float x, float y) {
        int x0 = (int) Math.floor(x), y0 = (int) Math.floor(y);
        float fx = x - x0, fy = y - y0;
        int x1 = Math.min(w - 1, Math.max(0, x0 + 1)), y1 = Math.min(h - 1, Math.max(0, y0 + 1));
        x0 = Math.min(w - 1, Math.max(0, x0));
        y0 = Math.min(h - 1, Math.max(0, y0));
        return (f[y0 * w + x0] * (1 - fx) + f[y0 * w + x1] * fx) * (1 - fy) + (f[y1 * w + x0] * (1 - fx) + f[y1 * w + x1] * fx) * fy;
    }

    /** Compressão suave dos realces (evita estourar tons claros como o creme da referência). */
    static float soft(float v) {
        if (v <= 225) {
            return v;
        }
        float over = v - 225;
        return 225 + 30 * (1 - (float) Math.exp(-over / 30));
    }

    private static int clamp(float v) {
        return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }

    private static int lerp(int a, int b, double t) {
        return (int) Math.round(a + (b - a) * t);
    }

    private static double round(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static long ms(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
