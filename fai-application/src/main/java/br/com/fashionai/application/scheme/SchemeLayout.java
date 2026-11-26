package br.com.fashionai.application.scheme;

import br.com.fashionai.application.service.SchemeService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageFilters;
import br.com.fashionai.application.imaging.MannequinGeometry;
import br.com.fashionai.domain.model.SchemeItem;

/**
 * RF15 · composição do look por camadas: posição (centro, 0–1 do container), escala, rotação, opacidade e ordem de cada
 * peça já no look. Puro; quem grava e quem só mostra a prévia é o {@link SchemeService}. Extraído do SchemeService.
 */
final class SchemeLayout {
    private SchemeLayout() {
    }

    /**
     * A peça do formulário no look: vaga (a da peça, sem escolha), camada do provador, ordem e camada de cima (a ordem de
     * entrada, sem valor), posição, escala 1, sem giro, opaca; filtros neutros não são gravados.
     */
    static void place(SchemeItem si, SchemeService.ItemForm f, int order) {
        si.setSlot(f.slot() != null ? f.slot() : LocalSchemeComposer.slotOf(si.getWardrobeItem()));
        si.setTryOnLayer(MannequinGeometry.layerOf(si.getSlot()));
        si.setSortOrder(f.sortOrder() == null ? order : f.sortOrder());
        si.setZIndex(f.zIndex() == null ? order : f.zIndex());
        si.setPositionX(f.positionX());
        si.setPositionY(f.positionY());
        si.setScale(f.scale() == null ? BigDecimal.ONE : f.scale());
        si.setRotation(f.rotation() == null ? BigDecimal.ZERO : f.rotation());
        si.setOpacity(f.opacity() == null ? BigDecimal.ONE : f.opacity());
        ImageFilters.Filters filters = ImageFilters.Filters.of(f.filters());
        si.setFiltersJson(filters.neutral() ? null : Json.write(Map.of("blur", filters.blur(), "saturation", filters.saturation(),
                "brightness", filters.brightness(), "contrast", filters.contrast(), "hue_shift", filters.hueShift())));
    }

    /** Aplica o layout por peça; {@code strict} recusa valores fora da faixa (gravação), a prévia só os prende. */
    static void apply(List<SchemeItem> items, List<SchemeService.ItemForm> layout, boolean strict) {
        if (layout == null) {
            return;
        }
        for (SchemeService.ItemForm f : layout) {
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
