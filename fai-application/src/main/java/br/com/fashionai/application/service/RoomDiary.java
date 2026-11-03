package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.RoomService.ZONE;

/** Meu Quarto — etiqueta da peça (DET-M02/M04) e Diário da Peça (DET-C07): usos registrados, custo por uso e últimas datas. */
final class RoomDiary {
    private final PieceUsageDiaryEntryRepository diary;
    private final WardrobeItemRepository pieces;
    private final ApplicationEventPublisher events;
    private final RoomMoves moves;
    private final RoomAddressing addressing;

    RoomDiary(RoomContext ctx) {
        this.diary = ctx.diary;
        this.pieces = ctx.pieces;
        this.events = ctx.events;
        this.moves = ctx.moves;
        this.addressing = ctx.addressing;
    }

    Set<UUID> usedRecently(UUID userId, LocalDate since) {
        return diary.findByUserIdAndUsedOnAfter(userId, since).stream().map(PieceUsageDiaryEntry::getWardrobeItemId).collect(Collectors.toSet());
    }

    Map<UUID, LocalDate> lastDiaryDates(UUID userId, LocalDate since) {
        Map<UUID, LocalDate> out = new HashMap<>();
        for (PieceUsageDiaryEntry e : diary.findByUserIdAndUsedOnAfter(userId, since)) {
            out.merge(e.getWardrobeItemId(), e.getUsedOn(), (a, b) -> a.isAfter(b) ? a : b);
        }
        return out;
    }

    // ================================================================== etiqueta da peça (DET-M02/M04/C07) e ilha (Atelier)
    Map<String, Object> pieceTag(CurrentUser user, UUID pieceId) {
        WardrobeItem w = moves.owned(user, pieceId);
        List<PieceUsageDiaryEntry> uses = diary.findByWardrobeItemIdOrderByUsedOnDesc(pieceId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("composition", w.getMaterial());
        m.put("care", w.getCareInstructions());
        m.put("origin", w.getPieceOrigin());
        m.put("garimpo", "GARIMPADA".equalsIgnoreCase(w.getPieceOrigin()));
        m.put("wearCount", w.getWearCount());
        m.put("thirtyWears", w.getWearCount() >= 30);
        m.put("costPerUse", w.getPrice() != null && w.getWearCount() > 0
                ? w.getPrice().divide(BigDecimal.valueOf(w.getWearCount()), 2, RoundingMode.HALF_UP) : null);
        m.put("costPerUseNote", Msg.t("room.custo_por_uso_so_para"));
        m.put("location", addressing.locate(user.id(), pieceId).map(l -> Map.of("address", l.address().toString(), "label", l.label())).orElse(null));
        m.put("diary", uses.stream().limit(60).map(e -> Map.of("date", e.getUsedOn(), "occasion", String.valueOf(e.getOccasion()),
                "note", String.valueOf(e.getNote()), "source", e.getSource(), "schemeId", String.valueOf(e.getSchemeId()))).toList());
        m.put("beforeAfter", Map.of("original", String.valueOf(w.getOriginalImageUrl()), "flatLay", String.valueOf(w.getImageUrl())));
        return m;
    }

    /** DET-C07 — Diário da Peça: registro manual de uso com data, ocasião e nota curta. */
    Map<String, Object> diaryEntry(CurrentUser user, UUID pieceId, LocalDate date, String occasion, String note) {
        WardrobeItem w = moves.owned(user, pieceId);
        LocalDate day = date == null ? LocalDate.now(ZONE) : date;
        if (day.isAfter(LocalDate.now(ZONE))) {
            throw ApiException.badRequest("DATA_FUTURA", Msg.t("room.o_diario_registra_usos_passados"));
        }
        if (occasion != null && !occasion.isBlank() && !Taxonomy.OCCASIONS.contains(occasion)) {
            throw ApiException.badRequest("OCASIAO_INVALIDA", Msg.t("room.ocasiao_fora_da_taxonomia"));
        }
        if (!diary.existsByWardrobeItemIdAndUsedOn(pieceId, day)) {
            PieceUsageDiaryEntry e = new PieceUsageDiaryEntry();
            e.setWardrobeItemId(pieceId);
            e.setUserId(user.id());
            e.setUsedOn(day);
            e.setOccasion(occasion);
            e.setNote(InputSanitizer.moderated("note", note == null ? "" : note, 160));
            e.setSource("MANUAL");
            diary.save(e);
            w.setWearCount(w.getWearCount() + 1);
            if (w.getLastWornDate() == null || day.isAfter(w.getLastWornDate())) {
                w.setLastWornDate(day);
            }
            pieces.save(w);
            events.publishEvent(new DomainEvents.PieceWorn(user.id(), pieceId, day, occasion));
        }
        return pieceTag(user, pieceId);
    }
}
