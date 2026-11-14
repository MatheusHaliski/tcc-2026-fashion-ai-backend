package br.com.fashionai.application.imaging;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

/**
 * Transparência antes da leitura: um PNG de fundo transparente guarda preto (RGB 0,0,0) nos pixels invisíveis, e quem lê
 * só a cor enxerga uma peça sobre fundo preto (cor "Preto", recorte preto, silhueta confundida com pessoa). A leitura
 * local e o FashionAI Lens achatam a foto sobre branco primeiro — o mesmo fundo que {@link ImageOps#jpeg} grava.
 */
public final class Transparency {
    private Transparency() {
    }

    /** A foto sobre fundo branco, opaca; sem nenhum pixel transparente, devolve a própria foto (sem cópia). */
    public static BufferedImage onWhite(BufferedImage photo) {
        if (photo == null || !hasTransparentPixel(photo)) {
            return photo;
        }
        BufferedImage out = new BufferedImage(photo.getWidth(), photo.getHeight(), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, out.getWidth(), out.getHeight());
        g.drawImage(photo, 0, 0, null);
        g.dispose();
        return out;
    }

    static boolean hasTransparentPixel(BufferedImage photo) {
        if (!photo.getColorModel().hasAlpha()) {
            return false;
        }
        int w = photo.getWidth();
        int[] row = new int[w];
        for (int y = 0; y < photo.getHeight(); y++) {
            photo.getRGB(0, y, w, 1, row, 0, w);
            for (int p : row) {
                if ((p >>> 24) < 255) {
                    return true;
                }
            }
        }
        return false;
    }
}
