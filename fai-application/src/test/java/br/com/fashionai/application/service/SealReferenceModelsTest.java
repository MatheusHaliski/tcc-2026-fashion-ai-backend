package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class SealReferenceModelsTest {
    private Map<String, Object> model(List<Map<String, Object>> pieces) {
        return new LinkedHashMap<>(Map.of("version", 1, "tier", "LOOK", "title", "Azul", "description", "Modelo azul",
                "match", "ALL", "minPieces", 1, "pieces", pieces));
    }
    private WardrobeItem piece(String brand, String color) {
        WardrobeItem w = new WardrobeItem(); w.assignId(UUID.randomUUID());
        w.setCategory("upper_piece"); w.setSubcategory("t_shirt"); w.setBrandName(brand); w.setColor(color); return w;
    }
    @Test void quantidadesMaioresQueQuatroEExclusoes() {
        var m = SealReferenceModels.normalize(model(List.of(
                Map.of("quantifier", "EXACTLY", "count", 5, "brand", "Zara", "color", "blue"),
                Map.of("quantifier", "NONE", "count", 1, "brand", "Nike"))));
        List<WardrobeItem> five = new ArrayList<>(); for (int i=0;i<5;i++) five.add(piece("Zara", "blue"));
        assertTrue(SealReferenceModels.evaluate(m, SealTier.LOOK, five, Map.of()).matched());
        five.add(piece("Nike", "red"));
        assertFalse(SealReferenceModels.evaluate(m, SealTier.LOOK, five, Map.of()).matched());
    }
    @Test void fundoEAttributesAusentesNaoLiberamSelo() {
        var raw = model(List.of(Map.of("count", 1, "brand", "Zara", "material", "COTTON")));
        raw.put("background", Map.of("artUrl", "https://example.com/art.png", "aura", Map.of("variantId", "geometry")));
        var m = SealReferenceModels.normalize(raw);
        WardrobeItem w = piece("Zara", "blue");
        var background = Map.<String,Object>of("scheme", Map.of("artUrl", "https://example.com/art.png", "aura", Map.of("variantId", "geometry")));
        assertFalse(SealReferenceModels.evaluate(m, SealTier.LOOK, List.of(w), background).matched());
        w.setMaterial("COTTON");
        assertTrue(SealReferenceModels.evaluate(m, SealTier.LOOK, List.of(w), background).matched());
        assertFalse(SealReferenceModels.evaluate(m, SealTier.LOOK, List.of(w), Map.of()).matched());
        assertFalse(SealReferenceModels.evaluate(m, SealTier.PECA, List.of(w), background).matched());
    }
    @Test void naoDescartaSilenciosamenteCriteriosDesconhecidos() {
        assertThrows(ApiException.class, () -> SealReferenceModels.normalize(model(List.of(Map.of("nonexistent", "x")))));
        assertThrows(ApiException.class, () -> SealReferenceModels.normalize(model(List.of(Map.of("category", "shoes_piece", "subcategory", "t_shirt")))));
    }
    @Test void contratoDoCopilotNaoAceitaSugestaoSemModelo() {
        assertTrue(SealPolicyCopilot.tagged("#createsealpolicy duas peças azuis"));
        assertFalse(SealPolicyCopilot.tagged("#createsealpolicyextra"));
        assertNull(SealPolicyCopilot.parse("{\"status\":\"VALID\",\"name\":\"Selo Azul\",\"tier\":\"LOOK\",\"policy\":{}}"));
        assertNotNull(SealPolicyCopilot.parse("{\"status\":\"INCOMPLETE\",\"questions\":[\"Qual marca?\"]}"));
        assertNull(SealPolicyCopilot.parse("{\"status\":\"INCOMPLETE\"}"));
    }
    @Test void fingerprintPreservaCriteriosEIndependeDaOrdemDosCampos() {
        var m = model(List.of(Map.of("brand", "Zara", "count", 1)));
        var policy = Map.<String,Object>of("referenceModel", m);
        var reversed = new LinkedHashMap<String,Object>(); new TreeMap<>(m).descendingMap().forEach(reversed::put);
        assertEquals(SealPolicyCopilot.fingerprint(policy), SealPolicyCopilot.fingerprint(Map.of("referenceModel", reversed)));
        reversed.put("minPieces", 2);
        assertNotEquals(SealPolicyCopilot.fingerprint(policy), SealPolicyCopilot.fingerprint(Map.of("referenceModel", reversed)));
    }
    @Test void perfilPodeAbrangerPecasELooksEExigirTodosOsSelosConquistados() {
        String first = UUID.randomUUID().toString(), second = UUID.randomUUID().toString();
        var ref = model(List.of(Map.of("brand", "Zara")));
        ref.put("tier", "PERFIL"); ref.put("target", "BOTH");
        ref.put("earnedSeals", Map.of("match", "ALL", "rules", List.of(
                Map.of("sealId", first, "scope", "PIECES", "minCount", 1),
                Map.of("sealId", second, "scope", "ANY", "minCount", 1))));
        var pol = SealPolicies.parse(SealPolicies.normalize(Map.of("referenceModel", ref)));
        WardrobeItem w = piece("Zara", "blue");
        assertFalse(SealPolicies.evaluate(pol, SealTier.PECA, List.of(w), List.of(), List.of()).matched());
        SealPolicies.HypeLookup both = new SealPolicies.HypeLookup() {
            public SealPolicies.HypeFact piece(UUID id) { return null; }
            public SealPolicies.HypeFact look() { return null; }
            public long earnedSealCount(UUID id, String scope, List<UUID> pieces) { return 1; }
        };
        assertTrue(SealPolicies.evaluate(pol, SealTier.PECA, List.of(w), List.of(), List.of(), both).matched());
        assertTrue(SealPolicies.evaluate(pol, SealTier.LOOK, List.of(w), List.of(), List.of(), both).matched());
        SealPolicies.HypeLookup onlyOne = new SealPolicies.HypeLookup() {
            public SealPolicies.HypeFact piece(UUID id) { return null; }
            public SealPolicies.HypeFact look() { return null; }
            public long earnedSealCount(UUID id, String scope, List<UUID> pieces) { return id.toString().equals(first) ? 1 : 0; }
        };
        assertFalse(SealPolicies.evaluate(pol, SealTier.LOOK, List.of(w), List.of(), List.of(), onlyOne).matched());
        ref.put("earnedSeals", Map.of("match", "ANY", "rules", ((Map<?, ?>) ref.get("earnedSeals")).get("rules")));
        var any = SealPolicies.parse(SealPolicies.normalize(Map.of("referenceModel", ref)));
        assertTrue(SealPolicies.evaluate(any, SealTier.LOOK, List.of(w), List.of(), List.of(), onlyOne).matched());
        ref.put("target", "LOOK");
        var looksOnly = SealPolicies.parse(SealPolicies.normalize(Map.of("referenceModel", ref)));
        assertFalse(SealPolicies.evaluate(looksOnly, SealTier.PECA, List.of(w), List.of(), List.of(), both).matched());
    }
}
