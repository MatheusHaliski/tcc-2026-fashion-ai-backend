package br.com.fashionai.application.imaging;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.LinearGradientPaint;
import java.awt.MultipleGradientPaint;
import java.awt.RadialGradientPaint;
import java.awt.Shape;
import java.awt.geom.AffineTransform;
import java.awt.geom.Point2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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

    private final AssetCatalogService assets;

    public SchemeCardRenderer(AssetCatalogService assets) {
        this.assets = assets;
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
        paintBackground(g, card.background(), W, H);

        int pad = 5 * PX_PER_MM;
        int headerH = 26 * PX_PER_MM;
        int footerH = 16 * PX_PER_MM;
        int cx = pad;
        int cy = headerH;
        int cw = W - 2 * pad;
        int ch = H - headerH - footerH - pad / 2;
        Color container = containerColor(card.background());
        boolean darkContainer = container == null ? luminance(averageBackground(card.background())) < 0.45
                : luminance(container.getRGB()) < 0.45;
        Color ink = darkContainer ? new Color(0xF5F3EF) : new Color(0x1A1714);
        Color bgInk = luminance(averageBackground(card.background())) < 0.5 ? new Color(0xFAF8F5) : new Color(0x1A1714);

        // cabeçalho
        g.setColor(bgInk);
        g.setFont(new Font(Font.SERIF, Font.BOLD, 58));
        drawClipped(g, card.title() == null ? "Sem título" : card.title(), pad, 11 * PX_PER_MM, W - 2 * pad);
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
            g.drawString(chip, chipX + 18, (int) (18.5 * PX_PER_MM) + 32);
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
            drawItem(g, item, cx, cy, cw, ch, slotCount);
        }
        g.setClip(previous);
        g.setColor(new Color(ink.getRed(), ink.getGreen(), ink.getBlue(), 30));
        g.setStroke(new BasicStroke(2f));
        g.draw(box);

        // rodapé
        g.setColor(bgInk);
        g.setFont(new Font(Font.SERIF, Font.BOLD | Font.ITALIC, 38));
        g.drawString("Fashion AI", pad, H - 6 * PX_PER_MM);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 30));
        String right = (card.hypeLabel() == null ? "" : card.hypeLabel() + "   ") + (card.priceLabel() == null ? "" : card.priceLabel());
        g.drawString(right, W - pad - g.getFontMetrics().stringWidth(right), H - 6 * PX_PER_MM);
        g.dispose();
        return img;
    }

    private void drawItem(Graphics2D g, CardItem item, int cx, int cy, int cw, int ch, Map<SchemeSlot, Integer> slotCount) {
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

    private void paintBackground(Graphics2D g, Background bg, int W, int H) {
        Color base = new Color(ColorMath.parseHex(bg == null || bg.color() == null ? "#F4EFE8" : bg.color()));
        g.setColor(base);
        g.fillRect(0, 0, W, H);
        if (bg == null) {
            return;
        }
        if (bg.gradientStops() != null && bg.gradientStops().size() >= 2) {
            Color[] colors = bg.gradientStops().stream().map(c -> new Color(ColorMath.parseHex(c))).toArray(Color[]::new);
            float[] fractions = new float[colors.length];
            for (int i = 0; i < colors.length; i++) {
                fractions[i] = i / (float) (colors.length - 1);
            }
            if (bg.radial()) {
                g.setPaint(new RadialGradientPaint(new Point2D.Double(W / 2.0, H * 0.4), Math.max(W, H) * 0.75f, fractions, colors));
            } else {
                double rad = Math.toRadians(bg.gradientAngle() - 90);
                double dx = Math.cos(rad) * W / 2;
                double dy = Math.sin(rad) * H / 2;
                g.setPaint(new LinearGradientPaint(new Point2D.Double(W / 2.0 - dx, H / 2.0 - dy),
                        new Point2D.Double(W / 2.0 + dx + 0.01, H / 2.0 + dy + 0.01), fractions, colors,
                        MultipleGradientPaint.CycleMethod.NO_CYCLE));
            }
            g.fillRect(0, 0, W, H);
        }
        loadAuraLayer(bg.auraVariantId()).ifPresent(aura -> drawCover(g, aura, W, H, 1f));
        loadMaterialLayer(bg.materialId()).ifPresent(mat -> drawCover(g, mat, W, H, bg.auraVariantId() == null ? 1f : 0.42f));
        if (bg.aiArt() != null) {
            if (bg.passePartout()) {
                // Arte com AI restrita à moldura externa ao container — efeito passe-partout.
                drawCover(g, bg.aiArt(), W, H, 1f);
            } else {
                drawCover(g, bg.aiArt(), W, H, 0.9f);
            }
        }
        g.setPaint(new GradientPaint(0, 0, new Color(0, 0, 0, 0), 0, H, new Color(0, 0, 0, 38)));
        g.fillRect(0, 0, W, H);
    }

    private Optional<BufferedImage> loadAuraLayer(String variantId) {
        if (variantId == null) {
            return Optional.empty();
        }
        return assets.auraVariant(variantId).map(v -> (Map<?, ?>) v.get("static")).flatMap(st -> {
            Object card = st == null ? null : st.get("cardUrl");
            Object url = st == null ? null : st.get("url");
            return read(card != null ? card.toString() : null).or(() -> read(url == null ? null : url.toString()));
        });
    }

    private Optional<BufferedImage> loadMaterialLayer(String materialId) {
        if (materialId == null) {
            return Optional.empty();
        }
        return assets.material(materialId).map(m -> (Map<?, ?>) m.get("static")).flatMap(st -> {
            Object card = st == null ? null : st.get("cardUrl");
            Object url = st == null ? null : st.get("url");
            return read(card != null ? card.toString() : null).or(() -> read(url == null ? null : url.toString()));
        });
    }

    private Optional<BufferedImage> read(String url) {
        Optional<Path> file = assets.publicFile(url);
        if (file.isEmpty()) {
            return Optional.empty();
        }
        try {
            BufferedImage img = ImageIO.read(file.get().toFile());
            return Optional.ofNullable(img).map(ImageOps::toArgb);
        } catch (IOException ex) {
            return Optional.empty();
        }
    }

    private static void drawCover(Graphics2D g, BufferedImage img, int W, int H, float alpha) {
        double s = Math.max(W / (double) img.getWidth(), H / (double) img.getHeight());
        int w = (int) Math.ceil(img.getWidth() * s);
        int h = (int) Math.ceil(img.getHeight() * s);
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, alpha));
        g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h, null);
        g.setComposite(AlphaComposite.SrcOver);
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

    private int averageBackground(Background bg) {
        if (bg == null) {
            return 0xF4EFE8;
        }
        if (bg.gradientStops() != null && !bg.gradientStops().isEmpty()) {
            int r = 0;
            int gg = 0;
            int b = 0;
            for (String s : bg.gradientStops()) {
                int c = ColorMath.parseHex(s);
                r += (c >> 16) & 0xFF;
                gg += (c >> 8) & 0xFF;
                b += c & 0xFF;
            }
            int n = bg.gradientStops().size();
            return ((r / n) << 16) | ((gg / n) << 8) | (b / n);
        }
        return ColorMath.parseHex(bg.color() == null ? "#F4EFE8" : bg.color());
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
        g.drawString(t.equals(text) ? t : t + "…", x, y);
    }
}
