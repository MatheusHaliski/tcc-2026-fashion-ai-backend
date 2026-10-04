package br.com.fashionai.web.config;

import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.Visibility;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * O Criar Look (components/scheme-builder.tsx, função payload) manda exatamente este JSON na etapa "Revisar e salvar".
 * Se qualquer campo deixar de casar com {@link SchemeService.SchemeForm}, o backend responde 400 "JSON inválido" — este
 * teste lê o payload real com o mesmo módulo de compatibilidade da API.
 */
class SchemeFormPayloadTest {
    private final ObjectMapper json = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .addModule(new JsonCompatConfig().jsonCompatModule())
            .build();

    private static final String PAYLOAD = """
            {"title":"Sexta casual","description":"","occasion":["casual","work"],"style":["classic"],"season":null,"mood":"COMFORTABLE",
             "visibility":"PRIVATE","publish":false,"lookDoDia":false,"tags":["verão"],
             "items":[{"wardrobeItemId":"5f0b2e26-0d7e-4d5e-8b6a-2a3d3a0f1c11","slot":"TOP","sortOrder":0},
                      {"wardrobeItemId":"5f0b2e26-0d7e-4d5e-8b6a-2a3d3a0f1c12","slot":"BOTTOM","sortOrder":1},
                      {"wardrobeItemId":"5f0b2e26-0d7e-4d5e-8b6a-2a3d3a0f1c13","slot":"SHOES","sortOrder":2}],
             "seals":[],"creationMode":"AI_ASSISTED",
             "background":{"scheme":{"aura":{"variantId":"A01"},"materialId":null,"aiArt":null,"uploadUrl":null,"layoutAnatomy":"LISTA_VERTICAL","photo":{"url":null},"container":{"color":"#FFFFFF"}},"pieces":{"anatomy":"PECA_AMPLIADO"}},
             "cardSkin":"atelier","layoutAnatomy":"LISTA_VERTICAL"}
            """;

    @Test
    void payloadDoCriarLookEhLidoSemErro() throws Exception {
        SchemeService.SchemeForm f = json.readValue(PAYLOAD, SchemeService.SchemeForm.class);
        assertEquals("Sexta casual", f.title());
        assertEquals(Mood.COMFORTABLE, f.mood());
        assertNull(f.season());
        assertEquals(Visibility.PRIVATE, f.visibility());
        assertEquals(CreationMode.AI_ASSISTED, f.creationMode());
        assertEquals(3, f.items().size());
        assertEquals(SchemeSlot.SHOES, f.items().get(2).slot());
        assertTrue(f.seals().isEmpty());
        assertEquals("atelier", f.cardSkin());
        assertTrue(f.background().containsKey("scheme"));
    }

    @Test
    void seasonVaziaEHumorEmPortuguesTambemSaoAceitos() throws Exception {
        String p = PAYLOAD.replace("\"season\":null", "\"season\":\"\"").replace("\"mood\":\"COMFORTABLE\"", "\"mood\":\"RELAXADO\"");
        SchemeService.SchemeForm f = json.readValue(p, SchemeService.SchemeForm.class);
        assertNull(f.season());
        assertEquals(Mood.COMFORTABLE, f.mood());
    }
}
