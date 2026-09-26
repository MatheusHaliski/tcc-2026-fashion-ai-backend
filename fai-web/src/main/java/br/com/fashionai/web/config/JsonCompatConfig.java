package br.com.fashionai.web.config;

import br.com.fashionai.domain.model.enums.CreationMode;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.util.Locale;

/**
 * Valores antigos que clientes já publicados ainda mandam. O Criar Look (RF5) enviava {@code creationMode: "AI"} e o
 * enum é {@code AI_ASSISTED}: o esquema no modo IA caía em 400. "AI"/"IA" continuam aceitos como apelido.
 */
@Configuration
public class JsonCompatConfig {

    @Bean
    public Module jsonCompatModule() {
        SimpleModule m = new SimpleModule("fai-json-compat");
        m.addDeserializer(CreationMode.class, new CreationModeDeserializer());
        return m;
    }

    static final class CreationModeDeserializer extends StdDeserializer<CreationMode> {
        CreationModeDeserializer() {
            super(CreationMode.class);
        }

        @Override
        public CreationMode deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
            String raw = p.getValueAsString();
            if (raw == null || raw.isBlank()) {
                return null;
            }
            String v = raw.trim().toUpperCase(Locale.ROOT);
            if (v.equals("AI") || v.equals("IA")) {
                return CreationMode.AI_ASSISTED;
            }
            try {
                return CreationMode.valueOf(v);
            } catch (IllegalArgumentException e) {
                return (CreationMode) ctx.handleWeirdStringValue(CreationMode.class, raw, "valores aceitos: MANUAL, AI_ASSISTED");
            }
        }
    }
}
