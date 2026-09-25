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
 * Cassandra gerenciado sem porta CQL aberta (DataStax Astra DB): conecta pelo Secure Connect Bundle, que já traz
 * endereços, datacenter e certificados TLS. O bundle vem de um arquivo (CASSANDRA_SECURE_BUNDLE_PATH) ou do próprio
 * zip em base64 numa variável de ambiente (CASSANDRA_SECURE_BUNDLE_BASE64), para hosts que não aceitam arquivos.
 * Credenciais do Astra: CASSANDRA_USERNAME=token e CASSANDRA_PASSWORD=AstraCS:...
 */
@Configuration
@ConditionalOnProperty(name = "fashionai.cassandra.enabled", havingValue = "true")
public class CassandraCloudConfig {
    private static final Logger log = LoggerFactory.getLogger(CassandraCloudConfig.class);

    @Bean
    CqlSessionBuilderCustomizer secureConnectBundle(@Value("${fashionai.cassandra.secure-connect-bundle.path:}") String path,
                                                   @Value("${fashionai.cassandra.secure-connect-bundle.base64:}") String base64) {
        if (!base64.isBlank()) {
            byte[] zip = Base64.getMimeDecoder().decode(base64.trim());
            log.info("Cassandra: conectando pelo Secure Connect Bundle (base64, {} bytes)", zip.length);
            return builder -> builder.withCloudSecureConnectBundle(new ByteArrayInputStream(zip));
        }
        if (!path.isBlank()) {
            Path bundle = Path.of(path.trim());
            if (!Files.isReadable(bundle)) {
                throw new IllegalStateException("CASSANDRA_SECURE_BUNDLE_PATH não encontrado ou sem leitura: " + bundle);
            }
            log.info("Cassandra: conectando pelo Secure Connect Bundle {}", bundle.getFileName());
            return builder -> builder.withCloudSecureConnectBundle(bundle);
        }
        return builder -> { };
    }
}
