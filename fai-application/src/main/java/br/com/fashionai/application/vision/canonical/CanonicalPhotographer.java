package br.com.fashionai.application.vision.canonical;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.vision.ModelRef;
import br.com.fashionai.application.vision.landmarks.LandmarkDetector;
import br.com.fashionai.application.vision.spec.PhotographySpec;

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF4 · Fotografia canônica — asset fiel à peça real, produzido por uma {@link PhotographySpec}. Operações
 * permitidas e únicas: rotação limitada (pelos landmarks âncora), recorte justo, escala UNIFORME (proporção real) com
 * ampliação máxima, posicionamento (centro ou linha de base), padding e fundo da spec. Nada de inpainting, geração,
 * super-resolução generativa, reiluminação, espelhamento (inverteria logos) ou manequim invisível — diferente do
 * estúdio, que é a foto de vitrine.
 */
public final class CanonicalPhotographer {
    public static final ModelRef MODEL = ModelRef.CANONICAL;
    private static final Color NEUTRAL = new Color(0xF2, 0xF2, 0xF2);

    /** O que foi feito, para auditoria e para o selo "sem IA generativa". */
    public record Report(String specId, double rotationDeg, double scale, double coverage, int offsetX, int offsetY,
                         boolean upscaleLimited, List<String> missingLandmarks, List<String> clippedRegions,
                         boolean compliant, List<String> operations) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("spec", specId);
            m.put("rotationDeg", Math.round(rotationDeg * 100) / 100.0);
            m.put("scale", Math.round(scale * 1000) / 1000.0);
            m.put("coverage", Math.round(coverage * 1000) / 1000.0);
            m.put("offset", List.of(offsetX, offsetY));
            m.put("upscaleLimited", upscaleLimited);
            m.put("missingLandmarks", missingLandmarks);
            m.put("clippedRegions", clippedRegions);
            m.put("compliant", compliant);
            m.put("operations", operations);
            m.put("generative", false);
            m.put("model", MODEL.key());
            return m;
        }
    }

    public record Result(BufferedImage image, Report report) {
    }

    /**
     * @param cutout         recorte RGBA (fundo transparente) da peça
     * @param landmarks      landmarks na mesma imagem (pode ser null)
     * @param clippedRegions regiões que a foto original cortou (do quality gate) — o asset sai não conforme
     */
    public Result render(BufferedImage cutout, PhotographySpec spec, LandmarkDetector.Result landmarks, List<String> clippedRegions) {
        List<String> ops = new ArrayList<>();
        BufferedImage src = ImageOps.toArgb(cutout);
        double rotation = anchorAngle(spec, landmarks);
        if (rotation != 0) {
            src = ImageOps.rotate(src, -rotation);
            ops.add("rotate");
        }
        ImageOps.Box box = ImageOps.alphaBounds(src);
        if (box.empty()) {
            throw new IllegalArgumentException("Recorte vazio: nada para enquadrar");
        }
        src = ImageOps.crop(src, box);
        ops.add("crop");
        int cw = spec.canvasWidth(), ch = spec.canvasHeight();
        double cov = Math.min(spec.coverageTarget(), 1 - 2 * spec.padding());
        double scale = Math.min(cw * cov / src.getWidth(), ch * cov / src.getHeight());
        boolean limited = false;
        if (scale > spec.maxUpscale()) {
            scale = spec.maxUpscale();
            limited = true;
        }
        int w = Math.max(1, (int) Math.round(src.getWidth() * scale));
        int h = Math.max(1, (int) Math.round(src.getHeight() * scale));
        BufferedImage scaled = resize(src, w, h);
        ops.add("resize");
        int x = (cw - w) / 2;
        int y = spec.alignment() == PhotographySpec.Alignment.BASELINE
                ? (int) Math.round(ch * (1 - spec.padding() - 0.06)) - h
                : (ch - h) / 2;
        y = Math.max(0, Math.min(ch - h, y));
        BufferedImage canvas = new BufferedImage(cw, ch, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        if (spec.backgroundMode() != PhotographySpec.BackgroundMode.TRANSPARENT) {
            g.setColor(spec.backgroundMode() == PhotographySpec.BackgroundMode.WHITE ? Color.WHITE : NEUTRAL);
            g.fillRect(0, 0, cw, ch);
        }
        g.setComposite(AlphaComposite.SrcOver);
        g.drawImage(scaled, x, y, null);
        g.dispose();
        ops.add(spec.alignment() == PhotographySpec.Alignment.BASELINE ? "baseline" : "center");
        ops.add("pad");
        List<String> missing = new ArrayList<>();
        for (String name : spec.mandatoryLandmarks()) {
            if (landmarks == null || !landmarks.has(name)) {
                missing.add(name);
            }
        }
        List<String> clipped = clippedRegions == null ? List.of() : clippedRegions.stream()
                .filter(spec.requiredVisibleRegions()::contains).toList();
        double coverage = Math.max(w / (double) cw, h / (double) ch);
        return new Result(canvas, new Report(spec.id(), rotation, scale, coverage, x, y, limited, missing, clipped,
                missing.isEmpty() && clipped.isEmpty(), ops));
    }

    /**
     * Detalhe derivado: recorte da própria peça (logo, textura ou faixa do cós), ampliado no máximo {@code maxUpscale}.
     *
     * @param logoBox caixa do logo relativa ao recorte (x0, y0, x1, y1 em 0–1), para {@code DetailRegion.LOGO}
     */
    public Result detail(BufferedImage cutout, PhotographySpec spec, double[] logoBox) {
        BufferedImage src = ImageOps.toArgb(cutout);
        int W = src.getWidth(), H = src.getHeight();
        int[] r = switch (spec.detailRegion()) {
            case LOGO -> logoBox == null ? null : expand(logoBox, W, H, 0.6);
            case TEXTURE -> textureSquare(src, logoBox);
            case TOP_BAND -> {
                ImageOps.Box b = ImageOps.alphaBounds(src);
                yield b.empty() ? null : new int[]{b.x(), b.y(), b.x() + b.w(), b.y() + (int) Math.round(b.h() * 0.38)};
            }
            case WHOLE -> new int[]{0, 0, W, H};
            case NONE -> throw new IllegalArgumentException("Spec sem região de detalhe: " + spec.id());
        };
        if (r == null || r[2] - r[0] < 16 || r[3] - r[1] < 16) {
            return null;
        }
        BufferedImage crop = src.getSubimage(r[0], r[1], r[2] - r[0], r[3] - r[1]);
        int cw = spec.canvasWidth(), ch = spec.canvasHeight();
        double scale = Math.min(Math.min(cw * spec.coverageTarget() / crop.getWidth(), ch * spec.coverageTarget() / crop.getHeight()),
                spec.maxUpscale());
        int w = Math.max(1, (int) Math.round(crop.getWidth() * scale)), h = Math.max(1, (int) Math.round(crop.getHeight() * scale));
        BufferedImage canvas = new BufferedImage(cw, ch, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, cw, ch);
        g.drawImage(resize(crop, w, h), (cw - w) / 2, (ch - h) / 2, null);
        g.dispose();
        return new Result(canvas, new Report(spec.id(), 0, scale, Math.max(w / (double) cw, h / (double) ch), (cw - w) / 2,
                (ch - h) / 2, scale >= spec.maxUpscale(), List.of(), List.of(), true, List.of("crop", "resize", "center")));
    }

    /** Ângulo da linha entre as âncoras (cintura, ombros); só corrige até o permitido pela spec. */
    static double anchorAngle(PhotographySpec spec, LandmarkDetector.Result lm) {
        if (lm == null || spec.allowedRotationDeg() <= 0) {
            return 0;
        }
        LandmarkDetector.Landmark a = null, b = null;
        if (lm.has("waistband_left") && lm.has("waistband_right")) {
            a = lm.get("waistband_left");
            b = lm.get("waistband_right");
        } else if (lm.has("left_shoulder") && lm.has("right_shoulder") && lm.get("left_shoulder").confidence() >= 0.6) {
            a = lm.get("left_shoulder");
            b = lm.get("right_shoulder");
        }
        if (a == null || b == null || b.x() - a.x() < 0.2) {
            return 0;
        }
        double deg = Math.toDegrees(Math.atan2(b.y() - a.y(), b.x() - a.x()));
        return Math.abs(deg) >= 0.5 && Math.abs(deg) <= spec.allowedRotationDeg() ? deg : 0;
    }

    private static int[] expand(double[] box, int W, int H, double margin) {
        double x0 = box[0] * W, y0 = box[1] * H, x1 = box[2] * W, y1 = box[3] * H;
        double side = Math.max(x1 - x0, y1 - y0) * (1 + margin);
        side = Math.max(side, Math.min(W, H) * 0.12);
        double cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        int a = (int) Math.max(0, cx - side / 2), b = (int) Math.max(0, cy - side / 2);
        return new int[]{a, b, (int) Math.min(W, a + side), (int) Math.min(H, b + side)};
    }

    /** Maior quadrado (busca em grade) totalmente dentro da peça, longe do logo — mostra o tecido sem bordas. */
    static int[] textureSquare(BufferedImage src, double[] logoBox) {
        ImageOps.Box b = ImageOps.alphaBounds(src);
        if (b.empty()) {
            return null;
        }
        int W = src.getWidth();
        int[] px = src.getRGB(0, 0, W, src.getHeight(), null, 0, W);
        for (double frac = 0.4; frac >= 0.12; frac -= 0.04) {
            int side = (int) (Math.min(b.w(), b.h()) * frac);
            if (side < 32) {
                break;
            }
            int step = Math.max(4, side / 6);
            int[] best = null;
            double bestDist = Double.MAX_VALUE;
            double ccx = b.x() + b.w() / 2.0, ccy = b.y() + b.h() * 0.45;
            for (int y = b.y(); y + side <= b.y() + b.h(); y += step) {
                for (int x = b.x(); x + side <= b.x() + b.w(); x += step) {
                    if (overlapsLogo(x, y, side, src, logoBox) || !solid(px, W, x, y, side)) {
                        continue;
                    }
                    double d = Math.hypot(x + side / 2.0 - ccx, y + side / 2.0 - ccy);
                    if (d < bestDist) {
                        bestDist = d;
                        best = new int[]{x, y, x + side, y + side};
                    }
                }
            }
            if (best != null) {
                return best;
            }
        }
        return null;
    }

    private static boolean overlapsLogo(int x, int y, int side, BufferedImage src, double[] logo) {
        if (logo == null) {
            return false;
        }
        double lx0 = logo[0] * src.getWidth(), ly0 = logo[1] * src.getHeight(), lx1 = logo[2] * src.getWidth(), ly1 = logo[3] * src.getHeight();
        return x < lx1 && x + side > lx0 && y < ly1 && y + side > ly0;
    }

    private static boolean solid(int[] px, int W, int x, int y, int side) {
        int step = Math.max(1, side / 12);
        for (int yy = y; yy < y + side; yy += step) {
            for (int xx = x; xx < x + side; xx += step) {
                if ((px[yy * W + xx] >>> 24) < 250) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Redimensiona em espaço pré-multiplicado (sem halo escuro nas bordas transparentes) e, para reduções grandes, em
     * passos de no máximo 2× (sem serrilhado). Interpolação bilinear: não cria cores fora das vizinhas.
     */
    static BufferedImage resize(BufferedImage src, int w, int h) {
        BufferedImage cur = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_ARGB_PRE);
        Graphics2D g0 = cur.createGraphics();
        g0.drawImage(src, 0, 0, null);
        g0.dispose();
        int cw = cur.getWidth(), ch = cur.getHeight();
        do {
            int nw = cw / 2 >= w ? cw / 2 : w;
            int nh = ch / 2 >= h ? ch / 2 : h;
            BufferedImage next = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_ARGB_PRE);
            Graphics2D g = next.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(cur, 0, 0, nw, nh, null);
            g.dispose();
            cur = next;
            cw = nw;
            ch = nh;
        } while (cw != w || ch != h);
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        g.setComposite(AlphaComposite.Src);
        g.drawImage(cur, 0, 0, null);
        g.dispose();
        return out;
    }
}
