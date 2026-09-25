package br.com.fashionai.web.config;

import br.com.fashionai.application.common.Msg;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.io.IOException;

/**
 * RF23 — idioma da requisição e textos adiados.
 * <ul>
 *   <li>{@code Accept-Language} (pt-BR, en, es; padrão pt-BR) vira o Locale do request; {@link Msg#t} lê dele.</li>
 *   <li>Toda String serializada em JSON passa por {@link Msg#resolve}: marcadores {@code §i18n:chave§} guardados em
 *       catálogos estáticos, enums e notificações viram texto no idioma de quem está lendo.</li>
 * </ul>
 */
@Configuration
public class I18nConfig {

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver r = new AcceptHeaderLocaleResolver();
        r.setDefaultLocale(Msg.PT_BR);
        r.setSupportedLocales(Msg.SUPPORTED);
        return r;
    }

    @Bean
    public Module i18nJsonModule() {
        SimpleModule m = new SimpleModule("fai-i18n");
        m.addSerializer(String.class, new DeferredTextSerializer());
        return m;
    }

    /** Serializador de String que resolve os marcadores de texto adiado no idioma corrente. */
    static final class DeferredTextSerializer extends StdSerializer<String> {
        DeferredTextSerializer() {
            super(String.class);
        }

        @Override
        public void serialize(String value, JsonGenerator gen, SerializerProvider provider) throws IOException {
            gen.writeString(Msg.hasMark(value) ? Msg.resolve(value) : value);
        }
    }
}
