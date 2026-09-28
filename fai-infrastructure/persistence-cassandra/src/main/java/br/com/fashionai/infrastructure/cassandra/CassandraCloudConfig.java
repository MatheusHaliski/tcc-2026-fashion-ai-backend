package br.com.fashionai.infrastructure.cassandra;

import com.datastax.oss.driver.api.core.ssl.ProgrammaticSslEngineFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.cassandra.CqlSessionBuilderCustomizer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.util.Base64;
import java.util.Collection;

/**
 * Conexão da sessão Cassandra além de contact points/porta/datacenter:
 * <ul>
 *   <li>credenciais só quando CASSANDRA_USERNAME está definido (o Spring Boot recusa usuário vazio, o que quebrava
 *       Cassandra sem autenticação, como um contêiner na rede privada); com o Cassandra endurecido
 *       (infra/railway/cassandra, PasswordAuthenticator) o usuário é o papel da aplicação, nunca o superusuário;</li>
 *   <li>TLS cliente→nó com CASSANDRA_SSL=true: confia só na CA do PEM de CASSANDRA_CA_CERT_PEM (certificado
 *       autoassinado do nó serve como CA) ou, sem ela, no truststore padrão da JVM. A verificação do nome do host
 *       (CASSANDRA_SSL_HOSTNAME_VALIDATION) fica desligada por padrão, como no driver: o driver conecta pelos IPs
 *       descobertos no cluster, que não batem com o nome no certificado; a CA fixada já impede outro servidor;</li>
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
                                                   @Value("${fashionai.cassandra.password:}") String password,
                                                   @Value("${fashionai.cassandra.ssl.enabled:false}") boolean ssl,
                                                   @Value("${fashionai.cassandra.ssl.ca-cert-pem:}") String caCertPem,
                                                   @Value("${fashionai.cassandra.ssl.hostname-validation:false}") boolean hostnameValidation) {
        CqlSessionBuilderCustomizer bundle = secureConnectBundle(path, base64);
        boolean auth = !username.isBlank();
        SSLContext tls = null;
        if (ssl && bundle != null) {
            log.info("Cassandra: CASSANDRA_SSL ignorada — o Secure Connect Bundle já traz o TLS do Astra");
        } else if (ssl) {
            tls = sslContext(caCertPem);
            log.info("Cassandra: TLS ligado ({}; verificação do nome do host {})",
                    caCertPem == null || caCertPem.isBlank() ? "truststore padrão da JVM" : "CA de CASSANDRA_CA_CERT_PEM",
                    hostnameValidation ? "ligada" : "desligada");
        }
        SSLContext context = tls;
        return builder -> {
            if (bundle != null) {
                bundle.customize(builder);
            }
            if (context != null) {
                builder.withSslEngineFactory(new ProgrammaticSslEngineFactory(context, null, hostnameValidation));
            }
            if (auth) {
                builder.withAuthCredentials(username, password);
            }
        };
    }

    /** Contexto TLS que confia só nos certificados do PEM (aceita "\n" literal); PEM vazio = truststore da JVM. */
    static SSLContext sslContext(String caCertPem) {
        try {
            if (caCertPem == null || caCertPem.isBlank()) {
                return SSLContext.getDefault();
            }
            String pem = caCertPem.replace("\\n", "\n").trim();
            if (!pem.contains("-----BEGIN CERTIFICATE-----")) {
                throw new IllegalStateException("CASSANDRA_CA_CERT_PEM não contém um certificado PEM (-----BEGIN CERTIFICATE-----)");
            }
            Collection<? extends Certificate> certs = CertificateFactory.getInstance("X.509")
                    .generateCertificates(new ByteArrayInputStream(pem.getBytes(StandardCharsets.US_ASCII)));
            if (certs.isEmpty()) {
                throw new IllegalStateException("CASSANDRA_CA_CERT_PEM sem certificados");
            }
            KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
            ks.load(null, null);
            int i = 0;
            for (Certificate c : certs) {
                ks.setCertificateEntry("cassandra-ca-" + i++, c);
            }
            TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(ks);
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, tmf.getTrustManagers(), null);
            return ctx;
        } catch (GeneralSecurityException | java.io.IOException ex) {
            throw new IllegalStateException("CASSANDRA_CA_CERT_PEM inválido: " + ex.getMessage(), ex);
        }
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
