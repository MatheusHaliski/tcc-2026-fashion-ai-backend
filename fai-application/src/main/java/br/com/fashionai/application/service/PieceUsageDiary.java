package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Leitura do diário de uso das peças (piece_usage_diary) para quem precisa da última data de uso: Copilot e desafios.
 * Morava no RoomService (Meu Quarto, retirado em 15/11/2026); a consulta é a mesma.
 */
@Component
public class PieceUsageDiary {
    private final PieceUsageDiaryEntryRepository diary;

    public PieceUsageDiary(PieceUsageDiaryEntryRepository diary) {
        this.diary = diary;
    }

    /** Última data registrada no diário para cada peça da pessoa, a partir de {@code since}. */
    public Map<UUID, LocalDate> lastDiaryDates(UUID userId, LocalDate since) {
        Map<UUID, LocalDate> out = new HashMap<>();
        for (PieceUsageDiaryEntry e : diary.findByUserIdAndUsedOnAfter(userId, since)) {
            out.merge(e.getWardrobeItemId(), e.getUsedOn(), (a, b) -> a.isAfter(b) ? a : b);
        }
        return out;
    }
}
