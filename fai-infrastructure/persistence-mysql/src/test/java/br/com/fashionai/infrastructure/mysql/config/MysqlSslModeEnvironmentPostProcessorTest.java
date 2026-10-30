package br.com.fashionai.infrastructure.mysql.config;

import org.apache.commons.logging.Log;
import org.junit.jupiter.api.Test;
import org.springframework.core.Ordered;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/** MYSQL_USE_SSL legado: só vira REQUIRED quando é true e MYSQL_SSL_MODE não foi definida. */
class MysqlSslModeEnvironmentPostProcessorTest {
    private final Log log = mock(Log.class);
    private final MysqlSslModeEnvironmentPostProcessor processor = new MysqlSslModeEnvironmentPostProcessor(type -> log);

    private MockEnvironment run(MockEnvironment env) {
        processor.postProcessEnvironment(env, null);
        return env;
    }

    @Test
    void semLegadoNaoFazNada() {
        assertThat(run(new MockEnvironment()).getPropertySources().contains(MysqlSslModeEnvironmentPostProcessor.SOURCE)).isFalse();
        run(new MockEnvironment().withProperty("MYSQL_USE_SSL", " "));
        verifyNoInteractions(log);
    }

    @Test
    void modoExplicitoVenceOLegado() {
        MockEnvironment env = run(new MockEnvironment().withProperty("MYSQL_USE_SSL", "true").withProperty("MYSQL_SSL_MODE", " VERIFY_CA "));
        assertThat(env.getProperty("MYSQL_SSL_MODE")).isEqualTo(" VERIFY_CA ");
        verify(log).info(contains("MYSQL_SSL_MODE=VERIFY_CA definida"));
    }

    @Test
    void modoEmBrancoNaoContaComoDefinido() {
        MockEnvironment env = new MockEnvironment().withProperty("MYSQL_USE_SSL", "true").withProperty("MYSQL_SSL_MODE", "");
        processor.postProcessEnvironment(env, null);
        assertThat(env.getPropertySources().get(MysqlSslModeEnvironmentPostProcessor.SOURCE).getProperty("MYSQL_SSL_MODE"))
                .isEqualTo("REQUIRED");
    }

    @Test
    void legadoTrueViraRequired() {
        MockEnvironment env = run(new MockEnvironment().withProperty("MYSQL_USE_SSL", " TRUE "));
        assertThat(env.getProperty("MYSQL_SSL_MODE")).isEqualTo("REQUIRED");
        verify(log).info(contains("sslMode=REQUIRED"));
    }

    @Test
    void legadoFalseSoAvisaEFicaPreferred() {
        MockEnvironment env = run(new MockEnvironment().withProperty("MYSQL_USE_SSL", "false"));
        assertThat(env.getProperty("MYSQL_SSL_MODE")).isNull();
        verify(log).warn(contains("sslMode=PREFERRED"));
        verify(log, never()).info(anyString());
    }

    @Test
    void rodaPorUltimo() {
        assertThat(processor.getOrder()).isEqualTo(Ordered.LOWEST_PRECEDENCE);
    }
}
