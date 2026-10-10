package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.imaging.ImageOps;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

/**
 * BACKGROUND NORMALIZATION (só nível B, fonte com {@code allows_image_persistence}): o produto (máscara sem pessoa,
 * cabide e distratores) é recolocado no recorte semântico sobre fundo transparente (master), branco, neutro e card.
 * Nenhum pixel da peça é inventado: o que não é peça vira fundo; nada de inpainting, relighting ou preenchimento generativo.
 * A cor da peça é medida antes e depois (ΔE médio em Lab) e vira colorPreservationScore.
 */
public final class BackgroundNormalizer {
    public static final Color WHITE = Color.WHITE;
    public static final Color NEUTRAL = new Color(0xF4, 0xF3, 0xF1);
    public static final int CARD_WIDTH = 800;
    public static final int THUMB_WIDTH = 320;

    /** @param transparent master PNG 4:5 · @param colorPreservation 1 − ΔE/10 */
    public record Rendered(BufferedImage transparent, BufferedImage white, BufferedImage neutral, BufferedImage card,
                           BufferedImage thumbnail, double colorPreservation, int width, int height) {
    }

    /** null quando a peça não tem pixels para o master (IMAGE_TOO_SMALL). */
    public Rendered render(ProductSegmenter.Segmentation seg, NRect crop, double aspect) {
        double cx = crop.x() * seg.width(), cy = crop.y() * seg.height(), cw = crop.w() * seg.width(), ch = cw / aspect;
        int outW = DetailPreserver.masterWidth(cw);
        if (outW < 0) {
            return null;
        }
        BufferedImage product = seg.productOnly();
        BufferedImage canvas = new BufferedImage((int) Math.round(cw), (int) Math.round(ch), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        g.drawImage(product, (int) Math.round(-cx), (int) Math.round(-cy), null);
        g.dispose();
        int outH = (int) Math.round(outW / aspect);
        BufferedImage master = DetailPreserver.downscale(canvas, outW, outH);
        double color = colorPreservation(canvas, master);
        BufferedImage card = DetailPreserver.downscale(flatten(master, NEUTRAL), Math.min(CARD_WIDTH, outW), (int) Math.round(Math.min(CARD_WIDTH, outW) / aspect));
        BufferedImage thumb = DetailPreserver.downscale(card, THUMB_WIDTH, (int) Math.round(THUMB_WIDTH / aspect));
        return new Rendered(master, flatten(master, WHITE), flatten(master, NEUTRAL), card, thumb, color, outW, outH);
    }

    static BufferedImage flatten(BufferedImage img, Color bg) {
        BufferedImage out = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setColor(bg);
        g.fillRect(0, 0, img.getWidth(), img.getHeight());
        g.drawImage(img, 0, 0, null);
        g.dispose();
        return out;
    }

    /** ΔE76 entre a cor média (Lab) dos pixels opacos da peça antes e depois; 1 = idêntica, 0 = ΔE ≥ 10. */
    static double colorPreservation(BufferedImage before, BufferedImage after) {
        double[] a = meanLab(before), b = meanLab(after);
        if (a == null || b == null) {
            return 0;
        }
        double de = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
        return Math.max(0, 1 - de / 10);
    }

    static double[] meanLab(BufferedImage img) {
        BufferedImage s = ImageOps.scaleToFit(img, 400, 400);
        int[] px = s.getRGB(0, 0, s.getWidth(), s.getHeight(), null, 0, s.getWidth());
        double l = 0, a = 0, b = 0;
        long n = 0;
        for (int p : px) {
            if (((p >>> 24) & 0xFF) > 240) {
                double[] lab = ColorMath.lab(p);
                l += lab[0];
                a += lab[1];
                b += lab[2];
                n++;
            }
        }
        return n == 0 ? null : new double[]{l / n, a / n, b / n};
    }
}
