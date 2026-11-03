package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.InventoryScoreService.Result;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.InventoryScoreRules.family;

/** RF34.CA06 — cards de Seus Destaques gerados dos dados reais, cada um com ação para ver a peça ou abrir no quarto. */
final class InventoryHighlightCards {
    private final WardrobeItemRepository pieces;
    private final StyleDnaRepository dnas;

    InventoryHighlightCards(WardrobeItemRepository pieces, StyleDnaRepository dnas) {
        this.pieces = pieces;
        this.dnas = dnas;
    }

    /** RF34.CA06 — até 6 cards gerados dos dados reais, cada um com ação para ver a peça ou abrir no quarto. */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> highlights(UUID userId, Result r) {
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(InventoryScoreRules::alive).toList();
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<Map<String, Object>> cards = new ArrayList<>();
        Map<String, Object> perCombos = (Map<String, Object>) r.metrics().getOrDefault("perPieceCombos", Map.of());
        perCombos.entrySet().stream().max(Comparator.comparingInt(e -> ((Number) e.getValue()).intValue()))
                .filter(e -> ((Number) e.getValue()).intValue() > 0).map(e -> byId.get(UUID.fromString(e.getKey()))).filter(Objects::nonNull)
                .ifPresent(w -> cards.add(card("🏆", Msg.t("inventoryScore.peca_mais_versatil"), w, Msg.t("inventoryScore.combinacoes", (perCombos.get(w.getId().toString()))))));
        Map<String, Object> usageCount = (Map<String, Object>) r.metrics().getOrDefault("usageCount", Map.of());
        usageCount.entrySet().stream().max(Comparator.comparingInt(e -> ((Number) e.getValue()).intValue()))
                .map(e -> byId.get(UUID.fromString(e.getKey()))).filter(Objects::nonNull)
                .ifPresent(w -> cards.add(card("❤️", Msg.t("inventoryScore.mais_usada"), w, Msg.t("inventoryScore.em_90_dias", (usageCount.get(w.getId().toString()))))));
        dnas.findByUserId(userId).map(StyleDna::getIconPieceName).filter(Objects::nonNull)
                .flatMap(name -> all.stream().filter(w -> name.equalsIgnoreCase(w.getName())).findFirst())
                .ifPresent(w -> cards.add(card("💎", Msg.t("inventoryScore.peca_icone"), w, Msg.t("inventoryScore.eleita_pelo_seu_dna_de"))));
        Map<String, Object> gaps = (Map<String, Object>) r.metrics().getOrDefault("rescueGaps", Map.of());
        gaps.entrySet().stream().max(Comparator.comparingLong(e -> ((Number) e.getValue()).longValue()))
                .map(e -> byId.get(UUID.fromString(e.getKey()))).filter(Objects::nonNull)
                .ifPresent(w -> cards.add(card("🔄", Msg.t("inventoryScore.melhor_retorno"), w, Msg.t("inventoryScore.dias_parada_look_s", (gaps.get(w.getId().toString())), usageCount.getOrDefault(w.getId().toString(), 1)))));
        List<WardrobeItem> a = all.stream().filter(InventoryScoreRules::available).toList();
        Map<String, Long> fam = a.stream().map(w -> family(w.getColor())).filter(Objects::nonNull).collect(Collectors.groupingBy(f -> f, Collectors.counting()));
        fam.entrySet().stream().max(Map.Entry.comparingByValue()).ifPresent(e -> cards.add(Map.of("emoji", "🎨", "title", Msg.t("inventoryScore.cor_assinatura"),
                "value", e.getKey() + " (" + Math.round(100.0 * e.getValue() / a.size()) + "%)", "actions", List.of(Map.of("label", Msg.t("inventoryScore.ver_pecas"), "filter", "color:" + e.getKey())))));
        Map<String, Long> cat = a.stream().map(WardrobeItem::getSubcategory).filter(Objects::nonNull).collect(Collectors.groupingBy(c -> c, Collectors.counting()));
        cat.entrySet().stream().max(Map.Entry.comparingByValue()).ifPresent(e -> cards.add(Map.of("emoji", "👕", "title", Msg.t("inventoryScore.categoria_dominante"),
                "value", e.getKey() + " (" + e.getValue() + ")", "actions", List.of(Map.of("label", Msg.t("inventoryScore.ver_pecas"), "filter", "subcategory:" + e.getKey())))));
        return cards.stream().limit(6).toList();
    }

    private static Map<String, Object> card(String emoji, String title, WardrobeItem w, String value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("emoji", emoji);
        m.put("title", title);
        m.put("pieceId", w.getId());
        m.put("name", w.getName());
        m.put("imageUrl", w.getImageUrl());
        m.put("value", value);
        m.put("actions", List.of(Map.of("label", Msg.t("inventoryScore.ver_peca"), "href", "/pieces/" + w.getId()),
                Map.of("label", Msg.t("inventoryScore.mostrar_no_quarto"), "action", "showInRoom", "pieceId", w.getId().toString())));
        return m;
    }
}
