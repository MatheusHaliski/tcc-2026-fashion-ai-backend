package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.AvailabilityStatus;

/** Transição disponível/indisponível da peça: o booleano legado e o status andam juntos. */
public final class PieceAvailability {
    private PieceAvailability() {
    }

    public static void mark(WardrobeItem piece, boolean available) {
        piece.setDisponivel(available);
        piece.setAvailabilityStatus(available ? AvailabilityStatus.AVAILABLE : AvailabilityStatus.UNAVAILABLE);
    }
}
