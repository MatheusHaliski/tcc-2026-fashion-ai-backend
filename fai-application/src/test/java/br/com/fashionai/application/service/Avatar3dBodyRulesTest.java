package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Unidade extraída no lote GoF 12: faixas do corpo (limites inclusivos) e privacidade das medidas pessoais. */
class Avatar3dBodyRulesTest {

    private static String code(Map<String, Object> b) {
        return assertThrows(ApiException.class, () -> Avatar3dBodyRules.validate(b)).code();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> params(Map<String, Object> b) {
        return (Map<String, Object>) b.get("params");
    }

    @Test
    void limitesDasFaixasSaoInclusivos() {
        for (Map.Entry<String, double[]> e : Avatar3dBodyRules.BODY_RANGE.entrySet()) {
            for (double ok : e.getValue()) {
                Map<String, Object> b = Avatar3dModelValidationCharacterizationTest.body();
                params(b).put(e.getKey(), ok);
                assertEquals(ok, params(Avatar3dBodyRules.validate(b)).get(e.getKey()), e.getKey());
            }
            Map<String, Object> below = Avatar3dModelValidationCharacterizationTest.body();
            params(below).put(e.getKey(), e.getValue()[0] - 0.001);
            assertEquals("CORPO_INVALIDO", code(below), e.getKey());
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void profundidadeComOrigemMasSemValorERecusada() {
        Map<String, Object> b = Avatar3dModelValidationCharacterizationTest.body();
        ((Map<String, Object>) b.get("sources")).put("chestD", "user");
        assertEquals("CORPO_INVALIDO", code(b));
    }

    @Test
    void alturaEPesoNosLimitesHumanos() {
        Map<String, Object> b = Avatar3dModelValidationCharacterizationTest.body();
        b.put("heightCm", 120);
        b.put("weightKg", 250);
        Map<String, Object> out = Avatar3dBodyRules.validate(b);
        assertEquals(120.0, out.get("heightCm"));
        assertEquals(250.0, out.get("weightKg"));
        b.put("weightKg", 29.9);
        assertEquals("CORPO_INVALIDO", code(b));
    }

    @Test
    void medidasPessoaisNaoSaemNoModeloPublicoENaoMutamOOriginal() {
        assertEquals(List.of("heightCm", "weightKg", "measuresCm"), Avatar3dBodyRules.PERSONAL_BODY_KEYS);
        assertEquals(Set.of("chest", "waist", "hip", "shoe"), Avatar3dBodyRules.TAPE_RANGE.keySet());
        Map<String, Object> body = new LinkedHashMap<>(Map.of("v", 1, "heightCm", 170.0, "weightKg", 60.0, "measuresCm", Map.of("hip", 90.0)));
        Map<String, Object> model = new LinkedHashMap<>(Map.of("skin", "#000000", "body", body));
        Map<String, Object> pub = Avatar3dBodyRules.publicModel(model);
        assertEquals(Map.of("v", 1), pub.get("body"));
        assertEquals("#000000", pub.get("skin"));
        assertTrue(((Map<?, ?>) model.get("body")).containsKey("weightKg"));
    }

    @Test
    void servicoDelegaParaAsRegras() {
        Map<String, Object> b = Avatar3dModelValidationCharacterizationTest.body();
        assertEquals(Avatar3dBodyRules.validate(b), Avatar3dService.validateBody(b));
    }
}
