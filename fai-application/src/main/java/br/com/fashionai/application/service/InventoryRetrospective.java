package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.InventoryScoreRules.family;

/** DET-K01 — Retrospectiva do ano em cards 9:16 (o custo por uso fica só para a pessoa). */
final class InventoryRetrospective {
    private final PieceUsageDiaryEntryRepository diary;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;

    InventoryRetrospective(PieceUsageDiaryEntryRepository diary, WardrobeItemRepository pieces, SchemeRepository schemes) {
        this.diary = diary;
        this.pieces = pieces;
        this.schemes = schemes;
    }

    Map<String, Object> retrospective(CurrentUser user, int year) {
        List<PieceUsageDiaryEntry> entries = diary.findByUserIdAndUsedOnAfter(user.id(), LocalDate.of(year, 1, 1).minusDays(1)).stream()
                .filter(e -> e.getUsedOn().getYear() == year).toList();
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id());
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        Map<UUID, Long> uses = entries.stream().collect(Collectors.groupingBy(PieceUsageDiaryEntry::getWardrobeItemId, Collectors.counting()));
        List<Map<String, Object>> cards = new ArrayList<>();
        uses.entrySet().stream().max(Map.Entry.comparingByValue()).map(e -> byId.get(e.getKey())).filter(Objects::nonNull)
                .ifPresent(w -> cards.add(Map.of("type", "most_used", "title", Msg.t("inventoryScore.peca_mais_usada_do_ano"), "name", String.valueOf(w.getName()),
                        "value", uses.get(w.getId()) + " usos", "imageUrl", String.valueOf(w.getImageUrl()))));
        entries.stream().filter(e -> e.getNote() != null && e.getNote().startsWith("resgate")).map(e -> byId.get(e.getWardrobeItemId())).filter(Objects::nonNull)
                .findFirst().ifPresent(w -> cards.add(Map.of("type", "rescued", "title", Msg.t("inventoryScore.peca_resgatada_do_ano"), "name", String.valueOf(w.getName()),
                        "imageUrl", String.valueOf(w.getImageUrl()))));
        Map<String, Long> fam = entries.stream().map(e -> byId.get(e.getWardrobeItemId())).filter(Objects::nonNull).map(w -> family(w.getColor()))
                .filter(Objects::nonNull).collect(Collectors.groupingBy(f -> f, Collectors.counting()));
        fam.entrySet().stream().max(Map.Entry.comparingByValue()).ifPresent(e -> cards.add(Map.of("type", "color", "title", Msg.t("inventoryScore.sua_cor_do_ano"), "value", e.getKey())));
        long uniqueLooks = schemes.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(s -> s.getCreatedAt() != null && LocalDate.ofInstant(s.getCreatedAt(), FaiPointsService.ZONE).getYear() == year).count();
        cards.add(Map.of("type", "looks", "title", Msg.t("inventoryScore.looks_unicos_criados"), "value", uniqueLooks));
        cards.add(Map.of("type", "uses", "title", Msg.t("inventoryScore.usos_registrados"), "value", entries.size()));
        List<BigDecimal> cpu = all.stream().filter(w -> w.getPrice() != null && w.getWearCount() > 0)
                .map(w -> w.getPrice().divide(BigDecimal.valueOf(w.getWearCount()), 2, RoundingMode.HALF_UP)).toList();
        if (!cpu.isEmpty()) {
            BigDecimal avg = cpu.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(cpu.size()), 2, RoundingMode.HALF_UP);
            cards.add(Map.of("type", "cost_per_use", "title", Msg.t("inventoryScore.custo_medio_por_uso"), "value", avg, "privateOnly", true,
                    "note", Msg.t("inventoryScore.so_para_voce_nunca_no")));
        }
        cards.add(Map.of("type", "manifesto", "title", Msg.t("inventoryScore.vista_o_que_voce_tem_2"), "value", year));
        return Map.of("year", year, "format", "9:16", "cards", cards.stream().limit(8).toList());
    }
}
