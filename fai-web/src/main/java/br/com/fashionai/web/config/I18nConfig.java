package br.com.fashionai.web.config;

import br.com.fashionai.application.common.Msg;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.ser.std.StdSerializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

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
    /** Boot 4 registra no JsonMapper todo bean {@link JacksonModule} (um bean do Jackson 2 seria ignorado em silêncio). */
    public JacksonModule i18nJsonModule() {
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
        public void serialize(String value, JsonGenerator gen, SerializationContext provider) {
            gen.writeString(Msg.hasMark(value) ? Msg.resolve(value) : value);
        }
    }
}
