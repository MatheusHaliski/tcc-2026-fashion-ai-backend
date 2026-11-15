package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

/**
 * Régua única de peça esquecida do app: sem uso há {@link #FORGOTTEN_DAYS} dias ou mais, contando da última data de uso
 * conhecida (diário + lastWornDate) ou, se nunca usada, do cadastro. Morava no RoomService (Meu Quarto, retirado em
 * 15/11/2026); Copilot, desafios, Inventory Score, Hype e insights continuam com a mesma régua.
 */
public final class ForgottenPieces {
    /** Esquecida: sem uso há 60+ dias. */
    public static final int FORGOTTEN_DAYS = 60;

    private ForgottenPieces() {
    }

    /** Última data de uso conhecida (diário + lastWornDate); null = nunca usada. */
    public static LocalDate lastUse(WardrobeItem w, Map<UUID, LocalDate> lastDiary) {
        LocalDate d = lastDiary.get(w.getId());
        LocalDate worn = w.getLastWornDate();
        if (d == null) {
            return worn;
        }
        return worn == null || d.isAfter(worn) ? d : worn;
    }

    /** Disponível e parada há {@link #FORGOTTEN_DAYS}+ dias desde {@code last} (ou desde o cadastro). */
    public static boolean forgotten(WardrobeItem w, LocalDate last, LocalDate today) {
        LocalDate ref = last != null ? last : w.getCreatedAt() == null ? today : LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE);
        return w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE
                && ChronoUnit.DAYS.between(ref, today) >= FORGOTTEN_DAYS;
    }
}
