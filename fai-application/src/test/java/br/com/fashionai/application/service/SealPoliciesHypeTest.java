package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * RF53 — política do selo com critério de Hype: {@code rule.hypeMin} (filtro por peça) e {@code policy.hype} (entidade
 * avaliada: peça no tier PEÇA, look no tier LOOK). Sem Hype disponível o critério não é atendido; política sem Hype
 * continua idêntica à de antes.
 */
class SealPoliciesHypeTest {

    @Test
    void modalidadeHypePersisteDimensoesEExigeTodasSemInventarDados() {
        Map<String,Object> raw = Map.of("mode", "HYPE", "hype", Map.of("dimensionMins", Map.of("ENGAGEMENT", 60, "ORIGINALITY", 70)));
        Map<String,Object> normalized = SealPolicies.normalize(raw);
        assertEquals("HYPE", normalized.get("mode"));
        var criterion = SealPolicies.parse(normalized).hype();
        assertTrue(SealPolicies.meets(criterion, new SealPolicies.HypeFact(80d, HypeLevel.TRENDING, HypeMomentum.RISING, true,
                Map.of("ENGAGEMENT", 60d, "ORIGINALITY", 75d))));
        assertFalse(SealPolicies.meets(criterion, new SealPolicies.HypeFact(90d, HypeLevel.VIRAL, HypeMomentum.RISING, true,
                Map.of("ENGAGEMENT", 59d, "ORIGINALITY", 95d))));
        assertFalse(SealPolicies.meets(criterion, new SealPolicies.HypeFact(90d, HypeLevel.VIRAL, HypeMomentum.RISING, true,
                Map.of("ENGAGEMENT", 90d))));
    }

    @Test
    void rejeitaModalidadeVaziaDimensoesDesconhecidasELimiaresInvalidos() {
        assertThrows(ApiException.class, () -> SealPolicies.normalize(Map.of("mode", "HYPE")));
        for (Object invalid : List.of(-1, 101, 1.5, "NaN", "Infinity", "texto"))
            assertThrows(ApiException.class, () -> SealPolicies.normalize(Map.of("mode", "HYPE", "hype", Map.of("dimensionMins", Map.of("POPULARITY", invalid)))));
        assertThrows(ApiException.class, () -> SealPolicies.normalize(Map.of("mode", "HYPE", "hype", Map.of("dimensionMins", Map.of("PURCHASES", 50)))));
    }

