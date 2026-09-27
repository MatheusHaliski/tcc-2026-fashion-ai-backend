package br.com.fashionai.application.service;

import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.taxonomy.Taxonomy;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** RF4 — "Analisar peça" preenche todos os campos, sem exceção, mesmo quando a IA não reconhece quase nada. */
class WardrobePrefillTest {
    private static void assertComplete(WardrobeService.Prefill p) {
        assertNotNull(p.name());
        assertFalse(p.name().isBlank());
        assertNotNull(p.category());
        assertNotNull(p.subcategory());
        assertNotNull(p.color());
        assertNotNull(p.material());
        assertNotNull(p.brand());
        assertNotNull(p.sex());
        assertEquals(1, p.occasion().size());
        assertEquals(1, p.style().size());
        assertNotNull(p.size());
        assertNotNull(p.price());
        assertTrue(p.price().signum() > 0);
    }

    @Test
    void iaConfianteEntraComoEsta() {
        LocalVision.PieceGuess g = new LocalVision.PieceGuess("shoes_piece", "running_shoes", "white", "SYNTHETIC", "Nike", "UNISSEX",
                Map.of("category", 0.9, "subcategory", 0.9, "color", 0.9, "material", 0.8, "brand", 0.9), 0.9, List.of("white"), null);
        WardrobeService.Prefill p = WardrobeService.prefill(g, null);
        assertComplete(p);
        assertEquals("running_shoes", p.subcategory());
        assertEquals("Nike", p.brand());
        assertEquals("sporty", p.style().get(0));
        assertEquals(399, p.price().intValue());
        assertFalse(p.manualFillRequired());
    }

    @Test
    void semReconhecimentoTodosOsCamposAindaVemPreenchidos() {
        LocalVision.PieceGuess g = new LocalVision.PieceGuess(null, null, null, null, null, null, Map.of(), 0.1, List.of(), null);
        WardrobeService.Prefill p = WardrobeService.prefill(g, null);
        assertComplete(p);
        assertEquals("upper_piece", p.category());
        assertEquals("t_shirt", p.subcategory());
        assertEquals("black", p.color());
        assertEquals("m", p.size());
        assertTrue(p.manualFillRequired());
    }

    @Test
    void palpiteAbaixoDaConfiancaEUsadoEmVezDeFicarVazio() {
        LocalVision.PieceGuess g = new LocalVision.PieceGuess(null, "jeans", "blue", null, null, null,
                Map.of("subcategory", 0.4, "color", 0.4), 0.4, List.of("blue"), null);
        WardrobeService.Prefill p = WardrobeService.prefill(g, null);
        assertComplete(p);
        assertEquals("lower_piece", p.category());
        assertEquals("jeans", p.subcategory());
        assertEquals("blue", p.color());
        assertEquals("COTTON", p.material());
        assertEquals("Jeans Blue", p.name());
    }

    /**
     * P0 (27/09): o pré-preenchimento colocava "casual" (código de OCASIÃO) no campo ESTILO; o servidor recusava a peça.
     * Para cada subcategoria da taxonomia, com e sem reconhecimento da IA, o pré-preenchimento tem de passar pela mesma
     * validação do salvamento — estilo em STYLES, ocasião permitida para a parte do corpo, nada misturado.
     */
    @Test
    void preenchimentoDeQualquerSubcategoriaPassaNaValidacaoDoSalvamento() {
        Taxonomy.SUBCATEGORIES.forEach((category, subs) -> subs.forEach((sub) -> {
            for (double overall : new double[]{0.9, 0.1}) {
                LocalVision.PieceGuess g = new LocalVision.PieceGuess(category, sub, null, null, null, null,
                        Map.of("category", overall, "subcategory", overall), overall, List.of(), null);
                WardrobeService.Prefill p = WardrobeService.prefill(g, null);
                assertTrue(Taxonomy.STYLES.containsAll(p.style()), sub + " estilo=" + p.style());
                assertFalse(p.style().stream().anyMatch(Taxonomy.OCCASIONS::contains), sub + " estilo com código de ocasião: " + p.style());
                assertTrue(Taxonomy.allowedOccasions(p.category()).containsAll(p.occasion()), sub + " ocasião=" + p.occasion());
                org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> Taxonomy.requirePiece(p.category(), p.subcategory(), p.sex(), p.color(),
                        p.material(), p.size(), p.occasion(), p.style()), sub);
            }
        }));
    }
}
