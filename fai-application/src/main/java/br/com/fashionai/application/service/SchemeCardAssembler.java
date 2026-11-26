package br.com.fashionai.application.service;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageFilters;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeLevel;

/**
 * O card do look em imagem (RF5 preview / RF19.CA09): as peças com foto (ou o bloco de cor), posição, filtros, chips,
 * preço em reais e o rótulo do Hype. Lê as fotos e o fundo do estúdio; a autorização e a busca do look ficam no
 * {@link SchemeService}. Extraído do SchemeService.
 */
final class SchemeCardAssembler {
    private final MediaService media;
    private final BackgroundStudioService studio;

    SchemeCardAssembler(MediaService media, BackgroundStudioService studio) {
        this.media = media;
        this.studio = studio;
    }

    /** "HypeScore 72 · Em alta"; sem dados ou sem permissão de ver, nada (nunca "0"). */
    static String hypeLabel(BigDecimal score, HypeLevel level, boolean visible) {
        if (!visible || score == null || level == null) {
            return null;
        }
        return Msg.t("schemeHype.card", score.setScale(0, java.math.RoundingMode.HALF_UP), Msg.t("schemeHype.level." + level.name()));
    }

    /** O card do look para o renderer; {@code hypeLabel} nulo na prévia (o look ainda não existe, não tem sinais). */
    SchemeCardRenderer.Card card(Scheme s, List<SchemeItem> items, boolean expanded, String hypeLabel) {
        List<SchemeCardRenderer.CardItem> cardItems = new ArrayList<>();
        Map<String, Object> studioCfg = Json.map(s.getStudioConfigJson());
        Map<?, ?> pieceBgs = studioCfg.get("pieces") instanceof Map<?, ?> p ? p : Map.of();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            BufferedImage img = media.readImage(w.getImageUrl()).orElseGet(() -> placeholder(w));
            Object bgCfg = pieceBgs.get(w.getId().toString());
            String pieceBg = bgCfg instanceof Map<?, ?> m && m.get("color") != null ? String.valueOf(m.get("color")) : null;
            cardItems.add(new SchemeCardRenderer.CardItem(img, si.getSlot(),
                    si.getPositionX() == null ? null : si.getPositionX().doubleValue(),
                    si.getPositionY() == null ? null : si.getPositionY().doubleValue(),
                    si.getScale() == null ? 1 : si.getScale().doubleValue(), si.getRotation() == null ? 0 : si.getRotation().doubleValue(),
                    si.getOpacity() == null ? 1 : si.getOpacity().doubleValue(), si.getZIndex(),
                    ImageFilters.Filters.of(Json.map(si.getFiltersJson())), pieceBg));
        }
        List<String> chips = new ArrayList<>(Json.csv(s.getOccasion()));
        chips.addAll(Json.csv(s.getStyle()));
        // Preços são em reais: o PNG usa a mesma moeda das telas, formatada no idioma de quem pediu a imagem.
        java.text.NumberFormat brl = java.text.NumberFormat.getCurrencyInstance(Msg.locale());
        brl.setCurrency(java.util.Currency.getInstance("BRL"));
        String price = s.getTotalPrice() == null ? null : brl.format(s.getTotalPrice());
        // o Hype do PNG é o v2 do look (cardHypeLabel); a coluna v1 schemes.hype_score não entra mais na imagem
        return new SchemeCardRenderer.Card(s.getTitle(), s.getUser().getUsername(), chips, price, hypeLabel, studio.rendererBackground(s),
                cardItems, expanded ? SchemeCardRenderer.Size.EXPANDED : SchemeCardRenderer.Size.COMPACT);
    }

    /** Peça sem foto legível (ex.: imagem padrão SVG): bloco com a cor da peça e a subcategoria. */
    static BufferedImage placeholder(WardrobeItem w) {
        BufferedImage img = new BufferedImage(420, 420, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        ImageOps.quality(g);
        g.setColor(new Color(ColorMath.parseHex(Taxonomy.hex(w.getColor()))));
        g.fill(new RoundRectangle2D.Double(10, 10, 400, 400, 60, 60));
        g.setColor(ColorMath.isNeutral(w.getColor()) && Taxonomy.hex(w.getColor()).compareTo("#888888") > 0 ? Color.DARK_GRAY : Color.WHITE);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 34));
        // Nome da peça (escrito pelo usuário) em vez do código da subcategoria, que é em inglês.
        String label = w.getName() != null && !w.getName().isBlank() ? (w.getName().length() > 22 ? w.getName().substring(0, 21) + "…" : w.getName())
                : br.com.fashionai.application.wardrobe.PiecePrefill.humanize(w.getSubcategory() == null ? Msg.t("scheme.peca_2") : w.getSubcategory());
        g.drawString(Msg.resolve(label), 210 - g.getFontMetrics().stringWidth(label) / 2, 220);
        g.dispose();
        return img;
    }
}
