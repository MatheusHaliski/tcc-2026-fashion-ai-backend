package br.com.fashionai.application.laundry;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.laundry.LaundryBatch;
import br.com.fashionai.domain.model.laundry.PieceWearState;
import br.com.fashionai.domain.model.laundry.PieceWearStateLog;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Projeções do quadro de lavanderia: peça compacta, estado, lote e conflito com looks planejados. */
final class LaundryViews {
    private LaundryViews() {
    }

    static Map<String, Object> piece(WardrobeItem w, PieceWearState state) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", w.getId());
        out.put("name", w.getName());
        out.put("category", w.getCategory());
        out.put("thumbnailUrl", w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
        out.put("material", w.getMaterial());
        out.put("washCode", w.getTipoLavagem() == null ? null : w.getTipoLavagem().getCodigo());
        out.put("washName", w.getTipoLavagem() == null ? null : w.getTipoLavagem().getNome());
        out.put("careInstructions", w.getCareInstructions());
        out.put("disponivel", w.isDisponivel());
        out.put("archived", w.getAvailabilityStatus() == br.com.fashionai.domain.model.enums.AvailabilityStatus.ARCHIVED);
        out.put("wearState", state == null ? PieceWearState.CLEAN : state.getState());
        out.put("batchId", state == null ? null : state.getBatchId());
        out.put("changedAt", state == null ? null : state.getChangedAt());
        return out;
    }

    static Map<String, Object> batch(LaundryBatch b, List<Map<String, Object>> pieces) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", b.getId());
        out.put("status", b.getStatus());
        out.put("instructionCode", b.getInstructionCode());
        out.put("instructions", b.getInstructions());
        out.put("startedAt", b.getStartedAt());
        out.put("finishedAt", b.getFinishedAt());
        out.put("version", b.getVersion());
        out.put("pieces", pieces);
        return out;
    }

    static Map<String, Object> log(PieceWearStateLog l) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", l.getFromState());
        out.put("to", l.getToState());
        out.put("changedAt", l.getChangedAt());
        out.put("note", l.getNote());
        return out;
    }

    static Map<String, Object> conflict(java.time.LocalDate day, String eventLabel, UUID pieceId, String pieceName) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("day", day);
        out.put("eventLabel", eventLabel);
        out.put("pieceId", pieceId);
        out.put("pieceName", pieceName);
        return out;
    }
}
