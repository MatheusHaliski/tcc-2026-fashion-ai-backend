package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SchemeService.ItemForm;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.repository.SchemeItemRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF15 · composição do look por camadas: gravar o layout das peças já no look e a prévia do card com ele. */
final class SchemeLayout {
    private final SchemeItemRepository schemeItems;
    private final ProjectionService projections;
    private final SchemeCardRenderer renderer;
    private final Audit audit;
    private final SchemeReads reads;
    private final SchemeCards cards;

    SchemeLayout(SchemeItemRepository schemeItems, ProjectionService projections, SchemeCardRenderer renderer, Audit audit,
                 SchemeReads reads, SchemeCards cards) {
        this.schemeItems = schemeItems;
        this.projections = projections;
        this.renderer = renderer;
        this.audit = audit;
        this.reads = reads;
        this.cards = cards;
    }

    /**
     * RF15 · Composição do look por camadas: posição (centro, 0–1 do container), escala, rotação, opacidade e ordem
     * (zIndex) de cada peça já no look — os mesmos campos que o card usa. Só o dono edita; nada de cor, filtro ou
     * reconstrução aqui: a peça entra com a sua foto canônica (as edições do RF15 da peça acompanham). Peças fora do
     * look são ignoradas; nenhuma é adicionada ou removida por este caminho (isso é o editor do look, RF9).
     */
    Views.SchemeView updateLayout(CurrentUser user, UUID id, List<ItemForm> layout) {
        Scheme s = reads.owned(user, id);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        applyLayout(items, layout, true);
        for (SchemeItem si : items) {
            schemeItems.save(si);
        }
        projections.scheme(s, items);
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("layout", true));
        return reads.view(user, s, items);
    }

    /** Prévia (PNG do card ampliado) da composição com o layout dado, sem gravar — o mesmo render do card. */
    byte[] layoutPreview(CurrentUser user, UUID id, List<ItemForm> layout) {
        Scheme s = reads.owned(user, id);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        applyLayout(items, layout, false);
        return renderer.render(cards.card(s, items, true));
    }

    /** Aplica o layout por peça; {@code strict} recusa valores fora da faixa (gravação), a prévia só os prende. */
    static void applyLayout(List<SchemeItem> items, List<ItemForm> layout, boolean strict) {
        if (layout == null) {
            return;
        }
        for (ItemForm f : layout) {
            if (f.wardrobeItemId() == null) {
                continue;
            }
            SchemeItem si = items.stream().filter(i -> f.wardrobeItemId().equals(i.getWardrobeItem().getId())).findFirst().orElse(null);
            if (si == null) {
                continue;
            }
            if (strict && (outside(f.positionX(), 0, 1) || outside(f.positionY(), 0, 1) || outside(f.scale(), 0.2, 3)
                    || outside(f.rotation(), -180, 180) || outside(f.opacity(), 0.05, 1))) {
                throw ApiException.badRequest("LAYOUT_FORA_DA_FAIXA", Msg.t("scheme.layout_fora_da_faixa"));
            }
            si.setPositionX(f.positionX() == null ? null : clamp(f.positionX(), 0, 1));
            si.setPositionY(f.positionY() == null ? null : clamp(f.positionY(), 0, 1));
            si.setScale(f.scale() == null ? BigDecimal.ONE : clamp(f.scale(), 0.2, 3));
            si.setRotation(f.rotation() == null ? BigDecimal.ZERO : clamp(f.rotation(), -180, 180));
            si.setOpacity(f.opacity() == null ? BigDecimal.ONE : clamp(f.opacity(), 0.05, 1));
            if (f.zIndex() != null) {
                si.setZIndex(f.zIndex());
            }
            if (f.sortOrder() != null) {
                si.setSortOrder(f.sortOrder());
            }
        }
    }

    private static boolean outside(BigDecimal v, double min, double max) {
        return v != null && (v.doubleValue() < min - 1e-9 || v.doubleValue() > max + 1e-9);
    }

    private static BigDecimal clamp(BigDecimal v, double min, double max) {
        return BigDecimal.valueOf(Math.max(min, Math.min(max, v.doubleValue()))).setScale(4, java.math.RoundingMode.HALF_UP);
    }
}
