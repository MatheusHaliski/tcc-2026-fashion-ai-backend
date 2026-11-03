package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import org.springframework.stereotype.Component;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.Shape;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Renderização do card do esquema (RF5 etapa 5 + RF11 etapa 4) em PNG para preview, compartilhamento
 * externo (RF19.CA09) e cache. Aplica o pipeline de filtros por peça (blur, saturation, brightness,
 * contrast, hue_shift), transformações (posição, escala, rotação, opacidade, zIndex) e as camadas do
 * Background Studio: Cor & Gradiente, Arte com AI (restrita à moldura — passe-partout) e presets AURA ×
 * material (fallback css-blend quando a combinação não tem arquivo). Dimensões RNF9: vestimenta compacto
 * 90 × 164 mm, ampliado 90 × 220 mm (anatomias_card_v17), a 10 px/mm.
 */
@Component
public class SchemeCardRenderer {
    public static final int PX_PER_MM = 10;

    private final SchemeCardBackground background;

    public SchemeCardRenderer(AssetCatalogService assets) {
        this.background = new SchemeCardBackground(assets);
    }

    public enum Size {
        COMPACT(90, 164), EXPANDED(90, 220);
        final int wMm;
        final int hMm;

        Size(int wMm, int hMm) {
            this.wMm = wMm;
            this.hMm = hMm;
        }
    }

    public record CardItem(BufferedImage image, SchemeSlot slot, Double x, Double y, double scale, double rotation,
                           double opacity, int zIndex, ImageFilters.Filters filters, String pieceBackground) {
    }

    public record Background(String color, List<String> gradientStops, double gradientAngle, boolean radial,
                             String auraVariantId, String materialId, BufferedImage aiArt, boolean passePartout,
                             String containerColor, String cardSkin) {
    }

    public record Card(String title, String owner, List<String> chips, String priceLabel, String hypeLabel,
                       Background background, List<CardItem> items, Size size) {
    }

    public byte[] render(Card card) {
        return ImageOps.png(renderImage(card));
    }

