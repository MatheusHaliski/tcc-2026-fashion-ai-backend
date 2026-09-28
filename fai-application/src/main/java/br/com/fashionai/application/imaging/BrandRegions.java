package br.com.fashionai.application.imaging;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * RF4 — onde procurar a marca na peça. Numa foto de frente, a marca de uma peça de cima aparece em quatro lugares:
 * <b>fundo da gola</b> (etiqueta interna, vista pelo decote), <b>peito esquerdo</b>, <b>peito direito</b> e
 * <b>centro do peito</b>. Os lados são os de quem veste: o peito esquerdo fica à <i>direita</i> da foto.
 *
 * <p>As zonas saem da silhueta da peça já endireitada e recortada: eixo central = centroide da máscara; largura do tronco
 * = mediana da largura da faixa que contém o eixo entre 55% e 85% da altura (abaixo das mangas); topo = primeira linha
 * opaca no eixo (a gola). Cada zona é recortada da fonte em alta resolução e ampliada para a IA ler letras pequenas.
 * Outras categorias têm zonas equivalentes (cós e quadris na calça; cano, laterais e calcanhar no calçado; quatro
 * quadrantes no acessório).
 */
public final class BrandRegions {
    /** Zona com caixa relativa à peça (0–1: x0, y0, x1, y1). */
    public record Zone(String id, double[] box) {
    }

    public static final List<String> TOP_ZONES = List.of("gola", "peito_esquerdo", "peito_direito", "centro_peito");
    static final int ZOOM = 512;

    private BrandRegions() {
    }

    /** @param piece peça recortada (RGBA, caixa justa), já endireitada */
    public static List<Zone> zones(BufferedImage piece, String category) {
        int w = piece.getWidth();
        int h = piece.getHeight();
        if (w < 8 || h < 8) {
            return List.of();
        }
        String cat = category == null ? "upper_piece" : category;
        return switch (cat) {
            case "upper_piece", "full_body_piece" -> torsoZones(piece, "full_body_piece".equals(cat) ? 0.62 : 1.0);
            case "lower_piece" -> lowerZones(piece);
            case "shoes_piece" -> List.of(zone("cano_lingua", 0.25, 0.0, 0.75, 0.5), zone("lateral_esquerda", 0.0, 0.2, 0.55, 0.9),
                    zone("lateral_direita", 0.45, 0.2, 1.0, 0.9), zone("centro", 0.2, 0.25, 0.8, 0.85));
            default -> List.of(zone("superior_esquerdo", 0.0, 0.0, 0.6, 0.6), zone("superior_direito", 0.4, 0.0, 1.0, 0.6),
                    zone("inferior_esquerdo", 0.0, 0.4, 0.6, 1.0), zone("inferior_direito", 0.4, 0.4, 1.0, 1.0));
        };
    }

    /**
     * Peça de cima (e vestido/macacão com a altura do tronco reduzida por {@code torsoScale}): gola, peito esquerdo (à
     * direita na foto), peito direito (à esquerda na foto) e centro do peito.
     */
    static List<Zone> torsoZones(BufferedImage piece, double torsoScale) {
        int w = piece.getWidth();
        int h = piece.getHeight();
        boolean[] on = mask(piece);
        double cx = centroidX(on, w, h);
        int axis = (int) Math.round(cx);
        int top = 0;
        while (top < h - 1 && !on[top * w + axis]) {
            top++;
        }
        double half = medianHalfWidth(on, w, h, axis, 0.55, 0.85);
        if (half <= 0) {
            half = w / 2.0;
        }
        double body = (h - top) * torsoScale;
        double tw = half;
        return List.of(
                zonePx("gola", cx - 0.34 * tw, top, cx + 0.34 * tw, top + 0.18 * body, w, h),
                zonePx("peito_esquerdo", cx + 0.05 * tw, top + 0.1 * body, cx + 0.95 * tw, top + 0.45 * body, w, h),
                zonePx("peito_direito", cx - 0.95 * tw, top + 0.1 * body, cx - 0.05 * tw, top + 0.45 * body, w, h),
                zonePx("centro_peito", cx - 0.55 * tw, top + 0.14 * body, cx + 0.55 * tw, top + 0.52 * body, w, h));
    }

