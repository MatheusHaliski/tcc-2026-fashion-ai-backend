package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.repository.StyleDnaRepository;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Card PNG do DNA com marca d'água: só campos visíveis, link com validade de 30 dias.
 */
final class DnaCard {
    private final StyleDnaRepository dnas;
    private final MediaService media;

    DnaCard(StyleDnaRepository dnas, MediaService media) {
        this.dnas = dnas;
        this.media = media;
    }

    // ================================================================== card PNG com marca d'água (CA09 / RN07 / RN08)
    Map<String, Object> shareCard(CurrentUser user) {
        StyleDna d = dnas.findByUserId(user.id()).filter(x -> x.getSynthesizedAt() != null).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
        byte[] png = renderCard(d);
        MediaStoragePort.StoredObject stored = media.put("dna/" + user.id() + "/card-" + Instant.now().toEpochMilli() + ".png", png, "image/png");
        d.setCardImageUrl(stored.url());
        d.setCardExpiresAt(Instant.now().plus(30, ChronoUnit.DAYS));
        dnas.save(d);
        return Map.of("url", stored.url(), "expiresAt", d.getCardExpiresAt(), "watermark", "Fashion AI", "hiddenFields", Json.strings(d.getLifePrivateFieldsJson()));
    }

    byte[] renderCard(StyleDna d) {
        int w = 1080, h = 1350;
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        List<String> palette = Json.csv(d.getColorPalette());
        Color c1 = palette.isEmpty() ? new Color(0x2A211C) : color(palette.get(0));
        Color c2 = palette.size() > 1 ? color(palette.get(1)) : new Color(0xF57C1F);
        g.setPaint(new GradientPaint(0, 0, darken(c1), w, h, darken(c2)));
        g.fillRect(0, 0, w, h);
        g.setColor(new Color(245, 235, 215, 235));
        g.fillRoundRect(60, 60, w - 120, h - 120, 48, 48);
        g.setColor(new Color(0x1E1B18));
        g.setFont(new Font("Serif", Font.BOLD, 72));
        g.drawString(Msg.resolve(Msg.t("common.dna_de_estilo")), 110, 200);
        g.setFont(new Font("SansSerif", Font.PLAIN, 34));
        g.drawString(Msg.resolve(DnaViews.ARCHETYPE_LABEL.get(d.getArchetype()) + " · silhueta " + d.getSilhouette() + " · ousadia " + d.getBoldnessIndex()), 110, 260);
        int x = 110;
        for (String p : palette) {
            g.setColor(color(p));
            g.fillRoundRect(x, 310, 150, 150, 24, 24);
            g.setColor(new Color(0, 0, 0, 60));
            g.setStroke(new BasicStroke(2));
            g.drawRoundRect(x, 310, 150, 150, 24, 24);
            x += 172;
        }
        g.setColor(new Color(0x1E1B18));
        g.setFont(new Font("Serif", Font.ITALIC, 44));
        drawWrapped(g, "“" + d.getIdentityPhrase() + "”", 110, 560, w - 220, 58);
        g.setFont(new Font("SansSerif", Font.PLAIN, 32));
        g.drawString(Msg.resolve(Msg.t("dna.peca_icone", (d.getIconPieceName() == null ? "—" : d.getIconPieceName()))), 110, 900);
        Map<String, Object> life = Json.map(d.getLifeIdentityJson());
        List<String> hidden = Json.strings(d.getLifePrivateFieldsJson());
        int y = 960;
        for (String k : List.of("places", "people", "animals", "objects")) {
            if (hidden.contains(k) || !(life.get(k) instanceof List<?> l) || l.isEmpty()) {
                continue; // RN07 — campo privado nunca aparece na imagem
            }
            String label = switch (k) {
                case "places" -> "Lugares";
                case "people" -> "Pessoas";
                case "animals" -> "Animais";
                default -> "Objetos";
            };
            g.drawString(Msg.resolve(label + ": " + l.stream().map(String::valueOf).collect(Collectors.joining(" · "))), 110, y);
            y += 50;
        }
        g.setFont(new Font("SansSerif", Font.BOLD, 30));
        g.setColor(new Color(0xF57C1F));
        g.drawString(Msg.resolve(Msg.t("dna.fashion_ai_fai")), w - 360, h - 110);
        g.dispose();
        return ImageOps.png(img);
    }

    static Color color(String c) {
        String hex = c.startsWith("#") ? c : Taxonomy.hex(c);
        try {
            return new Color(ColorMath.parseHex(hex == null ? "#888888" : hex));
        } catch (RuntimeException ex) {
            return Color.GRAY;
        }
    }

    static Color darken(Color c) {
        return new Color((int) (c.getRed() * 0.6), (int) (c.getGreen() * 0.6), (int) (c.getBlue() * 0.6));
    }

    static void drawWrapped(Graphics2D g, String text, int x, int y, int width, int lh) {
        StringBuilder line = new StringBuilder();
        for (String word : text.split(" ")) {
            String test = line.isEmpty() ? word : line + " " + word;
            if (g.getFontMetrics().stringWidth(test) > width) {
                g.drawString(Msg.resolve(line.toString()), x, y);
                y += lh;
                line = new StringBuilder(word);
            } else {
                line = new StringBuilder(test);
            }
        }
        if (!line.isEmpty()) {
            g.drawString(Msg.resolve(line.toString()), x, y);
        }
    }
}
