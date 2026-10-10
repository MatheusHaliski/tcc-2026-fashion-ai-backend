package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import java.awt.image.BufferedImage;

/** dHash de 64 bits (gradiente horizontal entre médias de blocos numa grade 9×8): a mesma foto em outra URL/tamanho/compressão tem distância ≤ 6. */
public final class PerceptualHash {
    public static final int DUPLICATE_DISTANCE = 6;

    private PerceptualHash() {
    }

    public static String dHash(BufferedImage img) {
        double[][] g = blocks(flatten(img), 9, 8);
        long bits = 0;
        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
                bits = (bits << 1) | (g[y][x] > g[y][x + 1] + FLAT ? 1 : 0);
            }
        }
        return String.format("%016x", bits);
    }

    /** Diferença mínima (níveis de cinza) para o bit valer 1: fundo liso com ruído de câmera não vira bits aleatórios. */
    static final double FLAT = 2.0;

    /** Média de cinza por bloco (área), não amostragem: estável entre tamanhos e compressões da mesma foto. */
    static double[][] blocks(BufferedImage img, int cols, int rows) {
        BufferedImage s = ImageOps.scaleToFit(img, 288, 256);
        int w = s.getWidth(), h = s.getHeight();
        int[] px = s.getRGB(0, 0, w, h, null, 0, w);
        double[][] sum = new double[rows][cols];
        int[][] n = new int[rows][cols];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int by = Math.min(rows - 1, y * rows / h), bx = Math.min(cols - 1, x * cols / w);
                sum[by][bx] += gray(px[y * w + x]);
                n[by][bx]++;
            }
        }
        for (int y = 0; y < rows; y++) {
            for (int x = 0; x < cols; x++) {
                sum[y][x] /= Math.max(1, n[y][x]);
            }
        }
        return sum;
    }

    public static int distance(String a, String b) {
        if (a == null || b == null || a.length() != 16 || b.length() != 16) {
            return 64;
        }
        return Long.bitCount(Long.parseUnsignedLong(a, 16) ^ Long.parseUnsignedLong(b, 16));
    }

    /** Transparente vira branco antes do hash: o mesmo produto em PNG recortado e em JPEG de fundo branco bate. */
    static BufferedImage flatten(BufferedImage img) {
        if (!img.getColorModel().hasAlpha()) {
            return img;
        }
        BufferedImage out = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g = out.createGraphics();
        g.setColor(java.awt.Color.WHITE);
        g.fillRect(0, 0, img.getWidth(), img.getHeight());
        g.drawImage(img, 0, 0, null);
        g.dispose();
        return out;
    }

    private static int gray(int p) {
        return (((p >> 16) & 0xFF) * 299 + ((p >> 8) & 0xFF) * 587 + (p & 0xFF) * 114) / 1000;
    }
}
