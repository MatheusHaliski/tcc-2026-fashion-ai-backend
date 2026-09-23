package br.com.fashionai.application.imaging;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.util.Map;

/**
 * Filtros do pipeline RF5 (SchemeItem.filters: blur, saturation, brightness, contrast, hue_shift), mais
 * normalização de cor do RF4 (gray-world + stretch de contraste) e sombra suave. Mesma semântica dos
 * filtros CSS do frontend (1 = neutro para saturation/brightness/contrast; blur em px; hue_shift em graus).
 */
public final class ImageFilters {
    private ImageFilters() {
    }

    public record Filters(double blur, double saturation, double brightness, double contrast, double hueShift) {
        public static final Filters NEUTRAL = new Filters(0, 1, 1, 1, 0);

        public static Filters of(Map<String, Object> json) {
            if (json == null || json.isEmpty()) {
                return NEUTRAL;
            }
            return new Filters(num(json, "blur", 0, 0, 20), num(json, "saturation", 1, 0, 3), num(json, "brightness", 1, 0.2, 2.5),
                    num(json, "contrast", 1, 0.2, 2.5), num(json, "hue_shift", 0, -180, 180));
        }

        public boolean neutral() {
            return blur == 0 && saturation == 1 && brightness == 1 && contrast == 1 && hueShift == 0;
        }

        private static double num(Map<String, Object> json, String key, double def, double min, double max) {
            Object v = json.get(key);
            if (v == null && key.equals("hue_shift")) {
                v = json.get("hueShift");
            }
            double d = v instanceof Number n ? n.doubleValue() : def;
            return Math.max(min, Math.min(max, d));
        }
    }

