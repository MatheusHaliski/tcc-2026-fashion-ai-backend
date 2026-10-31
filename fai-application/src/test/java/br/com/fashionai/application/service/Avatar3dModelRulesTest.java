package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Unidade extraída no lote GoF 12: regras do rosto/cabelo/olhos/sobrancelhas do modelo do Avatar 3D. */
class Avatar3dModelRulesTest {

    @Test
    void constantesDoServicoVemDasRegras() {
        assertEquals(1404, Avatar3dModelRules.SHAPE_LEN);
        assertEquals(Avatar3dModelRules.SHAPE_LEN, Avatar3dService.SHAPE_LEN);
        assertEquals(Avatar3dModelRules.MODEL_VERSION, Avatar3dService.MODEL_VERSION);
    }

    @Test
    void pontoDaFormaPrecisaSerMenorQue40EmModulo() {
        Map<String, Object> m = new LinkedHashMap<>(Avatar3dServiceTest.model());
        List<Object> shape = new ArrayList<>(Collections.nCopies(Avatar3dModelRules.SHAPE_LEN, (Object) 0.0));
        shape.set(0, -39.99);
        m.put("shape", shape);
        assertEquals(shape, Avatar3dModelRules.validate(m).get("shape"));
        shape.set(0, 40);
        assertEquals("MODELO_INVALIDO", assertThrows(ApiException.class, () -> Avatar3dModelRules.validate(m)).code());
    }

    @Test
    void tomDoCabeloSoInteiro1a10EFamiliaConhecida() {
        assertTrue(Avatar3dModelRules.validTone(Map.of("level", 10, "family", "copper")));
        assertFalse(Avatar3dModelRules.validTone(Map.of("level", 9.5, "family", "copper")));
        assertFalse(Avatar3dModelRules.validTone(Map.of("level", 0, "family", "copper")));
        assertFalse(Avatar3dModelRules.validTone(Map.of("level", 5, "family", "blue")));
        assertFalse(Avatar3dModelRules.validTone(Map.of("level", 5, "family", "ash", "x", 1)));
    }

    @Test
    void silhuetaAte32PontosEntre0e30() {
        assertTrue(Avatar3dModelRules.validOutline(Collections.nCopies(32, 30)));
        assertFalse(Avatar3dModelRules.validOutline(Collections.nCopies(33, 1)));
        assertFalse(Avatar3dModelRules.validOutline(List.of(-1)));
        assertFalse(Avatar3dModelRules.validOutline("1,2,3"));
    }

    @Test
    void olhosESobrancelhasInvalidosViramNull() {
        assertNull(Avatar3dModelRules.validEyes(null));
        assertNull(Avatar3dModelRules.validEyes(Map.of("color", "#000000")));
        assertNull(Avatar3dModelRules.validBrows(Map.of("color", "#000000", "shape", "ZIGZAG")));
    }

    @Test
    void servicoDelegaParaAsRegras() {
        Map<String, Object> m = Avatar3dServiceTest.model();
        assertEquals(Avatar3dModelRules.validate(m), Avatar3dService.validateModel(m));
    }
}