    public BufferedImage renderImage(Card card) {
        int W = card.size().wMm * PX_PER_MM;
        int H = card.size().hMm * PX_PER_MM;
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        ImageOps.quality(g);
        Shape cardShape = new RoundRectangle2D.Double(0, 0, W, H, 60, 60);
        g.setClip(cardShape);
        background.paintBackground(g, card.background(), W, H);

        int pad = 5 * PX_PER_MM;
        int headerH = 26 * PX_PER_MM;
        int footerH = 16 * PX_PER_MM;
        int cx = pad;
        int cy = headerH;
        int cw = W - 2 * pad;
        int ch = H - headerH - footerH - pad / 2;
        Color container = containerColor(card.background());
        boolean darkContainer = container == null ? luminance(background.averageBackground(card.background())) < 0.45
                : luminance(container.getRGB()) < 0.45;
        Color ink = darkContainer ? new Color(0xF5F3EF) : new Color(0x1A1714);
        Color bgInk = luminance(background.averageBackground(card.background())) < 0.5 ? new Color(0xFAF8F5) : new Color(0x1A1714);

        // cabeçalho
        g.setColor(bgInk);
        g.setFont(new Font(Font.SERIF, Font.BOLD, 58));
        drawClipped(g, card.title() == null ? Msg.t("common.sem_titulo") : card.title(), pad, 11 * PX_PER_MM, W - 2 * pad);
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 30));
        g.drawString("@" + (card.owner() == null ? "fashionai" : card.owner()), pad, 16 * PX_PER_MM);
        int chipX = pad;
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 24));
        for (String chip : card.chips() == null ? List.<String>of() : card.chips()) {
            int tw = g.getFontMetrics().stringWidth(chip) + 36;
            if (chipX + tw > W - pad) {
                break;
            }
            g.setColor(new Color(bgInk.getRed(), bgInk.getGreen(), bgInk.getBlue(), 40));
            g.fill(new RoundRectangle2D.Double(chipX, 18.5 * PX_PER_MM, tw, 46, 46, 46));
            g.setColor(bgInk);
            g.drawString(Msg.resolve(chip), chipX + 18, (int) (18.5 * PX_PER_MM) + 32);
            chipX += tw + 12;
        }

        // container (área de composição)
        RoundRectangle2D box = new RoundRectangle2D.Double(cx, cy, cw, ch, 44, 44);
        if (container != null) {
            g.setColor(new Color(container.getRed(), container.getGreen(), container.getBlue(), 240));
            g.fill(box);
        }
        Shape previous = g.getClip();
        g.clip(box);
        List<CardItem> items = new ArrayList<>(card.items());
        items.sort(Comparator.comparingInt(CardItem::zIndex));
        Map<SchemeSlot, Integer> slotCount = new EnumMap<>(SchemeSlot.class);
        for (CardItem item : items) {
            SchemeCardItems.drawItem(g, item, cx, cy, cw, ch, slotCount);
        }
        g.setClip(previous);
        g.setColor(new Color(ink.getRed(), ink.getGreen(), ink.getBlue(), 30));
        g.setStroke(new BasicStroke(2f));
        g.draw(box);

        // rodapé
        g.setColor(bgInk);
        g.setFont(new Font(Font.SERIF, Font.BOLD | Font.ITALIC, 38));
        g.drawString("Fashion AI", pad, H - 6 * PX_PER_MM);
        int brandW = g.getFontMetrics().stringWidth("Fashion AI");
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 30));
        String price = card.priceLabel() == null ? "" : Msg.resolve(card.priceLabel());
        int baseline = H - 6 * PX_PER_MM;
        int priceW = price.isEmpty() ? 0 : g.getFontMetrics().stringWidth(price);
        if (!price.isEmpty()) {
            g.drawString(price, W - pad - priceW, baseline);
        }
        if (card.hypeLabel() != null && !card.hypeLabel().isBlank()) {
            // RF53 — HypeScore v2 + faixa em texto num chip; sem espaço ao lado do preço, sobe para a linha de cima
            String hype = Msg.resolve(card.hypeLabel());
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 24));
            int chipW = g.getFontMetrics().stringWidth(hype) + 36;
            boolean sameLine = hypeFitsBeside(W, pad, brandW, priceW, chipW);
            int chipRight = sameLine ? W - pad - priceW - (priceW > 0 ? 18 : 0) : W - pad;
            int chipBase = sameLine ? baseline : baseline - 52;
            g.setColor(new Color(bgInk.getRed(), bgInk.getGreen(), bgInk.getBlue(), 40));
            g.fill(new RoundRectangle2D.Double(chipRight - chipW, chipBase - 32, chipW, 44, 44, 44));
            g.setColor(bgInk);
            g.drawString(hype, chipRight - chipW + 18, chipBase);
        }
        g.dispose();
        return img;
    }

    /** O chip do Hype cabe na linha do rodapé, entre a marca "Fashion AI" e o preço (com folga de 24 px de cada lado)? */
    public static boolean hypeFitsBeside(int width, int pad, int brandWidth, int priceWidth, int chipWidth) {
        int free = width - 2 * pad - brandWidth - priceWidth - (priceWidth > 0 ? 18 : 0) - 24;
        return chipWidth <= free;
    }

    /**
     * Container do esquema (RF11_PROPOSTA_CONTAINER_EDITORIAL_VS_AURA): origem INDEFINIDA → sem preenchimento
     * próprio (herda o fundo, só hairline); MANUAL → cor escolhida; AUTO (Direção recomendada) → cor nativa do
     * skin travada, com a arte virando passe-partout em volta. Retorna null quando não há preenchimento.
     */
    public Color containerColor(Background bg) {
        if (bg != null && bg.containerColor() != null && !bg.containerColor().isBlank()) {
            return new Color(ColorMath.parseHex(bg.containerColor()));
        }
        return null;
    }

    public static double luminance(int rgb) {
        double r = channel(((rgb >> 16) & 0xFF) / 255.0);
        double g = channel(((rgb >> 8) & 0xFF) / 255.0);
        double b = channel((rgb & 0xFF) / 255.0);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    private static double channel(double c) {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    public static double contrast(int a, int b) {
        double la = luminance(a);
        double lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    private static void drawClipped(Graphics2D g, String text, int x, int y, int maxW) {
        String t = text;
        while (g.getFontMetrics().stringWidth(t) > maxW && t.length() > 3) {
            t = t.substring(0, t.length() - 2);
        }
        g.drawString(Msg.resolve(t.equals(text) ? t : t + "…"), x, y);
    }
}