    /** Calça/saia/shorts: etiqueta do cós (centro, em cima), quadril esquerdo e direito (bolsos) e centro da frente. */
    static List<Zone> lowerZones(BufferedImage piece) {
        return List.of(zone("cos", 0.3, 0.0, 0.7, 0.16), zone("quadril_esquerdo", 0.5, 0.0, 1.0, 0.35),
                zone("quadril_direito", 0.0, 0.0, 0.5, 0.35), zone("centro_frente", 0.25, 0.05, 0.75, 0.4));
    }

    /** Recorte ampliado da zona sobre fundo branco (lado maior = {@value #ZOOM} px) para a IA ler a marca. */
    public static BufferedImage crop(BufferedImage piece, Zone z) {
        return crop(piece, z, ZOOM);
    }

    /**
     * Nova tentativa de ler a marca (RF4): a peça dividida numa grade {@code grid}×{@code grid} de sub-retângulos com 25% de
     * sobreposição (uma letra cortada na borda de um aparece inteira no vizinho) e, se houver caixa de logo, a região do
     * logo ampliada 1,6× e os seus quatro quadrantes. Ids: {@code logo}, {@code logo_q1..q4}, {@code grade_r{linha}c{coluna}}.
     */
    public static List<Zone> tiles(BufferedImage piece, double[] logoRel, int grid) {
        int g = Math.max(2, Math.min(5, grid));
        List<Zone> out = new ArrayList<>();
        if (logoRel != null && logoRel.length == 4) {
            double cx = (logoRel[0] + logoRel[2]) / 2, cy = (logoRel[1] + logoRel[3]) / 2;
            double hw = Math.max(0.06, (logoRel[2] - logoRel[0]) * 0.8), hh = Math.max(0.06, (logoRel[3] - logoRel[1]) * 0.8);
            double[] b = {clamp(cx - hw), clamp(cy - hh), clamp(cx + hw), clamp(cy + hh)};
            out.add(new Zone("logo", round4(b)));
            double mx = (b[0] + b[2]) / 2, my = (b[1] + b[3]) / 2;
            double[][] q = {{b[0], b[1], mx, my}, {mx, b[1], b[2], my}, {b[0], my, mx, b[3]}, {mx, my, b[2], b[3]}};
            for (int i = 0; i < 4; i++) {
                double ox = (q[i][2] - q[i][0]) * 0.2, oy = (q[i][3] - q[i][1]) * 0.2;
                out.add(new Zone("logo_q" + (i + 1), round4(new double[]{clamp(q[i][0] - ox), clamp(q[i][1] - oy), clamp(q[i][2] + ox), clamp(q[i][3] + oy)})));
            }
        }
        double size = Math.min(1.0, 1.25 / g);
        double step = g == 1 ? 0 : (1 - size) / (g - 1);
        for (int r = 0; r < g; r++) {
            for (int c = 0; c < g; c++) {
                double x0 = c * step, y0 = r * step;
                out.add(new Zone("grade_r" + (r + 1) + "c" + (c + 1), round4(new double[]{x0, y0, Math.min(1, x0 + size), Math.min(1, y0 + size)})));
            }
        }
        return out;
    }

    private static double[] round4(double[] b) {
        return new double[]{round(b[0]), round(b[1]), round(b[2]), round(b[3])};
    }

    /** Recorte ampliado da zona sobre fundo branco com o lado maior em {@code size} px. */
    public static BufferedImage crop(BufferedImage piece, Zone z, int size) {
        int w = piece.getWidth();
        int h = piece.getHeight();
        int x0 = (int) Math.floor(z.box()[0] * w);
        int y0 = (int) Math.floor(z.box()[1] * h);
        int x1 = (int) Math.ceil(z.box()[2] * w);
        int y1 = (int) Math.ceil(z.box()[3] * h);
        int cw = Math.max(1, Math.min(w, x1) - x0);
        int ch = Math.max(1, Math.min(h, y1) - y0);
        double s = size / (double) Math.max(cw, ch);
        int ow = Math.max(1, (int) Math.round(cw * s));
        int oh = Math.max(1, (int) Math.round(ch * s));
        BufferedImage out = new BufferedImage(ow, oh, BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g = out.createGraphics();
        ImageOps.quality(g);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, ow, oh);
        g.drawImage(piece.getSubimage(x0, y0, cw, ch), 0, 0, ow, oh, null);
        g.dispose();
        return out;
    }