    public static BufferedImage apply(BufferedImage src, Filters f) {
        if (f == null || f.neutral()) {
            return src;
        }
        int w = src.getWidth();
        int h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        float[] hsb = new float[3];
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            int a = (p >>> 24) & 0xFF;
            if (a == 0) {
                continue;
            }
            double r = (p >> 16) & 0xFF;
            double g = (p >> 8) & 0xFF;
            double b = p & 0xFF;
            r *= f.brightness();
            g *= f.brightness();
            b *= f.brightness();
            r = (r - 128) * f.contrast() + 128;
            g = (g - 128) * f.contrast() + 128;
            b = (b - 128) * f.contrast() + 128;
            int ri = clamp(r);
            int gi = clamp(g);
            int bi = clamp(b);
            if (f.saturation() != 1 || f.hueShift() != 0) {
                Color.RGBtoHSB(ri, gi, bi, hsb);
                float hue = (float) (hsb[0] + f.hueShift() / 360.0);
                float sat = (float) Math.max(0, Math.min(1, hsb[1] * f.saturation()));
                int rgb = Color.HSBtoRGB(hue - (float) Math.floor(hue), sat, hsb[2]);
                px[i] = (a << 24) | (rgb & 0xFFFFFF);
            } else {
                px[i] = (a << 24) | (ri << 16) | (gi << 8) | bi;
            }
        }
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        return f.blur() > 0 ? blur(out, (int) Math.round(f.blur())) : out;
    }

    public static BufferedImage blur(BufferedImage src, int radius) {
        if (radius <= 0) {
            return src;
        }
        int size = radius * 2 + 1;
        float[] data = new float[size];
        float sigma = radius / 2f + 0.5f;
        float sum = 0;
        for (int i = 0; i < size; i++) {
            int x = i - radius;
            data[i] = (float) Math.exp(-(x * x) / (2 * sigma * sigma));
            sum += data[i];
        }
        for (int i = 0; i < size; i++) {
            data[i] /= sum;
        }
        BufferedImage padded = pad(src, radius);
        ConvolveOp horizontal = new ConvolveOp(new Kernel(size, 1, data), ConvolveOp.EDGE_NO_OP, null);
        ConvolveOp vertical = new ConvolveOp(new Kernel(1, size, data), ConvolveOp.EDGE_NO_OP, null);
        BufferedImage blurred = vertical.filter(horizontal.filter(padded, null), null);
        return blurred.getSubimage(radius, radius, src.getWidth(), src.getHeight());
    }

    private static BufferedImage pad(BufferedImage src, int r) {
        BufferedImage out = new BufferedImage(src.getWidth() + 2 * r, src.getHeight() + 2 * r, BufferedImage.TYPE_INT_ARGB);
        out.createGraphics().drawImage(src, r, r, null);
        return out;
    }

    /** Silhueta escura e desfocada do recorte — sombra do Flat Lay e das peças no provador. */
    public static BufferedImage shadowOf(BufferedImage cutout, float opacity, int blurRadius) {
        int w = cutout.getWidth();
        int h = cutout.getHeight();
        int[] px = cutout.getRGB(0, 0, w, h, null, 0, w);
        for (int i = 0; i < px.length; i++) {
            int a = (int) (((px[i] >>> 24) & 0xFF) * opacity);
            px[i] = a << 24;
        }
        BufferedImage s = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        s.setRGB(0, 0, w, h, px, 0, w);
        return blur(s, blurRadius);
    }

    public record NormalizationResult(BufferedImage image, double score, double gainR, double gainG, double gainB) {
    }

    /** Normalização local (fallback do Cloudinary): balanço de branco gray-world + stretch de contraste 1–99 %. */
    public static NormalizationResult normalize(BufferedImage src) {
        int w = src.getWidth();
        int h = src.getHeight();
        int[] px = src.getRGB(0, 0, w, h, null, 0, w);
        double sr = 0;
        double sg = 0;
        double sb = 0;
        long n = 0;
        int[] hist = new int[256];
        for (int p : px) {
            if (((p >>> 24) & 0xFF) < 128) {
                continue;
            }
            int r = (p >> 16) & 0xFF;
            int g = (p >> 8) & 0xFF;
            int b = p & 0xFF;
            sr += r;
            sg += g;
            sb += b;
            hist[(r * 299 + g * 587 + b * 114) / 1000]++;
            n++;
        }
        if (n == 0) {
            return new NormalizationResult(src, 0.5, 1, 1, 1);
        }
        // Balanço de branco só faz sentido com uma referência neutra: numa foto já sem fundo (só a peça restou) a
        // média é a própria cor da roupa e o gray-world a empurraria para o cinza (camisa creme virava cinza, oliva
        // virava limão). Nesse caso o ganho é 1; com fundo presente, a referência é a moldura externa (mesa/fundo).
        boolean backgroundRemoved = n < px.length * 0.95;
        double gr = 1;
        double gg = 1;
        double gb = 1;
        double castBefore = 0;
        if (!backgroundRemoved) {
            double br = 0;
            double bg = 0;
            double bb = 0;
            long bn = 0;
            int frame = Math.max(2, (int) (Math.min(w, h) * 0.08));
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    if (x >= frame && x < w - frame && y >= frame && y < h - frame) {
                        continue;
                    }
                    int p = px[y * w + x];
                    br += (p >> 16) & 0xFF;
                    bg += (p >> 8) & 0xFF;
                    bb += p & 0xFF;
                    bn++;
                }
            }
            if (bn > 0) {
                double mr = br / bn;
                double mg = bg / bn;
                double mb = bb / bn;
                double gray = (mr + mg + mb) / 3;
                // gray-world atenuado sobre a moldura: ganho limitado a ±12 %.
                gr = limit(gray / Math.max(1, mr));
                gg = limit(gray / Math.max(1, mg));
                gb = limit(gray / Math.max(1, mb));
                castBefore = (Math.abs(mr - gray) + Math.abs(mg - gray) + Math.abs(mb - gray)) / 3 / 255;
            }
        }
        int lo = percentile(hist, n, 0.01);
        int hi = percentile(hist, n, 0.99);
        // Stretch de contraste só quando a foto está realmente "lavada" (faixa estreita por iluminação ruim, mas com
        // fundo presente). Uma peça lisa recortada tem faixa estreita por natureza — esticá-la inventa gradientes.
        boolean stretch = !backgroundRemoved && hi - lo < 200 && hi - lo > 40;
        if (!stretch) {
            lo = 0;
        }
        double range = stretch ? Math.max(120, hi - lo) : 255;
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            int a = (p >>> 24) & 0xFF;
            if (a == 0) {
                continue;
            }
            double r = (((p >> 16) & 0xFF) * gr - lo) * 255 / range;
            double g = (((p >> 8) & 0xFF) * gg - lo) * 255 / range;
            double b = ((p & 0xFF) * gb - lo) * 255 / range;
            px[i] = (a << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
        }
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        double score = Math.max(0, Math.min(1, 1 - castBefore * 2 + (range >= 180 ? 0.1 : 0)));
        return new NormalizationResult(out, Math.min(1, score), gr, gg, gb);
    }

    private static double limit(double gain) {
        return Math.max(0.88, Math.min(1.12, gain));
    }

    private static int percentile(int[] hist, long n, double p) {
        long target = (long) (n * p);
        long acc = 0;
        for (int i = 0; i < 256; i++) {
            acc += hist[i];
            if (acc >= target) {
                return i;
            }
        }
        return 255;
    }

    public static int clamp(double v) {
        return (int) Math.max(0, Math.min(255, Math.round(v)));
    }
}
