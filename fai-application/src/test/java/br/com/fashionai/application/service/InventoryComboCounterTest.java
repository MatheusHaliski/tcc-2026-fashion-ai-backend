package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Unidade extraída no lote GoF 08: regra pura de combinações válidas, chamada direto (sem o serviço Spring). */
class InventoryComboCounterTest {

    private static WardrobeItem piece(long id, String category, String occasions) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(new UUID(1L, id));
        w.setCategory(category);
        w.setOccasionTags(occasions);
        return w;
    }

    @Test
    void gruposDeOcasiaoMantemOrdemECodigosDaRubrica() {
        assertThat(InventoryComboCounter.OCCASION_GROUPS.keySet())
                .containsExactly("faculdade/trabalho", "casual", "social", "esporte", "festa");
        assertThat(InventoryComboCounter.OCCASION_GROUPS.get("esporte")).containsExactly("sport", "gym");
        assertThat(InventoryComboCounter.ENUMERATION_LIMIT).isEqualTo(400_000L);
    }

    @Test
    void ocasioesCompartilhadasIgnoramEspacosEOTerceiroOpcional() {
        WardrobeItem a = piece(1, "upper_piece", "casual, work ,party");
        WardrobeItem b = piece(2, "lower_piece", "work,party");
        WardrobeItem c = piece(3, "shoes_piece", "party");

        assertThat(InventoryComboCounter.occ(a)).containsExactlyInAnyOrder("casual", "work", "party");
        assertThat(InventoryComboCounter.shared(a, b, null)).containsExactlyInAnyOrder("work", "party");
        assertThat(InventoryComboCounter.shared(a, b, c)).containsExactly("party");
        assertThat(InventoryComboCounter.shareOccasion(a, b, c)).isTrue();
        assertThat(InventoryComboCounter.shareOccasion(a, piece(4, "shoes_piece", null), null)).isFalse();
    }

    @Test
    void portaDoServicoDelegaSemAlterarResultado() {
        List<WardrobeItem> pieces = List.of(piece(10, "upper_piece", "date"), piece(11, "lower_piece", "date"),
                piece(12, "shoes_piece", "date,gym"), piece(13, "full_body_piece", "gym"));

        var direto = InventoryComboCounter.count(pieces, 5, Set.of());
        var viaServico = InventoryScoreService.combos(pieces, 5, Set.of());

        assertThat(viaServico).isEqualTo(direto);
        assertThat(direto.total()).isEqualTo(2);
        assertThat(direto.coverage()).containsEntry("social", true).containsEntry("esporte", true).containsEntry("casual", false);
        assertThat(direto.sample()).hasSize(2);
    }

    @Test
    void entradaNaoEhAlterada() {
        WardrobeItem u = piece(20, "upper_piece", "casual");
        List<WardrobeItem> pieces = List.of(u, piece(21, "lower_piece", "casual"), piece(22, "shoes_piece", "casual"));

        InventoryComboCounter.count(pieces, 1, null);

        assertThat(u.getOccasionTags()).isEqualTo("casual");
        assertThat(InventoryComboCounter.occ(u)).containsExactly("casual");
    }
}
