package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

/**
 * DETAIL PRESERVATION: só reduz, nunca amplia (sem super-resolução, sem nitidez artificial). Redução em passos de no
 * máximo 2× com interpolação bicúbica preserva costura, trama, bordado e logo. Quando a peça não tem pixels para o
 * tamanho mínimo do master, o resultado é IMAGE_TOO_SMALL, nunca um upscale.
 */
public final class DetailPreserver {
    public static final int MASTER_MAX_WIDTH = 1200;
    public static final int MASTER_MIN_WIDTH = 480;

    private DetailPreserver() {
    }

    /** Largura final do master: a do recorte, limitada a 1200; -1 quando abaixo do mínimo (IMAGE_TOO_SMALL). */
    public static int masterWidth(double cropPxWidth) {
        int w = (int) Math.min(MASTER_MAX_WIDTH, Math.floor(cropPxWidth));
        return w < MASTER_MIN_WIDTH ? -1 : w;
    }

    public static BufferedImage downscale(BufferedImage src, int w, int h) {
        if (w >= src.getWidth() && h >= src.getHeight()) {
            return src;
        }
        BufferedImage cur = src;
        while (cur.getWidth() / 2 > w && cur.getHeight() / 2 > h) {
            cur = step(cur, cur.getWidth() / 2, cur.getHeight() / 2);
        }
        return step(cur, w, h);
    }

    private static BufferedImage step(BufferedImage src, int w, int h) {
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        ImageOps.quality(g);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return out;
    }
}
