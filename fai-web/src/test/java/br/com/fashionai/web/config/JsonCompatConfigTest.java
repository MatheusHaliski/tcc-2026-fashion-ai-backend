package br.com.fashionai.web.config;

import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.Mood;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.exc.InvalidFormatException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** O Criar Look publicado mandava creationMode "AI": o esquema no modo IA caía em 400 (JSON_INVALIDO). */
class JsonCompatConfigTest {
    record Form(CreationMode creationMode) {
    }

    record MoodForm(Mood mood) {
    }

    private final ObjectMapper json = JsonMapper.builder().addModule(new JsonCompatConfig().jsonCompatModule()).build();

    private CreationMode read(String v) throws Exception {
        return json.readValue("{\"creationMode\":" + v + "}", Form.class).creationMode();
    }

    @Test
    void aceitaOApelidoAntigoEOsValoresDoEnum() throws Exception {
        assertEquals(CreationMode.AI_ASSISTED, read("\"AI\""));
        assertEquals(CreationMode.AI_ASSISTED, read("\"ia\""));
        assertEquals(CreationMode.AI_ASSISTED, read("\"AI_ASSISTED\""));
        assertEquals(CreationMode.MANUAL, read("\"MANUAL\""));
        assertEquals(CreationMode.MANUAL, read("\"manual\""));
        assertNull(read("null"));
        assertNull(read("\"\""));
    }

    @Test
    void valorDesconhecidoContinuaSendoRecusado() {
        assertThrows(InvalidFormatException.class, () -> read("\"ROBO\""));
    }

    private Mood mood(String v) throws Exception {
        return json.readValue("{\"mood\":" + v + "}", MoodForm.class).mood();
    }

    /** A tela antiga oferecia climas fora do enum; salvar o look com um deles dava "JSON inválido". */
    @Test
    void climasDaTelaAntigaViramOClimaEquivalente() throws Exception {
        assertEquals(Mood.COMFORTABLE, mood("\"RELAXADO\""));
        assertEquals(Mood.SOPHISTICATED, mood("\"CONFIANTE\""));
        assertEquals(Mood.ELEGANT, mood("\"ROMANTICO\""));
        assertEquals(Mood.ELEGANT, mood("\"romântico\""));
        assertEquals(Mood.ENERGETIC, mood("\"OUSADO\""));
        assertEquals(Mood.ENERGETIC, mood("\"ENERGICO\""));
        assertEquals(Mood.ELEGANT, mood("\"ELEGANT\""));
        assertNull(mood("null"));
        assertThrows(InvalidFormatException.class, () -> mood("\"TRISTE\""));
    }
    @Test
    void perfilEUmNivelDistintoDeLook() throws Exception {
        assertEquals(br.com.fashionai.domain.model.enums.SealTier.PERFIL,
                json.readValue("\"PERFIL\"", br.com.fashionai.domain.model.enums.SealTier.class));
        assertEquals(br.com.fashionai.domain.model.enums.SealTier.PERFIL,
                json.readValue("\"PROFILE\"", br.com.fashionai.domain.model.enums.SealTier.class));
        assertEquals(br.com.fashionai.domain.model.enums.SealTier.LOOK,
                json.readValue("\"LOOK\"", br.com.fashionai.domain.model.enums.SealTier.class));
    }
}
