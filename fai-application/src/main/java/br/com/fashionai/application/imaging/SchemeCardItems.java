package br.com.fashionai.application.imaging;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.imaging.SchemeCardRenderer.CardItem;
import br.com.fashionai.domain.model.enums.SchemeSlot;

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.util.Map;

/**
 * Peças no container do card: recorte, filtros, posição (do usuário ou padrão do slot), escala, rotação, opacidade,
 * sombra e fundo por peça.
 */
final class SchemeCardItems {
    private SchemeCardItems() {
    }

    static void drawItem(Graphics2D g, CardItem item, int cx, int cy, int cw, int ch, Map<SchemeSlot, Integer> slotCount) {
        if (item.image() == null) {
            return;
        }
        BufferedImage piece = ImageOps.crop(item.image(), ImageOps.alphaBounds(item.image()));
        piece = ImageFilters.apply(piece, item.filters());
        int n = slotCount.merge(item.slot(), 1, Integer::sum) - 1;
        double[] def = defaultPosition(item.slot(), n);
        double px = item.x() == null ? def[0] : item.x();
        double py = item.y() == null ? def[1] : item.y();
        double baseW = def[2] * cw * (item.scale() <= 0 ? 1 : item.scale());
        double baseH = def[3] * ch * (item.scale() <= 0 ? 1 : item.scale());
        double s = Math.min(baseW / piece.getWidth(), baseH / piece.getHeight());
        int w = Math.max(1, (int) (piece.getWidth() * s));
        int h = Math.max(1, (int) (piece.getHeight() * s));
        double centerX = cx + px * cw;
        double centerY = cy + py * ch;
        if (item.pieceBackground() != null) {
            g.setColor(new Color(ColorMath.parseHex(item.pieceBackground())));
            g.fill(new RoundRectangle2D.Double(centerX - w / 2.0 - 16, centerY - h / 2.0 - 16, w + 32, h + 32, 28, 28));
        }
        AffineTransform old = g.getTransform();
        g.rotate(Math.toRadians(item.rotation()), centerX, centerY);
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, (float) Math.max(0.05, Math.min(1, item.opacity()))));
        g.drawImage(ImageFilters.shadowOf(ImageOps.scale(piece, w, h), 0.2f, 8), (int) (centerX - w / 2.0) + 4, (int) (centerY - h / 2.0) + 8, null);
        g.drawImage(piece, (int) (centerX - w / 2.0), (int) (centerY - h / 2.0), w, h, null);
        g.setComposite(AlphaComposite.SrcOver);
        g.setTransform(old);
    }

    /** Layout padrão por slot quando o usuário não posicionou (x, y, largura, altura relativas ao container). */
    static double[] defaultPosition(SchemeSlot slot, int n) {
        return switch (slot) {
            case TOP -> new double[]{0.4, 0.26, 0.62, 0.36};
            case OUTERWEAR -> new double[]{0.62, 0.3, 0.55, 0.42};
            case BOTTOM -> new double[]{0.42, 0.62, 0.5, 0.42};
            case FULL_BODY -> new double[]{0.42, 0.45, 0.62, 0.78};
            case SHOES -> new double[]{0.72, 0.86, 0.36, 0.2};
            case ACCESSORY -> new double[]{0.8, 0.14 + 0.2 * (n % 4), 0.26, 0.18};
        };
    }
}
