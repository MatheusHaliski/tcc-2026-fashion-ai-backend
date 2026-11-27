package br.com.fashionai.application.scheme;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemeCards {
    private final UserRepository users;
    private final WardrobeItemRepository pieces;
    private final Guard guard;
    private final BackgroundStudioService studio;
    private final SchemeItemRepository schemeItems;
    private final SchemeCardRenderer renderer;
    private final ProjectionService projections;
    private final Audit audit;
    private final SchemeAccess access;
    private final SchemeQueries queries;
    private final SchemeHype hype;
    private final SchemeCardAssembler cards;

    public SchemeCards(UserRepository users, WardrobeItemRepository pieces, Guard guard, BackgroundStudioService studio,
                       SchemeItemRepository schemeItems, SchemeCardRenderer renderer, ProjectionService projections,
                       Audit audit, SchemeAccess access, SchemeQueries queries, SchemeHype hype, MediaService media) {
        this.users = users;
        this.pieces = pieces;
        this.guard = guard;
        this.studio = studio;
        this.schemeItems = schemeItems;
        this.renderer = renderer;
        this.projections = projections;
        this.audit = audit;
        this.access = access;
        this.queries = queries;
        this.hype = hype;
        this.cards = new SchemeCardAssembler(media, studio);
    }

    public byte[] renderCard(CurrentUser viewer, UUID id, boolean expanded) {
        Scheme s = access.find(id);
        access.requireView(viewer, s);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        boolean owner = viewer != null && viewer.id().equals(s.getUser().getId());
        return renderer.render(cards.card(s, items, expanded, hype.cardHypeLabel(hype.currentHype(HypeEntityType.SCHEME, List.of(id)).get(id), owner)));
    }

    /** Preview da etapa 5 antes de salvar (nada é persistido). */
    public byte[] preview(CurrentUser user, SchemeForm form) {
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
            SchemeLayout.place(si, f, items.size());
            items.add(si);
            total = total.add(w.getPrice() == null ? BigDecimal.ZERO : w.getPrice());
        }
        s.setTotalPrice(total);
        return renderer.render(cards.card(s, items, false, null));
    }

    /**
     * RF15 · Composição do look por camadas: posição (centro, 0–1 do container), escala, rotação, opacidade e ordem
     * (zIndex) de cada peça já no look — os mesmos campos que o card usa. Só o dono edita; nada de cor, filtro ou
     * reconstrução aqui: a peça entra com a sua foto canônica (as edições do RF15 da peça acompanham). Peças fora do
     * look são ignoradas; nenhuma é adicionada ou removida por este caminho (isso é o editor do look, RF9).
     */
    public Views.SchemeView updateLayout(CurrentUser user, UUID id, List<ItemForm> layout) {
        Scheme s = access.owned(user, id);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        SchemeLayout.apply(items, layout, true);
        for (SchemeItem si : items) {
            schemeItems.save(si);
        }
        projections.scheme(s, items);
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("layout", true));
        return queries.view(user, s, items);
    }

    /** Prévia (PNG do card ampliado) da composição com o layout dado, sem gravar — o mesmo render do card. */
    public byte[] layoutPreview(CurrentUser user, UUID id, List<ItemForm> layout) {
        Scheme s = access.owned(user, id);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        SchemeLayout.apply(items, layout, false);
        return renderer.render(cards.card(s, items, true, null));
    }
}
