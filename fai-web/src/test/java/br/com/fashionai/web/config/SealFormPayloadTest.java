package br.com.fashionai.web.config;

import br.com.fashionai.application.service.SealService;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * O criador de selos (app/(site)/(app)/brands/[slug]/page.tsx, função saveSeal) manda este JSON. O nível "PERFIL" que a
 * tela oferecia não existe no enum e o backend respondia 400 "JSON inválido".
 */
class SealFormPayloadTest {
    private final ObjectMapper json = new ObjectMapper()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .registerModule(new JavaTimeModule())
            .registerModule(new JsonCompatConfig().jsonCompatModule());

    private static final String PAYLOAD = """
            {"name":"Azul Zara","tier":"LOOK","usageLimit":null,"status":"ACTIVE","availableFrom":"2026-10-03T13:00:00.000Z","availableUntil":null,
             "design":{"mode":"GENERATED","palette":"FAI","border":{"material":"DOURADO","color":"#C9A24A","width":0.06},
                       "field":{"pattern":"MALHA","material":"FOSCO","nodeColors":["#FFFFFF"],"density":2,"seed":1},
                       "center":{"material":"FOSCO","color":"#111111","radius":0.45},"element":{"id":"BAG","text":"FAI"}},
             "policy":{"match":"ALL","rules":[{"quantifier":"AT_LEAST","count":3,"color":"Azul","brand":"Zara","category":null,"subcategory":null}],
                       "occasions":["party"],"styles":[]}}
            """;

    @Test
    void payloadDoCriadorDeSelosEhLido() throws Exception {
        SealService.SealForm f = json.readValue(PAYLOAD, SealService.SealForm.class);
        assertEquals("Azul Zara", f.name());
        assertEquals(SealTier.LOOK, f.tier());
        assertEquals(SealStatus.ACTIVE, f.status());
        assertTrue(f.policy().containsKey("rules"));
        assertTrue(f.design().containsKey("element"));
    }

    @Test
    void nivelPerfilDeClienteAntigoNaoViraJsonInvalido() throws Exception {
        SealService.SealForm f = json.readValue(PAYLOAD.replace("\"tier\":\"LOOK\"", "\"tier\":\"PERFIL\""), SealService.SealForm.class);
        assertEquals(SealTier.LOOK, f.tier());
        assertEquals(SealTier.PECA, json.readValue(PAYLOAD.replace("\"tier\":\"LOOK\"", "\"tier\":\"PIECE\""), SealService.SealForm.class).tier());
    }
}
