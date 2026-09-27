package br.com.fashionai.application.imaging;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.Random;

/**
 * "Fotos" de teste montadas com as artes de referência de /public/assets_pecas (fundo transparente): a peça é posta sobre
 * um fundo liso com leve ruído, na escala/posição/giro pedidos, e sai como JPEG — o que o celular mandaria.
 */
final class PieceTestPhotos {
    static final File ASSETS = new File("../public/assets_pecas");
    static final Color BACKDROP = new Color(236, 236, 232);

    private PieceTestPhotos() {
    }

    static boolean available() {
        return ASSETS.isDirectory();
    }

    static BufferedImage art(String path) throws IOException {
        return ImageOps.toArgb(ImageIO.read(new File(ASSETS, path)));
    }

    /**
     * @param fill fração do menor lado da foto ocupada pelo maior lado da arte · @param cx, cy centro da peça (0–1)
     */
    static BufferedImage canvas(BufferedImage piece, int w, int h, double fill, double cx, double cy, AffineTransform extra) {
        BufferedImage c = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = c.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(BACKDROP);
        g.fillRect(0, 0, w, h);
        Random r = new Random(1);
        for (int i = 0; i < w * h / 40; i++) {
            int v = Math.max(0, Math.min(255, BACKDROP.getRed() + r.nextInt(9) - 4));
            g.setColor(new Color(v, v, v));
            g.fillRect(r.nextInt(w), r.nextInt(h), 1, 1);
        }
        double s = fill * Math.min(w, h) / Math.max(piece.getWidth(), piece.getHeight());
        AffineTransform at = new AffineTransform();
        at.translate(w * cx, h * cy);
        if (extra != null) {
            at.concatenate(extra);
        }
        at.scale(s, s);
        at.translate(-piece.getWidth() / 2.0, -piece.getHeight() / 2.0);
        g.drawImage(piece, at, null);
        g.dispose();
        return c;
    }

    /**
     * Câmera girada no eixo vertical (fora dos 90°): perspectiva projetiva em que o lado direito fica com 1/(1+k) da
     * altura do esquerdo e encurtado na horizontal.
     */
    static BufferedImage yaw(BufferedImage src, double k) {
        int w = src.getWidth();
        int h = src.getHeight();
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setColor(BACKDROP);
        g.fillRect(0, 0, w, h);
        g.dispose();
        double cy = h / 2.0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                double up = x / (double) w;
                double u = up / (1 + k - k * up);
                int ix = (int) (u * w);
                int iy = (int) (cy + (y - cy) * (1 + k * u));
                if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
                    out.setRGB(x, y, src.getRGB(ix, iy));
                }
            }
        }
        return out;
    }

    static BufferedImage blur(BufferedImage img, int k) {
        float[] m = new float[k * k];
        Arrays.fill(m, 1f / (k * k));
        return new ConvolveOp(new Kernel(k, k, m), ConvolveOp.EDGE_NO_OP, null).filter(img, null);
    }

    static byte[] jpeg(BufferedImage img) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", out);
        return out.toByteArray();
    }

    static FlatLayPipeline.Result pipeline(BufferedImage photo) throws IOException {
        return new FlatLayPipeline(java.util.List.of(), java.util.List.of()).run(jpeg(photo), false);
    }

    static PhotoAcceptance.Report evaluate(String category, BufferedImage photo) throws IOException {
        FlatLayPipeline.Result r = pipeline(photo);
        return PhotoAcceptance.evaluate(category, r.originalWidth(), r.originalHeight(), r.cutout(), r.truncated(), r.quality());
    }
}
