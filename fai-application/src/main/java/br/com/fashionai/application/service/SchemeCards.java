package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageFilters;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService.ItemForm;
import br.com.fashionai.application.service.SchemeService.SchemeForm;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Card PNG do look (RF5 preview / RF19.CA09): montagem do card a partir do look (peças, fundo por peça, chips, preço
 * em reais, Hype v2), peça sem foto legível como bloco de cor e a prévia da etapa 5 antes de salvar.
 */
final class SchemeCards {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final BackgroundStudioService studio;
    private final SchemeCardRenderer renderer;
    private final MediaService media;
    private final Guard guard;
    private final SchemeReads reads;
    private final SchemeHype hypeState;

    SchemeCards(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, UserRepository users,
                BackgroundStudioService studio, SchemeCardRenderer renderer, MediaService media, Guard guard, SchemeReads reads,
                SchemeHype hypeState) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.studio = studio;
        this.renderer = renderer;
        this.media = media;
        this.guard = guard;
        this.reads = reads;
        this.hypeState = hypeState;
    }

    byte[] renderCard(CurrentUser viewer, UUID id, boolean expanded) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        reads.requireView(viewer, s);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        boolean owner = viewer != null && viewer.id().equals(s.getUser().getId());
        return renderer.render(card(s, items, expanded,
                hypeState.cardHypeLabel(hypeState.currentHype(HypeEntityType.SCHEME, List.of(id)).get(id), owner)));
    }

    /** Card sem Hype (prévia da etapa 5: o look ainda não existe, então não tem sinais próprios). */
    SchemeCardRenderer.Card card(Scheme s, List<SchemeItem> items, boolean expanded) {
        return card(s, items, expanded, null);
    }

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
                : WardrobeService.humanize(w.getSubcategory() == null ? Msg.t("scheme.peca_2") : w.getSubcategory());
        g.drawString(Msg.resolve(label), 210 - g.getFontMetrics().stringWidth(label) / 2, 220);
        g.dispose();
        return img;
    }

    /** Preview da etapa 5 antes de salvar (nada é persistido). */
    byte[] preview(CurrentUser user, SchemeForm form) {
        Scheme s = new Scheme();
        s.setUser(users.findById(user.id()).orElseThrow());
        s.setTitle(form.title() == null ? Msg.t("scheme.pre_visualizacao") : form.title());
        s.setOccasion(Json.csv(form.occasion()));
        s.setStyle(Json.csv(form.style()));
        studio.requireAuraAccess(user, form.background());
        studio.applyToScheme(s, form.background(), Boolean.TRUE.equals(form.applyRecommendedDirection()));
        if (form.cardSkin() != null) {
            s.setCardSkin(form.cardSkin());
        }
        List<SchemeItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (ItemForm f : form.items() == null ? List.<ItemForm>of() : form.items()) {
            WardrobeItem w = pieces.findById(f.wardrobeItemId()).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            guard.requireOwner(user, w.getUser().getId(), "piece:" + w.getId());
            SchemeItem si = new SchemeItem();
            si.setWardrobeItem(w);
            si.setSlot(f.slot() != null ? f.slot() : LocalSchemeComposer.slotOf(w));
            si.setPositionX(f.positionX());
            si.setPositionY(f.positionY());
            si.setScale(f.scale() == null ? BigDecimal.ONE : f.scale());
            si.setRotation(f.rotation() == null ? BigDecimal.ZERO : f.rotation());
            si.setOpacity(f.opacity() == null ? BigDecimal.ONE : f.opacity());
            si.setZIndex(f.zIndex() == null ? items.size() : f.zIndex());
            si.setFiltersJson(f.filters() == null ? null : Json.write(f.filters()));
            items.add(si);
            total = total.add(w.getPrice() == null ? BigDecimal.ZERO : w.getPrice());
        }
        s.setTotalPrice(total);
        return renderer.render(card(s, items, false));
    }
}
