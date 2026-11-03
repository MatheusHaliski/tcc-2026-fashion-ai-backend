package br.com.fashionai.application.imaging;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.imaging.SchemeCardRenderer.Background;

import javax.imageio.ImageIO;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.LinearGradientPaint;
import java.awt.MultipleGradientPaint;
import java.awt.RadialGradientPaint;
import java.awt.geom.Point2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;

/**
 * Camadas de fundo do card do esquema (Background Studio): cor, gradiente linear ou radial, presets AURA e material
 * lidos do catálogo de assets, arte com IA (passe-partout ou não) e a cor média usada para escolher a tinta do texto.
 */
final class SchemeCardBackground {
    private final AssetCatalogService assets;

    SchemeCardBackground(AssetCatalogService assets) {
        this.assets = assets;
    }

    void paintBackground(Graphics2D g, Background bg, int W, int H) {
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

    int averageBackground(Background bg) {
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
}
