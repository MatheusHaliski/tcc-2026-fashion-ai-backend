package br.com.fashionai.bootstrap;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contrato JSON da API com os clientes já publicados (front Next.js), sob o Jackson 3 do Spring Boot 4, que mudou
 * padrões do Jackson 2: o JsonMapper montado com o application.yml real precisa continuar aceitando campo desconhecido e
 * {@code null} num campo primitivo (checkbox/número não preenchido), e escrevendo datas em ISO-8601.
 */
class JsonContractTest {

    record Payload(String name, boolean acceptTerms, int usageLimit, Instant at) {
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class))
            .withInitializer(ctx -> {
                try {
                    ctx.getEnvironment().getPropertySources().addLast(new YamlPropertySourceLoader()
                            .load("application.yml", new ClassPathResource("application.yml")).get(0));
                } catch (java.io.IOException e) {
                    throw new IllegalStateException(e);
                }
            })
            .withPropertyValues("MYSQL_PASSWORD=x");

    @Test
    void aceitaCampoDesconhecidoENullEmPrimitivo() {
        runner.run(ctx -> {
            JsonMapper json = ctx.getBean(JsonMapper.class);
            Payload p = json.readValue("{\"name\":\"a\",\"acceptTerms\":null,\"usageLimit\":null,\"campoNovoDoFront\":1}",
                    Payload.class);
            assertThat(p.acceptTerms()).isFalse();
            assertThat(p.usageLimit()).isZero();
        });
    }

    @Test
    void datasSaemEmIso8601() {
        runner.run(ctx -> {
            String out = ctx.getBean(JsonMapper.class).writeValueAsString(Map.of("at", Instant.parse("2026-10-04T12:00:00Z")));
            assertThat(out).isEqualTo("{\"at\":\"2026-10-04T12:00:00Z\"}");
        });
    }
}
