package br.com.fashionai.application.imaging;

import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;

/**
 * Selo visível "gerada por IA" gravado na própria imagem (canto inferior direito): a foto recriada pela IA não pode
 * passar por foto real em lugar nenhum — nem fora do app, quando a imagem é baixada ou compartilhada. O card da peça
 * ainda mostra o selo pela flag {@code aiGeneratedImage}; este é o que acompanha o arquivo.
 */
public final class AiSeal {
    private AiSeal() {
    }

    /** Altura do selo em fração do lado menor da imagem, com piso em px para thumbnails pequenas. */
    static final double HEIGHT_RATIO = 0.075;
    static final int MIN_HEIGHT = 22;

    /** Cópia da imagem com o selo; a transparência (PNG recortado) é preservada. */
    public static BufferedImage stamp(BufferedImage src, String label) {
        int w = src.getWidth();
        int h = src.getHeight();
        BufferedImage out = new BufferedImage(w, h, src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.drawImage(src, 0, 0, null);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            int badgeH = Math.max(MIN_HEIGHT, (int) Math.round(Math.min(w, h) * HEIGHT_RATIO));
            Font font = new Font(Font.SANS_SERIF, Font.BOLD, Math.max(10, (int) Math.round(badgeH * 0.5)));
            g.setFont(font);
            FontMetrics fm = g.getFontMetrics();
            int pad = (int) Math.round(badgeH * 0.45);
            int badgeW = Math.min(w - 2, fm.stringWidth(label) + pad * 2);
            int margin = Math.max(4, (int) Math.round(badgeH * 0.35));
            int x = Math.max(1, w - badgeW - margin);
            int y = Math.max(1, h - badgeH - margin);
            RoundRectangle2D shape = new RoundRectangle2D.Double(x, y, badgeW, badgeH, badgeH * 0.6, badgeH * 0.6);
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.82f));
            g.setColor(new Color(17, 17, 17));
            g.fill(shape);
            g.setComposite(AlphaComposite.SrcOver);
            g.setColor(new Color(255, 255, 255, 200));
            g.setStroke(new BasicStroke(Math.max(1f, badgeH / 18f)));
            g.draw(shape);
            g.setColor(Color.WHITE);
            g.drawString(label, x + pad, y + (badgeH - fm.getHeight()) / 2 + fm.getAscent());
        } finally {
            g.dispose();
        }
        return out;
    }
}