    private static WardrobeItem piece(String color, String brand) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setCategory("upper_piece");
        w.setColor(color);
        w.setBrandName(brand);
        return w;
    }

    private static SealPolicies.Policy policy(Map<String, Object> raw) {
        return SealPolicies.parse(SealPolicies.normalize(raw));
    }

    private static SealPolicies.HypeFact fact(double score, HypeLevel level, HypeMomentum momentum) {
        return new SealPolicies.HypeFact(score, level, momentum, true);
    }

    /** Lookup de teste: Hype por peça e do look. */
    private static SealPolicies.HypeLookup lookup(Map<UUID, SealPolicies.HypeFact> pieces, SealPolicies.HypeFact look) {
        return new SealPolicies.HypeLookup() {
            @Override
            public SealPolicies.HypeFact piece(UUID pieceId) {
                return pieces.get(pieceId);
            }

            @Override
            public SealPolicies.HypeFact look() {
                return look;
            }
        };
    }

    private static int status(ApiException e) {
        return e.status();
    }

    // ------------------------------------------------------------------ normalize / validação

    @Test
    void normalizaCriterioDeHypeERegraSoComHypeMin() {
        Map<String, Object> out = SealPolicies.normalize(Map.of(
                "rules", List.of(Map.of("quantifier", "AT_LEAST", "count", 2, "hypeMin", "hot")),
                "hype", Map.of("minLevel", "relevant", "minScore", 60, "momentum", List.of("rising", "EMERGING", "RISING"))));
        assertNotNull(out);
        @SuppressWarnings("unchecked")
        Map<String, Object> rule = ((List<Map<String, Object>>) out.get("rules")).get(0);
        assertEquals("HOT", rule.get("hypeMin"));                        // regra só com hypeMin é válida
        assertEquals(Map.of("minLevel", "RELEVANT", "minScore", 60, "momentum", List.of("RISING", "EMERGING")), out.get("hype"));
        // política só com Hype (sem regras/tags) também é válida
        assertNotNull(SealPolicies.normalize(Map.of("hype", Map.of("minScore", "75"))));
        assertNotNull(SealPolicies.parse(SealPolicies.normalize(Map.of("hype", Map.of("momentum", List.of("CLASSIC"))))));
        // hype vazio = sem critério
        assertNull(SealPolicies.normalize(Map.of("hype", Map.of("minLevel", "", "momentum", List.of()))));
    }

    @Test
    void politicaSemHypeFicaIgualADeAntes() {
        Map<String, Object> out = SealPolicies.normalize(Map.of("rules", List.of(Map.of("color", "Azul", "brand", "Zara"))));
        assertFalse(out.containsKey("hype"));
        @SuppressWarnings("unchecked")
        Map<String, Object> rule = ((List<Map<String, Object>>) out.get("rules")).get(0);
        assertFalse(rule.containsKey("hypeMin"));
        assertEquals(List.of("quantifier", "count", "color", "brand", "category", "subcategory"), List.copyOf(rule.keySet()));
        SealPolicies.Policy p = SealPolicies.parse(out);
        assertNull(p.hype());
        assertFalse(p.usesHype());
    }

    @Test
    void valoresDeHypeInvalidosViram400PoliticaInvalida() {
        List<Map<String, Object>> bad = List.of(
                Map.of("hype", Map.of("minLevel", "SUPER")),
                Map.of("hype", Map.of("minScore", 101)),
                Map.of("hype", Map.of("minScore", -1)),
                Map.of("hype", Map.of("minScore", 60.5)),
                Map.of("hype", Map.of("minScore", "muito")),
                Map.of("hype", Map.of("momentum", List.of("FAST"))),
                Map.of("hype", Map.of("momentum", List.of("RISING", "EMERGING", "STABLE", "CLASSIC"))),
                Map.of("rules", List.of(Map.of("hypeMin", "ULTRA"))));
        for (Map<String, Object> raw : bad) {
            ApiException e = assertThrows(ApiException.class, () -> SealPolicies.normalize(raw), raw.toString());
            assertEquals(400, status(e));
            assertEquals("POLITICA_INVALIDA", e.code());
        }
        // limites aceitos: 0, 100 e 3 momentos
        assertNotNull(SealPolicies.normalize(Map.of("hype", Map.of("minScore", 0))));
        assertNotNull(SealPolicies.normalize(Map.of("hype", Map.of("minScore", 100, "momentum", List.of("RISING", "EMERGING", "STABLE")))));
    }

    // ------------------------------------------------------------------ frase da política

    @Test
    void fraseDaPoliticaComHype() {
        SealPolicies.Policy look = policy(Map.of(
                "rules", List.of(Map.of("quantifier", "AT_LEAST", "count", 2, "brand", "Nike", "hypeMin", "HOT")),
                "hype", Map.of("minScore", 60, "momentum", List.of("RISING"))));
        assertEquals("no mínimo 2 peças da marca Nike com Hype ≥ Em alta; look com Hype ≥ 60 e em crescimento",
                SealPolicies.describe(look, SealTier.LOOK));
        SealPolicies.Policy peca = policy(Map.of("hype", Map.of("minLevel", "RELEVANT", "minScore", 50, "momentum", List.of("EMERGING", "RISING"))));
        assertEquals("peça com Hype ≥ Relevante e ≥ 50 e emergente ou em crescimento", SealPolicies.describe(peca, SealTier.PECA));
        SealPolicies.Policy onlyRule = policy(Map.of("rules", List.of(Map.of("hypeMin", "VIRAL")), "styles", List.of("streetwear")));
        assertEquals("ao menos uma peça com Hype ≥ Viral · estilo: Streetwear", SealPolicies.describe(onlyRule, SealTier.LOOK));
    }

    // ------------------------------------------------------------------ avaliação

    @Test
    void tierPecaUsaOHypeDaPropriaPeca() {
        SealPolicies.Policy p = policy(Map.of("rules", List.of(Map.of("brand", "Nike")), "hype", Map.of("minLevel", "HOT")));
        WardrobeItem hot = piece("black", "Nike");
        WardrobeItem relevant = piece("black", "Nike");
        WardrobeItem none = piece("black", "Nike");
        WardrobeItem insufficient = piece("black", "Nike");
        Map<UUID, SealPolicies.HypeFact> facts = new HashMap<>();
        facts.put(hot.getId(), fact(76, HypeLevel.TRENDING, HypeMomentum.STABLE));
        facts.put(relevant.getId(), fact(45, HypeLevel.RELEVANT, HypeMomentum.RISING));
        facts.put(insufficient.getId(), new SealPolicies.HypeFact(null, null, null, false));
        SealPolicies.HypeLookup h = lookup(facts, null);

        SealPolicies.Verdict ok = SealPolicies.evaluate(p, SealTier.PECA, List.of(hot), List.of(), List.of(), h);
        assertTrue(ok.matched());
        assertEquals("Peça da marca Nike; peça com Hype ≥ Em alta (atual: 76)", ok.why());
        assertFalse(SealPolicies.evaluate(p, SealTier.PECA, List.of(relevant), List.of(), List.of(), h).matched());
        assertFalse(SealPolicies.evaluate(p, SealTier.PECA, List.of(none), List.of(), List.of(), h).matched());          // não calculado
        assertFalse(SealPolicies.evaluate(p, SealTier.PECA, List.of(insufficient), List.of(), List.of(), h).matched());  // dados insuficientes
        // assinatura antiga (sem Hype): critério de Hype nunca é atendido
        assertFalse(SealPolicies.evaluate(p, SealTier.PECA, List.of(hot), List.of(), List.of()).matched());
    }

    @Test
    void tierLookUsaOHypeDoLookComNivelScoreEMomento() {
        SealPolicies.Policy p = policy(Map.of("rules", List.of(Map.of("color", "Preto")),
                "hype", Map.of("minScore", 60, "momentum", List.of("RISING", "EMERGING"))));
        List<WardrobeItem> look = List.of(piece("black", null), piece("white", null));

        SealPolicies.Verdict v = SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), fact(72, HypeLevel.HOT, HypeMomentum.RISING)));
        assertTrue(v.matched());
        assertEquals("ao menos uma peça na cor preto; look com Hype ≥ 60 e em crescimento ou emergente (atual: 72)", v.why());
        // momento fora da lista
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), fact(72, HypeLevel.HOT, HypeMomentum.STABLE))).matched());
        // o score segue o número exibido: 59,6 aparece como 60
        assertTrue(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), fact(59.6, HypeLevel.HOT, HypeMomentum.RISING))).matched());
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), fact(59.4, HypeLevel.RELEVANT, HypeMomentum.RISING))).matched());
        // look ainda não salvo (sem Hype) → não atende
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), null)).matched());
        // o Hype das peças não substitui o do look
        Map<UUID, SealPolicies.HypeFact> pieces = new HashMap<>();
        look.forEach(w -> pieces.put(w.getId(), fact(95, HypeLevel.VIRAL, HypeMomentum.RISING)));
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(pieces, null)).matched());
    }

    @Test
    void nivelEScoreJuntosPrecisamValerOsDois() {
        SealPolicies.Policy p = policy(Map.of("hype", Map.of("minLevel", "TRENDING", "minScore", 60)));
        List<WardrobeItem> look = List.of(piece("black", null));
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), fact(70, HypeLevel.HOT, null))).matched());
        assertTrue(SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), fact(80, HypeLevel.TRENDING, null))).matched());
        SealPolicies.Verdict v = SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), fact(80, HypeLevel.TRENDING, null)));
        assertEquals("look com Hype ≥ Tendência e ≥ 60 (atual: 80)", v.why());
    }

    @Test
    void hypeMinDaRegraFiltraCadaPeca() {
        SealPolicies.Policy p = policy(Map.of("rules", List.of(Map.of("quantifier", "AT_LEAST", "count", 2, "brand", "Nike", "hypeMin", "HOT"))));
        WardrobeItem a = piece("black", "Nike");
        WardrobeItem b = piece("white", "Nike");
        WardrobeItem c = piece("blue", "Nike");
        Map<UUID, SealPolicies.HypeFact> facts = new HashMap<>();
        facts.put(a.getId(), fact(65, HypeLevel.HOT, null));
        facts.put(b.getId(), fact(91, HypeLevel.VIRAL, null));
        facts.put(c.getId(), fact(30, HypeLevel.NICHE, null));
        SealPolicies.Verdict v = SealPolicies.evaluate(p, SealTier.LOOK, List.of(a, b, c), List.of(), List.of(), lookup(facts, null));
        assertTrue(v.matched());
        assertEquals(List.of(a.getId(), b.getId()), v.pieceIds());     // só as peças que sustentam a regra
        assertEquals("no mínimo 2 peças da marca Nike com Hype ≥ Em alta", v.why());
        facts.put(b.getId(), fact(55, HypeLevel.RELEVANT, null));
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, List.of(a, b, c), List.of(), List.of(), lookup(facts, null)).matched());
        // sem Hype nenhum, a regra com hypeMin não passa
        assertFalse(SealPolicies.evaluate(p, SealTier.LOOK, List.of(a, b, c), List.of(), List.of()).matched());
    }

    @Test
    void politicaSemHypeIgnoraOLookup() {
        SealPolicies.Policy p = policy(Map.of("rules", List.of(Map.of("quantifier", "AT_LEAST", "count", 2, "color", "Azul"))));
        List<WardrobeItem> look = List.of(piece("navy", null), piece("denim", null));
        SealPolicies.Verdict before = SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of());
        SealPolicies.Verdict with = SealPolicies.evaluate(p, SealTier.LOOK, look, List.of(), List.of(), lookup(Map.of(), fact(10, HypeLevel.LOW_SIGNAL, HypeMomentum.COOLING)));
        assertEquals(before, with);
        assertEquals("no mínimo 2 peças na cor azul", with.why());
    }
}
