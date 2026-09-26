package br.com.fashionai.infrastructure.cassandra;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.cassandra.CqlSessionBuilderCustomizer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

/**
 * Conexão da sessão Cassandra além de contact points/porta/datacenter:
 * <ul>
 *   <li>credenciais só quando CASSANDRA_USERNAME está definido (o Spring Boot recusa usuário vazio, o que quebrava
 *       Cassandra sem autenticação, como um contêiner na rede privada);</li>
 *   <li>DataStax Astra DB pelo Secure Connect Bundle, que já traz endereços, datacenter e TLS: arquivo
 *       (CASSANDRA_SECURE_BUNDLE_PATH) ou o zip em base64 (CASSANDRA_SECURE_BUNDLE_BASE64), para hosts sem arquivos.
 *       No Astra: CASSANDRA_USERNAME=token e CASSANDRA_PASSWORD=AstraCS:...</li>
 * </ul>
 */
@Configuration
@ConditionalOnProperty(name = "fashionai.cassandra.enabled", havingValue = "true")
public class CassandraCloudConfig {
    private static final Logger log = LoggerFactory.getLogger(CassandraCloudConfig.class);

    @Bean
    CqlSessionBuilderCustomizer cassandraConnection(@Value("${fashionai.cassandra.secure-connect-bundle.path:}") String path,
                                                   @Value("${fashionai.cassandra.secure-connect-bundle.base64:}") String base64,
                                                   @Value("${fashionai.cassandra.username:}") String username,
                                                   @Value("${fashionai.cassandra.password:}") String password) {
        CqlSessionBuilderCustomizer bundle = secureConnectBundle(path, base64);
        boolean auth = !username.isBlank();
        return builder -> {
            if (bundle != null) {
                bundle.customize(builder);
            }
            if (auth) {
                builder.withAuthCredentials(username, password);
            }
        };
    }

    private static CqlSessionBuilderCustomizer secureConnectBundle(String path, String base64) {
        if (!base64.isBlank()) {
            byte[] zip = Base64.getMimeDecoder().decode(base64.trim());
            log.info("Cassandra: conectando pelo Secure Connect Bundle (base64, {} bytes)", zip.length);
            // um stream novo por sessão: o builder é protótipo e pode montar mais de uma sessão
            return builder -> builder.withCloudSecureConnectBundle(new ByteArrayInputStream(zip));
        }
        if (!path.isBlank()) {
            Path file = Path.of(path.trim());
            if (!Files.isReadable(file)) {
                throw new IllegalStateException("CASSANDRA_SECURE_BUNDLE_PATH não encontrado ou sem leitura: " + file);
            }
            log.info("Cassandra: conectando pelo Secure Connect Bundle {}", file.getFileName());
            return builder -> builder.withCloudSecureConnectBundle(file);
        }
        return null;
    }
}
