package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** RF25 — políticas padronizadas do selo: os exemplos do pedido ("no mínimo três peças azuis da Zara", etc.). */
class SealPoliciesTest {

    private static WardrobeItem piece(String category, String color, String brand) {
        WardrobeItem w = new WardrobeItem();
        org.springframework.test.util.ReflectionTestUtils.setField(w, "id", UUID.randomUUID());   // o JPA gera no persist
        w.setCategory(category);
        w.setColor(color);
        w.setBrandName(brand);
        return w;
    }

    private static SealPolicies.Policy policy(Map<String, Object> raw) {
        return SealPolicies.parse(SealPolicies.normalize(raw));
    }

    @Test
    void lookComNoMinimoTresPecasAzuisDaZara() {
        SealPolicies.Policy p = policy(Map.of("rules", List.of(Map.of("quantifier", "AT_LEAST", "count", 3, "color", "Azul", "brand", "Zara"))));
        List<WardrobeItem> three = List.of(piece("upper_piece", "navy", "ZARA"), piece("lower_piece", "denim", "Zara"),
                piece("shoes_piece", "light_blue", "zara "), piece("accessory_piece", "black", "Nike"));
        SealPolicies.Verdict v = SealPolicies.evaluate(p, SealTier.LOOK, three, List.of(), List.of());
        assertTrue(v.matched());
        assertEquals(3, v.pieceIds().size());                             // só as peças que sustentam a regra
        List<WardrobeItem> two = List.of(piece("upper_piece", "navy", "Zara"), piece("lower_piece", "denim", "Zara"), piece("shoes_piece", "blue", "Adidas"));
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, two, List.of(), List.of()).matched());
        assertEquals("no mínimo 3 peças na cor azul da marca Zara", SealPolicies.describe(p, SealTier.LOOK));
    }

    @Test
    void pecaVermelha() {
        SealPolicies.Policy p = policy(Map.of("rules", List.of(Map.of("color", "Vermelho"))));
        assertTrue(SealPolicies.evaluate(p, SealTier.PECA, List.of(piece("upper_piece", "burgundy", null)), List.of(), List.of()).matched());
        assertFalse(SealPolicies.evaluate(p, SealTier.PECA, List.of(piece("upper_piece", "pink", null)), List.of(), List.of()).matched());
        assertEquals("Peça na cor vermelho", SealPolicies.describe(p, SealTier.PECA));
    }

    @Test
    void todasAsPecasAmarelasDaAdidas() {
        SealPolicies.Policy p = policy(Map.of("rules", List.of(Map.of("quantifier", "ALL", "color", "Amarelo", "brand", "Adidas"))));
        assertTrue(SealPolicies.evaluate(p, SealTier.LOOK, List.of(piece("upper_piece", "yellow", "adidas"), piece("shoes_piece", "mustard", "Adidas")), List.of(), List.of()).matched());
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, List.of(piece("upper_piece", "yellow", "adidas"), piece("shoes_piece", "white", "Adidas")), List.of(), List.of()).matched());
    }

    @Test
    void tagsDeOcasiaoEEstiloSoBloqueiamQuandoOsDoisLadosTemValor() {
        SealPolicies.Policy p = policy(Map.of("rules", List.of(Map.of("color", "Preto")), "occasions", List.of("party")));
        List<WardrobeItem> look = List.of(piece("upper_piece", "black", null));
        assertTrue(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of("party", "date"), List.of()).matched());
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of("work"), List.of()).matched());
        assertTrue(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of()).matched());
    }

    @Test
    void nenhumaPecaEQualquerRegra() {
        SealPolicies.Policy p = policy(Map.of("match", "ANY", "rules", List.of(Map.of("quantifier", "NONE", "color", "Preto"), Map.of("brand", "Zara"))));
        assertTrue(SealPolicies.evaluate(p, SealTier.LOOK, List.of(piece("upper_piece", "black", "Zara")), List.of(), List.of()).matched());
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, List.of(piece("upper_piece", "black", "Nike")), List.of(), List.of()).matched());
    }

    @Test
    void valoresForaDaTaxonomiaViramErroLegivelESemRegraEhNulo() {
        assertThrows(ApiException.class, () -> SealPolicies.normalize(Map.of("rules", List.of(Map.of("color", "fúcsia")))));
        assertThrows(ApiException.class, () -> SealPolicies.normalize(Map.of("occasions", List.of("baile"))));
        assertThrows(ApiException.class, () -> SealPolicies.normalize(Map.of("rules", List.of(Map.of("quantifier", "AT_LEAST", "count", 9, "color", "Azul")))));
        assertNull(SealPolicies.normalize(Map.of("rules", List.of(Map.of("quantifier", "ALL")))));
    }
}
