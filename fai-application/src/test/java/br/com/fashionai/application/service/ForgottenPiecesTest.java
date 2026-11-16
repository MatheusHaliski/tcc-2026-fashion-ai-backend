package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização da régua de peça esquecida (era RoomService.forgotten/lastUse/FORGOTTEN_DAYS): 60 dias sem uso, só
 * peça disponível, e a última data de uso é a mais recente entre o diário e o lastWornDate.
 */
class ForgottenPiecesTest {
    private static final LocalDate HOJE = LocalDate.of(2026, 11, 15);

    private static WardrobeItem peca(LocalDate ultimoUso) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setDisponivel(true);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.setLastWornDate(ultimoUso);
        return w;
    }

    @Test
    void sessentaDiasSemUsoEhEsquecidaCinquentaENoveNao() {
        assertThat(ForgottenPieces.FORGOTTEN_DAYS).isEqualTo(60);
        assertThat(ForgottenPieces.forgotten(peca(null), HOJE.minusDays(60), HOJE)).isTrue();
        assertThat(ForgottenPieces.forgotten(peca(null), HOJE.minusDays(59), HOJE)).isFalse();
    }

    @Test
    void pecaIndisponivelNuncaEhEsquecida() {
        WardrobeItem w = peca(null);
        w.setDisponivel(false);
        w.setAvailabilityStatus(AvailabilityStatus.UNAVAILABLE);
        assertThat(ForgottenPieces.forgotten(w, HOJE.minusDays(400), HOJE)).isFalse();
    }

    @Test
    void ultimoUsoEhOMaisRecenteEntreDiarioELastWorn() {
        WardrobeItem w = peca(HOJE.minusDays(10));
        assertThat(ForgottenPieces.lastUse(w, Map.of())).isEqualTo(HOJE.minusDays(10));
        assertThat(ForgottenPieces.lastUse(w, Map.of(w.getId(), HOJE.minusDays(3)))).isEqualTo(HOJE.minusDays(3));
        assertThat(ForgottenPieces.lastUse(w, Map.of(w.getId(), HOJE.minusDays(30)))).isEqualTo(HOJE.minusDays(10));
        assertThat(ForgottenPieces.lastUse(peca(null), Map.of())).isNull();
    }
}
