package br.com.fashionai.application.imaging;

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
            throw ApiException.badRequest("ARQUIVO_VAZIO", "Envie uma foto da peça.");
        }
        if (bytes.length > MAX_UPLOAD_BYTES) {
            throw ApiException.badRequest("ARQUIVO_GRANDE", "A foto tem mais de 10 MB. Reduza o tamanho e tente de novo.");
        }
        String mime = detectMime(bytes);
        if (mime == null) {
            throw ApiException.badRequest("FORMATO_INVALIDO", "Formato não aceito. Use JPG, PNG ou WebP.");
        }
        return mime;
    }

    public static BufferedImage decode(byte[] bytes) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
            if (img == null) {
                throw ApiException.badRequest("IMAGEM_ILEGIVEL", "Não conseguimos ler a imagem. Tente outra foto.");
            }
            return toArgb(img);
        } catch (IOException ex) {
            throw ApiException.badRequest("IMAGEM_ILEGIVEL", "Não conseguimos ler a imagem. Tente outra foto.");
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

    public record Cutout(BufferedImage image, double coverage, double confidence, int backgroundRgb) {
    }

    /**
     * Remoção de fundo local (fallback do rembg): estima a cor de fundo pela mediana da borda e faz flood
     * fill a partir das bordas com tolerância ΔE; suaviza a borda do recorte (feather 1 px).
     */
    public static Cutout removeBackgroundLocal(BufferedImage src) {
        BufferedImage img = scaleToFit(src, 1600, 1600);
        int w = img.getWidth();
        int h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        int bg = borderMedian(px, w, h);
        double[] bgLab = br.com.fashionai.application.ai.local.ColorMath.lab(bg);
        boolean[] background = new boolean[w * h];
        Deque<Integer> queue = new ArrayDeque<>();
        for (int x = 0; x < w; x++) {
            queue.add(x);
            queue.add((h - 1) * w + x);
        }
        for (int y = 0; y < h; y++) {
            queue.add(y * w);
            queue.add(y * w + w - 1);
        }
        double tolerance = 22;
        while (!queue.isEmpty()) {
            int i = queue.poll();
            if (background[i]) {
                continue;
            }
            int p = px[i];
            if (((p >>> 24) & 0xFF) < 16 || labDistance(bgLab, p) < tolerance) {
                background[i] = true;
                int x = i % w;
                int y = i / w;
                if (x > 0) {
                    queue.add(i - 1);
                }
                if (x < w - 1) {
                    queue.add(i + 1);
                }
                if (y > 0) {
                    queue.add(i - w);
                }
                if (y < h - 1) {
                    queue.add(i + w);
                }
            }
        }
        int fg = 0;
        double contrast = 0;
        for (int i = 0; i < px.length; i++) {
            if (background[i]) {
                px[i] = px[i] & 0x00FFFFFF;
            } else {
                fg++;
                contrast += Math.min(60, labDistance(bgLab, px[i]));
            }
        }
        feather(px, background, w, h);
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, px, 0, w);
        double coverage = fg / (double) px.length;
        double avgContrast = fg == 0 ? 0 : contrast / fg / 60.0;
        double confidence = coverage < 0.02 || coverage > 0.97 ? 0.2 : Math.min(0.95, 0.35 + avgContrast * 0.6);
        return new Cutout(out, coverage, confidence, bg);
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
            return 0;
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
        return Math.toDegrees(0.5 * Math.atan2(2 * cxy, cxx - cyy));
    }

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
