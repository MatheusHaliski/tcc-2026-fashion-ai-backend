package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Provador (27/09): o lugar da peça vem da categoria gravada. Antes, a tela agrupava pela ordem de vestir (layerOf) e a
 * camisa aparecia em "Intermediária", o calçado junto com acessórios e a jaqueta em "Externa".
 */
class TryOnSlotsTest {
    private static WardrobeItem piece(String category, String sub) {
        WardrobeItem w = new WardrobeItem();
        w.setCategory(category);
        w.setSubcategory(sub);
        return w;
    }

    @Test
    void lugarPelaCategoria() {
        assertEquals("upper_piece", TryOnService.slotOf(piece("upper_piece", "polo_shirt")));   // camisa Lacoste: parte de cima
        assertEquals("upper_piece", TryOnService.slotOf(piece("upper_piece", "jacket")));       // jaqueta também é parte de cima
        assertEquals("lower_piece", TryOnService.slotOf(piece("lower_piece", "jeans")));
        assertEquals("shoes_piece", TryOnService.slotOf(piece("shoes_piece", "casual_sneakers")));
        assertEquals("accessory_piece", TryOnService.slotOf(piece("accessory_piece", "handbag")));
        assertEquals("upper_piece", TryOnService.slotOf(piece("full_body_piece", "dress")));    // peça inteira ocupa a parte de cima
    }

    @Test
    void categoriaDesconhecidaPedeRevisaoEmVezDeChutar() {
        assertNull(TryOnService.slotOf(piece(null, "t_shirt")));
        assertNull(TryOnService.slotOf(piece("camisas", "t_shirt")));
    }

    @Test
    void quatroLugaresNaOrdemDaTela() {
        assertEquals(java.util.List.of("upper_piece", "lower_piece", "shoes_piece", "accessory_piece"), TryOnService.SLOTS);
    }
}
