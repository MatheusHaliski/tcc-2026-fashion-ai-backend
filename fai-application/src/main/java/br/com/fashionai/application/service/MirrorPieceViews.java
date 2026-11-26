package br.com.fashionai.application.service;

import br.com.fashionai.application.acervo.AcervoLugares;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Vista de uma peça do guarda-roupa no espelho (RF33): a mesma para o corpo (slots), a lista do espelho, a folha da parte
 * e as sugestões. Saiu do {@link MirrorService} (que só orquestra) sem mudar chave, ordem nem valor.
 */
final class MirrorPieceViews {
    private MirrorPieceViews() {
    }

    static Map<String, Object> pieceView(WardrobeItem w, Map<UUID, AcervoLugares.Lugar> where) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("color", w.getColor());
        m.put("colorHex", Taxonomy.hex(w.getColor()));
        m.put("imageUrl", w.getImageUrl());
        m.put("thumbnailUrl", w.getThumbnailUrl());
        m.put("studioImageUrl", w.getStudioImageUrl());
        // modelagem e dimensões da taxonomia: o espelho veste com o mesmo caimento do provador (classe, comprimentos)
        m.put("variation", w.getVariationCode());
        Map<String, List<String>> attrs = new LinkedHashMap<>();
        if (w.getAttributes() != null) {
            w.getAttributes().forEach(a -> attrs.computeIfAbsent(a.getDimensionCode(), k -> new ArrayList<>()).add(a.getValueCode()));
        }
        m.put("attributes", attrs);
        m.put("available", MirrorService.available(w));
        m.put("slot", MirrorService.slotOf(w));
        AcervoLugares.Lugar loc = where.get(w.getId());
        m.put("address", loc == null ? null : loc.compartimentoId().toString());
        m.put("addressLabel", loc == null ? null : loc.caminho());
        m.put("moduleId", loc == null ? null : loc.movelId().toString());
        // estado dos assets da peça (RF16 e foto): o espelho mostra "Modelo 3D", "Foto em processamento" etc. de verdade
        m.put("model3dUrl", w.getModel3dUrl());
        m.put("model3dStatus", w.getModel3dStatus() == null ? null : w.getModel3dStatus().name());
        m.put("photoProcessingStatus", w.getPhotoProcessingStatus() == null ? null : w.getPhotoProcessingStatus().name());
        return m;
    }
}
