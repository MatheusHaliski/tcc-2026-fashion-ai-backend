package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.InventoryScoreService.Result;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** DET-G01 — Álbum de Combinações: descobertas × possíveis e silhuetas das ainda não montadas. */
final class InventoryAlbum {
    private final WardrobeItemRepository pieces;

    InventoryAlbum(WardrobeItemRepository pieces) {
        this.pieces = pieces;
    }

    /** Álbum de Combinações (DET-G01) a partir da nota já calculada. */
    @SuppressWarnings("unchecked")
    Map<String, Object> album(Result r) {
        long total = ((Number) r.metrics().getOrDefault("validCombos", 0)).longValue();
        long discovered = ((Number) r.metrics().getOrDefault("discoveredCombos", 0)).longValue();
        List<List<String>> sample = (List<List<String>>) r.metrics().getOrDefault("undiscoveredSample", List.of());
        Set<UUID> ids = sample.stream().flatMap(List::stream).map(UUID::fromString).collect(Collectors.toSet());
        Map<UUID, WardrobeItem> byId = ids.isEmpty() ? Map.of() : pieces.findByIdIn(ids).stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<Map<String, Object>> silhouettes = sample.stream().map(combo -> Map.<String, Object>of("pieceIds", combo,
                "pieces", combo.stream().map(id -> byId.get(UUID.fromString(id))).filter(Objects::nonNull)
                        .map(w -> Map.of("id", w.getId(), "name", String.valueOf(w.getName()), "category", String.valueOf(w.getCategory()))).toList(),
                "action", "montar_no_espelho")).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("discovered", Math.min(discovered, total));
        out.put("percent", total == 0 ? 0 : Math.round(100.0 * Math.min(discovered, total) / total));
        out.put("message", total == 0 ? Msg.t("inventoryScore.cadastre_ocasioes_nas_pecas_para")
                : Msg.t("inventoryScore.voce_descobriu_das_combinacoes_possiveis", Math.round(100.0 * Math.min(discovered, total) / total)));
        out.put("undiscovered", silhouettes);
        out.put("enumerated", r.metrics().get("combosEnumerated"));
        return out;
    }
}
