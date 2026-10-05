package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.Random;

/**
 * Fixtures visuais sintéticas do pipeline de imagens do catálogo: fotos "de loja" (fundo claro com leve ruído de
 * câmera, peça desenhada) em JPEG, sem depender de foto real nem de rede. Cada fixture reproduz um caso do gate.
 */
final class CatalogPhotos {
    static final Color NAVY = new Color(0x1F, 0x3A, 0x6B);
    static final Color DENIM = new Color(0x3B, 0x5B, 0x8C);
    static final Color RED = new Color(0xB0, 0x22, 0x2A);
    static final Color SKIN = new Color(0xE0, 0xAC, 0x8A);

    private CatalogPhotos() {
    }

    static BufferedImage studio(int w, int h, int bg) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Random r = new Random(42);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int n = r.nextInt(5) - 2, c = Math.max(0, Math.min(255, bg + n));
                img.setRGB(x, y, (c << 16) | (c << 8) | c);
            }
        }
        return img;
    }

    static Graphics2D pen(BufferedImage img, Color c) {
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(c);
        return g;
    }

    /** Camiseta centralizada num quadro 1000×1000 (packshot clássico, peça ocupando ~60%). */
    static BufferedImage tee(int ox, int oy, double s) {
        BufferedImage img = studio(1000, 1000, 246);
        drawTee(img, ox, oy, s, NAVY);
        return img;
    }

    static void drawTee(BufferedImage img, int ox, int oy, double s, Color c) {
        Graphics2D g = pen(img, c);
        int[] xs = {0, 180, 220, 300, 380, 420, 600, 560, 470, 470, 130, 130, 40};
        int[] ys = {90, 0, 0, 40, 0, 0, 90, 230, 190, 600, 600, 190, 230};
        Polygon p = new Polygon();
        for (int i = 0; i < xs.length; i++) {
            p.addPoint(ox + (int) (xs[i] * s), oy + (int) (ys[i] * s));
        }
        g.fillPolygon(p);
        g.dispose();
    }

    static BufferedImage jeans() {
        BufferedImage img = studio(900, 1200, 244);
        Graphics2D g = pen(img, DENIM);
        g.fillRect(270, 120, 360, 330);
        g.fillPolygon(new Polygon(new int[]{270, 440, 420, 300}, new int[]{440, 440, 1080, 1080}, 4));
        g.fillPolygon(new Polygon(new int[]{460, 630, 600, 480}, new int[]{440, 440, 1080, 1080}, 4));
        g.dispose();
        return img;
    }

    static BufferedImage sneakers() {
        BufferedImage img = studio(1200, 900, 245);
        Graphics2D g = pen(img, RED);
        g.fillPolygon(new Polygon(new int[]{150, 1020, 1020, 760, 480, 150}, new int[]{640, 640, 300, 310, 440, 520}, 6));
        g.setColor(Color.WHITE.darker());
        g.fillRect(150, 640, 870, 40);
        g.dispose();
        return img;
    }

    static BufferedImage watch() {
        BufferedImage img = studio(1000, 1000, 247);
        Graphics2D g = pen(img, new Color(0x30, 0x30, 0x30));
        g.fillRect(450, 120, 100, 760);
        g.fillOval(360, 380, 280, 280);
        g.dispose();
        return img;
    }

    /** Camiseta com o gancho do cabide (barra fina acima da gola). */
    static BufferedImage teeOnHanger() {
        BufferedImage img = tee(200, 260, 1.0);
        Graphics2D g = pen(img, new Color(0x40, 0x40, 0x40));
        g.fillRect(495, 150, 12, 160);   // encosta no decote (y=300): mesmo componente da peça
        g.dispose();
        return img;
    }

    /** Camiseta e, no canto, outro objeto (caixa de sapato / adereço) separado da peça. */
    static BufferedImage teeWithProp() {
        BufferedImage img = tee(80, 180, 0.95);
        Graphics2D g = pen(img, new Color(0x9A, 0x6B, 0x2F));
        g.fillRect(760, 760, 200, 200);
        g.dispose();
        return img;
    }

    /** Pessoa vestindo: pescoço, rosto e braços (pele) colados na camiseta. */
    static BufferedImage teeOnPerson() {
        BufferedImage img = studio(1000, 1200, 240);
        Graphics2D g = pen(img, SKIN);
        g.fillOval(420, 20, 160, 200);
        g.fillRect(465, 200, 70, 90);
        g.fillRect(150, 470, 70, 380);
        g.fillRect(780, 470, 70, 380);
        g.dispose();
        drawTee(img, 200, 260, 1.0, NAVY);
        return img;
    }

    /** Camiseta que já vem cortada embaixo na foto original. */
    static BufferedImage teeCutAtBottom() {
        return tee(200, 500, 1.0);
    }

    static byte[] jpeg(BufferedImage img) {
        return ImageOps.jpeg(img, 0.92f);
    }

    static byte[] png(BufferedImage img) {
        return ImageOps.png(img);
    }
}
