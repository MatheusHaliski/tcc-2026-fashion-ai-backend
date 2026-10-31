package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.SchemeItemRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;

/**
 * Corpo da resposta do detalhe da peça (RF7): o retrato arquivado (RF7.CA03) ou a peça com os estilos de uso e os looks
 * de origem (RF19.CA14), só com os looks que quem pede consegue ver ({@code visible}). Visibilidade da peça, contagem
 * de visualização e sinal de Hype ficam no {@link WardrobeService#detail}.
 */
final class PieceDetailView {
    private final SchemeItemRepository schemeItems;
    private final Predicate<Scheme> visible;

    PieceDetailView(SchemeItemRepository schemeItems, Predicate<Scheme> visible) {
        this.schemeItems = schemeItems;
        this.visible = visible;
    }

    /** RF7.CA03 — snapshot do momento da publicação, marcado como "não mais disponível". */
    Map<String, Object> archived(WardrobeItem w, UUID id, UUID fromSchemeId) {
        Map<String, Object> out = new LinkedHashMap<>();
        SchemeItem snap = fromSchemeId == null ? null : schemeItems.findBySchemeIdOrderBySortOrder(fromSchemeId).stream()
                .filter(si -> si.getWardrobeItem().getId().equals(id) && visible.test(si.getScheme()))
                .findFirst().orElse(null);
        out.put("notAvailableAnymore", true);
        out.put("snapshot", snap == null ? Views.snapshot(w) : Json.map(snap.getSnapshotJson()));
        out.put("fromSchemeId", fromSchemeId);
        return out;
    }

    Map<String, Object> live(WardrobeItem w, UUID id, UUID fromSchemeId, boolean owner, Views.PieceView piece) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("piece", piece);
        out.put("fromSchemeId", fromSchemeId);
        out.put("wearstyles", Taxonomy.wearstylesOf(w.getCategory(), Json.csv(w.getOccasionTags())));
        // RF19.CA14 — "retornar": esquemas de origem que usaram esta peça.
        List<Map<String, Object>> origins = new ArrayList<>();
        for (SchemeItem si : schemeItems.findByWardrobeItemId(id)) {
            Scheme s = si.getScheme();
            if (visible.test(s)) {
                origins.add(Map.of("schemeId", s.getId(), "title", s.getTitle(), "coverImageUrl", String.valueOf(s.getCoverImageUrl())));
            }
        }
        out.put("originSchemes", origins);
        out.put("canEdit", owner);
        return out;
    }
}