    /**
     * Detector local de logo (sem IA): mancha compacta e contrastante na peça ({@link LogoFinder}). Diz <i>onde</i> está a
     * marca (caixa relativa 0–1), não <i>qual</i> — ler o nome exige a IA de visão.
     */
    public static double[] detectLogo(BufferedImage piece) {
        LogoFinder.Logo logo = LogoFinder.detect(piece);
        return logo == null ? null : logo.box();
    }

    /**
     * Zona em que está uma caixa relativa (logo achado pela IA ou pelo detector local): entre as zonas que contêm o centro
     * da caixa, a de centro mais próximo (as zonas se sobrepõem na borda: gola × peito, centro × peitos); null se nenhuma.
     */
    public static String zoneOf(List<Zone> zones, double[] box) {
        if (box == null || box.length != 4) {
            return null;
        }
        double cx = (box[0] + box[2]) / 2;
        double cy = (box[1] + box[3]) / 2;
        Zone best = null;
        double bestDist = Double.MAX_VALUE;
        for (Zone z : zones) {
            double[] b = z.box();
            if (cx < b[0] || cx > b[2] || cy < b[1] || cy > b[3]) {
                continue;
            }
            double dist = Math.hypot((cx - (b[0] + b[2]) / 2) / (b[2] - b[0]), (cy - (b[1] + b[3]) / 2) / (b[3] - b[1]));
            if (dist < bestDist) {
                best = z;
                bestDist = dist;
            }
        }
        return best == null ? null : best.id();
    }

    private static Zone zone(String id, double x0, double y0, double x1, double y1) {
        return new Zone(id, new double[]{x0, y0, x1, y1});
    }

    private static Zone zonePx(String id, double x0, double y0, double x1, double y1, int w, int h) {
        double a = clamp(x0 / w), b = clamp(y0 / h), c = clamp(x1 / w), d = clamp(y1 / h);
        if (c - a < 0.02) {
            c = Math.min(1, a + 0.02);
        }
        if (d - b < 0.02) {
            d = Math.min(1, b + 0.02);
        }
        return new Zone(id, new double[]{round(a), round(b), round(c), round(d)});
    }

    static boolean[] mask(BufferedImage img) {
        int w = img.getWidth();
        int h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        boolean[] on = new boolean[px.length];
        for (int i = 0; i < px.length; i++) {
            on[i] = (px[i] >>> 24) > 128;
        }
        return on;
    }

    static double centroidX(boolean[] on, int w, int h) {
        double sx = 0;
        long n = 0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (on[y * w + x]) {
                    sx += x;
                    n++;
                }
            }
        }
        return n == 0 ? w / 2.0 : sx / n;
    }

    /** Meia largura (px) da faixa opaca que contém o eixo, mediana entre as frações de altura dadas. */
    static double medianHalfWidth(boolean[] on, int w, int h, int axis, double from, double to) {
        List<Double> halves = new ArrayList<>();
        for (int y = (int) (h * from); y < (int) (h * to); y++) {
            if (!on[y * w + axis]) {
                continue;
            }
            int l = axis;
            int r = axis;
            while (l > 0 && on[y * w + l - 1]) {
                l--;
            }
            while (r < w - 1 && on[y * w + r + 1]) {
                r++;
            }
            halves.add((r - l + 1) / 2.0);
        }
        if (halves.isEmpty()) {
            return 0;
        }
        double[] v = halves.stream().mapToDouble(Double::doubleValue).toArray();
        Arrays.sort(v);
        return v[v.length / 2];
    }

    private static double clamp(double v) {
        return Math.max(0, Math.min(1, v));
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
