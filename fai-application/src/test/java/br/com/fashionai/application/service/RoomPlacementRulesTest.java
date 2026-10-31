package br.com.fashionai.application.service;

import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Unidade pura extraída de {@link RoomService}: sem Spring, repositório nem relógio. */
class RoomPlacementRulesTest {

    private static WardrobeItem piece(String category, String sub) {
        WardrobeItem w = new WardrobeItem();
        w.setUser(new User());
        w.setCategory(category);
        w.setSubcategory(sub);
        return w;
    }

    @Test
    void ordemDasPortasComecaPelaPreferidaEPercorreAsSeis() {
        assertThat(RoomPlacementRules.hangerDoorOrder("full_body_piece", "dress")).containsExactly(4, 1, 2, 3, 5, 6);
        assertThat(RoomPlacementRules.hangerDoorOrder("upper_piece", "parka")).containsExactly(3, 1, 2, 4, 5, 6);
        assertThat(RoomPlacementRules.hangerDoorOrder("upper_piece", "hoodie")).containsExactly(2, 1, 3, 4, 5, 6);
        assertThat(RoomPlacementRules.hangerDoorOrder("upper_piece", "t_shirt")).containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(RoomPlacementRules.hangerDoorOrder("upper_piece", null)).containsExactly(1, 2, 3, 4, 5, 6);
        // peça inteira prevalece sobre o tipo de casaco
        assertThat(RoomPlacementRules.hangerDoorOrder("full_body_piece", "coat").getFirst()).isEqualTo(4);
    }

    @Test
    void aliasDoServicoApontaParaAMesmaRegra() {
        assertThat(RoomService.OUTERWEAR).isSameAs(RoomPlacementRules.OUTERWEAR);
        WardrobeItem bag = piece("accessory_piece", "tote_bag");
        RoomAddress bags = RoomAddress.of("bags", 1);
        assertThat(RoomService.coherent(bag, bags, Map.of())).isEqualTo(RoomPlacementRules.coherent(bag, bags, Map.of())).isTrue();
        for (String c : new String[]{"shoes_piece", "lower_piece", "accessory_piece", "upper_piece", null}) {
            assertThat(RoomService.drawerCapacity(c)).isEqualTo(RoomPlacementRules.drawerCapacity(c));
        }
    }

    @Test
    void regrasToleramCamposNulosSemLancar() {
        WardrobeItem blank = piece(null, null);
        assertThat(RoomPlacementRules.nz(null)).isEmpty();
        assertThat(RoomPlacementRules.preferredDrawerLabel(blank)).isNull();
        assertThat(RoomPlacementRules.coherent(blank, RoomAddress.of("drawer", 1), Map.of())).isFalse();
        assertThat(RoomPlacementRules.suggestLabel(List.of(blank), "Atual")).isEmpty();
        assertThat(RoomPlacementRules.suggestLabel(List.of(piece("lower_piece", "culottes")), null)).isEqualTo("Pantacourts");
    }
}
