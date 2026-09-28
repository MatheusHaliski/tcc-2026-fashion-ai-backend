package br.com.fashionai.infrastructure.cassandra;

import com.datastax.oss.driver.api.core.CqlSessionBuilder;
import com.datastax.oss.driver.api.core.ssl.ProgrammaticSslEngineFactory;
import com.datastax.oss.driver.api.core.ssl.SslEngineFactory;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.InputStream;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class CassandraCloudConfigTest {
    private final CassandraCloudConfig config = new CassandraCloudConfig();

    @Test
    void semBundleNaoMexeNoBuilder() {
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", "", "", "", false, "", false).customize(builder);
        verifyNoInteractions(builder);
    }

    @Test
    void bundleEmBase64UsaOsBytesDoZip() throws Exception {
        byte[] zip = {0x50, 0x4b, 0x03, 0x04, 1, 2, 3};
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", Base64.getEncoder().encodeToString(zip), "", "", false, "", false).customize(builder);
        ArgumentCaptor<InputStream> in = ArgumentCaptor.forClass(InputStream.class);
        verify(builder).withCloudSecureConnectBundle(in.capture());
        assertThat(in.getValue().readAllBytes()).isEqualTo(zip);
    }

    @Test
    void bundleEmArquivoUsaOCaminho(@TempDir Path dir) throws Exception {
        Path zip = Files.write(dir.resolve("secure-connect-fai.zip"), new byte[]{0x50, 0x4b});
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection(zip.toString(), "", "", "", false, "", false).customize(builder);
        verify(builder).withCloudSecureConnectBundle(zip);
    }

    @Test
    void credenciaisSoQuandoHaUsuario() {
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", "", "token", "AstraCS:abc", false, "", false).customize(builder);
        verify(builder).withAuthCredentials("token", "AstraCS:abc");
    }

    @Test
    void bundleEmBase64GeraUmStreamNovoPorSessao() throws Exception {
        byte[] zip = {0x50, 0x4b, 0x03, 0x04};
        var customizer = config.cassandraConnection("", Base64.getEncoder().encodeToString(zip), "", "", false, "", false);
        for (int i = 0; i < 2; i++) {
            CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
            customizer.customize(builder);
            ArgumentCaptor<InputStream> in = ArgumentCaptor.forClass(InputStream.class);
            verify(builder).withCloudSecureConnectBundle(in.capture());
            assertThat(in.getValue().readAllBytes()).isEqualTo(zip);
        }
    }

    @Test
    void arquivoInexistenteFalhaNaSubida(@TempDir Path dir) {
        assertThatThrownBy(() -> config.cassandraConnection(dir.resolve("nao-existe.zip").toString(), "", "", "", false, "", false))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CASSANDRA_SECURE_BUNDLE_PATH");
    }

    // ------------------------------------------------------------------ TLS (CASSANDRA_SSL + CASSANDRA_CA_CERT_PEM)

    /** Certificado autoassinado de teste (o do nó do Cassandra endurecido faz o papel de CA). */
    private static String selfSignedPem() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048);
        KeyPair keys = g.generateKeyPair();
        X500Name name = new X500Name("CN=cassandra.railway.internal");
        var b = new JcaX509v3CertificateBuilder(name, BigInteger.ONE, Date.from(Instant.now().minus(1, ChronoUnit.DAYS)),
                Date.from(Instant.now().plus(30, ChronoUnit.DAYS)), name, keys.getPublic());
        b.addExtension(Extension.basicConstraints, true, new BasicConstraints(true));
        X509Certificate cert = new JcaX509CertificateConverter().getCertificate(b.build(new JcaContentSignerBuilder("SHA256withRSA").build(keys.getPrivate())));
        return "-----BEGIN CERTIFICATE-----\n" + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(cert.getEncoded()) + "\n-----END CERTIFICATE-----\n";
    }

    @Test
    void tlsComCaDoPemUsaFabricaProgramatica() throws Exception {
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", "", "fai_app", "segredo", true, selfSignedPem(), false).customize(builder);
        ArgumentCaptor<SslEngineFactory> factory = ArgumentCaptor.forClass(SslEngineFactory.class);
        verify(builder).withSslEngineFactory(factory.capture());
        assertThat(factory.getValue()).isInstanceOf(ProgrammaticSslEngineFactory.class);
        verify(builder).withAuthCredentials("fai_app", "segredo");
    }

    @Test
    void tlsAceitaPemEmUmaLinhaComBarraNLiteral() throws Exception {
        String oneLine = selfSignedPem().replace("\n", "\\n");
        assertThat(CassandraCloudConfig.sslContext(oneLine)).isNotNull();
    }

    @Test
    void tlsSemPemUsaOTruststoreDaJvm() throws Exception {
        assertThat(CassandraCloudConfig.sslContext("")).isSameAs(javax.net.ssl.SSLContext.getDefault());
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", "", "", "", true, "", false).customize(builder);
        verify(builder).withSslEngineFactory(any(ProgrammaticSslEngineFactory.class));
    }

    @Test
    void semTlsNaoMexeNoSsl() {
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", "", "fai_app", "segredo", false, "", false).customize(builder);
        verify(builder, never()).withSslEngineFactory(any());
    }

    @Test
    void bundleDoAstraIgnoraCassandraSsl() {
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", Base64.getEncoder().encodeToString(new byte[]{0x50, 0x4b}), "", "", true, "", false).customize(builder);
        verify(builder, never()).withSslEngineFactory(any());
    }

    @Test
    void pemInvalidoFalhaNaSubida() {
        assertThatThrownBy(() -> config.cassandraConnection("", "", "", "", true, "nao-e-pem", false))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("CASSANDRA_CA_CERT_PEM");
    }
}
