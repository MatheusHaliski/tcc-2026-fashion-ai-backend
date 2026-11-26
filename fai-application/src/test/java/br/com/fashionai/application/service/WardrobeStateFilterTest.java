package br.com.fashionai.application.service;

import br.com.fashionai.application.wardrobe.ClosetQuery;
import org.junit.jupiter.api.Test;

import br.com.fashionai.application.wardrobe.PieceFormWriter;
import br.com.fashionai.domain.model.WardrobeItem;

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
            assertTrue(ClosetQuery.stateMatches(on, s), s);
            assertFalse(ClosetQuery.stateMatches(off, s), s);
        }
        for (String s : new String[]{"indisponivel", "indisponiveis", "unavailable"}) {
            assertFalse(ClosetQuery.stateMatches(on, s), s);
            assertTrue(ClosetQuery.stateMatches(off, s), s);
        }
    }

    @Test
    void aVendaSoTrazPecasMarcadasNoFormulario() {
        assertTrue(ClosetQuery.stateMatches(item(true, true, false), "venda"));
        assertTrue(ClosetQuery.stateMatches(item(true, true, false), "a_venda"));
        assertFalse(ClosetQuery.stateMatches(item(true, false, false), "venda"));
        assertTrue(ClosetQuery.stateMatches(item(true, false, true), "favoritos"));
        assertTrue(ClosetQuery.stateMatches(item(false, false, false), ""));
        assertTrue(ClosetQuery.stateMatches(item(false, false, false), null));
    }

    @Test
    void paraDoarFiltraEEExclusivoComAVenda() {
        WardrobeItem w = item(true, true, false);
        PieceFormWriter.applyListing(w, null, true);   // marcar "para doar" tira de "à venda"
        assertTrue(w.isForDonation());
        assertFalse(w.isForSale());
        for (String s : new String[]{"doar", "para_doar", "for_donation"}) {
            assertTrue(ClosetQuery.stateMatches(w, s), s);
        }
        assertFalse(ClosetQuery.stateMatches(w, "venda"));
        PieceFormWriter.applyListing(w, true, null);   // e o contrário
        assertTrue(w.isForSale());
        assertFalse(w.isForDonation());
        assertFalse(ClosetQuery.stateMatches(w, "doar"));
        PieceFormWriter.applyListing(w, false, null);  // desmarcar não liga o outro
        assertFalse(w.isForSale());
        assertFalse(w.isForDonation());
    }
}
