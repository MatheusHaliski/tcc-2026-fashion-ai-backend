package br.com.fashionai.web.config;

import br.com.fashionai.domain.model.enums.CreationMode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** O Criar Look publicado mandava creationMode "AI": o esquema no modo IA caía em 400 (JSON_INVALIDO). */
class JsonCompatConfigTest {
    record Form(CreationMode creationMode) {
    }

    private final ObjectMapper json = new ObjectMapper().registerModule(new JsonCompatConfig().jsonCompatModule());

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
}
