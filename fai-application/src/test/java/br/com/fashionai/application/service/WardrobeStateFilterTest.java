package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Filtro de estado do closet (RF7): os valores que a tela manda (disponível / indisponível / à venda) filtram de fato. */
class WardrobeStateFilterTest {
    private static WardrobeItem item(boolean disponivel, boolean forSale, boolean favorite) {
        WardrobeItem w = new WardrobeItem();
        w.setDisponivel(disponivel);
        w.setForSale(forSale);
        w.setFavorite(favorite);
        return w;
    }

    @Test
    void disponivelEIndisponivelFiltramNoSingularENoPlural() {
        WardrobeItem on = item(true, false, false);
        WardrobeItem off = item(false, false, false);
        for (String s : new String[]{"disponivel", "disponiveis", "available"}) {
            assertTrue(WardrobeService.stateMatches(on, s), s);
            assertFalse(WardrobeService.stateMatches(off, s), s);
        }
        for (String s : new String[]{"indisponivel", "indisponiveis", "unavailable"}) {
            assertFalse(WardrobeService.stateMatches(on, s), s);
            assertTrue(WardrobeService.stateMatches(off, s), s);
        }
    }

    @Test
    void aVendaSoTrazPecasMarcadasNoFormulario() {
        assertTrue(WardrobeService.stateMatches(item(true, true, false), "venda"));
        assertTrue(WardrobeService.stateMatches(item(true, true, false), "a_venda"));
        assertFalse(WardrobeService.stateMatches(item(true, false, false), "venda"));
        assertTrue(WardrobeService.stateMatches(item(true, false, true), "favoritos"));
        assertTrue(WardrobeService.stateMatches(item(false, false, false), ""));
        assertTrue(WardrobeService.stateMatches(item(false, false, false), null));
    }
}
