package br.com.fashionai.infrastructure.mysql.config;

import org.apache.commons.logging.Log;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.logging.DeferredLogFactory;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Map;

/**
 * Compatibilidade da variável antiga MYSQL_USE_SSL com o {@code sslMode} do Connector/J (application.yml usa
 * {@code sslMode=${MYSQL_SSL_MODE:PREFERRED}}; o {@code useSSL} saiu da URL porque, com os dois presentes, o driver
 * ignora o legado e isso esconderia a intenção de quem configurou).
 * <ul>
 *   <li>MYSQL_SSL_MODE definida: vale ela, e MYSQL_USE_SSL é ignorada;</li>
 *   <li>só MYSQL_USE_SSL=true: vira {@code MYSQL_SSL_MODE=REQUIRED} (o que {@code useSSL=true} significava);</li>
 *   <li>só MYSQL_USE_SSL=false: <b>não</b> vira DISABLED — sem TLS e sem {@code allowPublicKeyRetrieval} (agora
 *       desligado por padrão) o caching_sha2_password falha depois de um restart do MySQL. Fica PREFERRED, que
 *       usa TLS quando o servidor oferece (Railway, mysql:8.x do Docker) e loga um aviso. Para desligar TLS de
 *       propósito: MYSQL_SSL_MODE=DISABLED e MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL=true.</li>
 * </ul>
 */
public class MysqlSslModeEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
    static final String SOURCE = "fashionai-mysql-use-ssl-legado";
    private final Log log;

    public MysqlSslModeEnvironmentPostProcessor(DeferredLogFactory logs) {
        this.log = logs.getLog(MysqlSslModeEnvironmentPostProcessor.class);
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication application) {
        String mode = env.getProperty("MYSQL_SSL_MODE");
        String legacy = env.getProperty("MYSQL_USE_SSL");
        if (legacy == null || legacy.isBlank()) {
            return;
        }
        if (mode != null && !mode.isBlank()) {
            log.info("MYSQL_SSL_MODE=" + mode.trim() + " definida; MYSQL_USE_SSL (legado) ignorada — pode removê-la");
            return;
        }
        if (Boolean.parseBoolean(legacy.trim())) {
            env.getPropertySources().addLast(new MapPropertySource(SOURCE, Map.of("MYSQL_SSL_MODE", "REQUIRED")));
            log.info("MYSQL_USE_SSL=true (legado) -> sslMode=REQUIRED; prefira MYSQL_SSL_MODE=REQUIRED");
        } else {
            log.warn("MYSQL_USE_SSL=false (legado) ignorada: a conexão usa sslMode=PREFERRED (TLS quando o servidor oferece). "
                    + "Para desligar TLS de propósito: MYSQL_SSL_MODE=DISABLED e MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL=true");
        }
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
