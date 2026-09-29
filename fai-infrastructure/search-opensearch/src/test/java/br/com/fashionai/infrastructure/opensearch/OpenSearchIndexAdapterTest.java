package br.com.fashionai.infrastructure.opensearch;

import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * OpenSearch com o plugin de segurança: HTTPS com CA própria + usuário/senha. Um servidor HTTPS local (certificado
 * emitido por uma CA de teste só para "localhost") faz o papel do cluster.
 */
class OpenSearchIndexAdapterTest {
    private static final UUID HIT = UUID.randomUUID();
    private static TestPki pki;
    private static TestPki otherCa;
    private static HttpsServer server;
    private static final AtomicReference<String> lastAuth = new AtomicReference<>();

    @BeforeAll
    static void start() throws Exception {
        pki = new TestPki("fai-opensearch-ca-teste");
        otherCa = new TestPki("outra-ca");
        server = HttpsServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.setHttpsConfigurator(new HttpsConfigurator(pki.serverContext("localhost")));
        server.createContext("/", ex -> {
            lastAuth.set(ex.getRequestHeaders().getFirst("Authorization"));
            byte[] body = ("{\"hits\":{\"hits\":[{\"_id\":\"" + HIT + "\"}]}}").getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
    }

    @AfterAll
    static void stop() {
        server.stop(0);
    }

    @BeforeEach
    void reset() {
        lastAuth.set(null);
    }

    private static String url(String host) {
        return "https://" + host + ":" + server.getAddress().getPort();
    }

    private static List<UUID> search(OpenSearchIndexAdapter a) {
        return a.search("pieces", "vestido", Map.of("color", "preto"), 10);
    }

    @Test
    void caConfiguradaEUsuarioSenhaFuncionam() throws Exception {
        OpenSearchIndexAdapter a = new OpenSearchIndexAdapter(url("localhost"), "fai_app", "s3nha", "fai-", pki.caPem(), false, true);

        assertThat(search(a)).containsExactly(HIT);
        assertThat(lastAuth.get()).isEqualTo("Basic " + Base64.getEncoder().encodeToString("fai_app:s3nha".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void caEmUmaLinhaComBarraNLiteral() throws Exception {
        String oneLine = pki.caPem().replace("\n", "\\n");
        OpenSearchIndexAdapter a = new OpenSearchIndexAdapter(url("localhost"), "", "", "fai-", oneLine, false, true);

        assertThat(search(a)).containsExactly(HIT);
        assertThat(lastAuth.get()).isNull();
    }

    @Test
    void semCaOCertificadoAutoassinadoERecusado() {
        OpenSearchIndexAdapter a = new OpenSearchIndexAdapter(url("localhost"), "fai_app", "s3nha", "fai-", "", false, true);

        assertThat(search(a)).isEmpty();          // a busca cai para o MySQL
        assertThat(lastAuth.get()).isNull();      // e a senha nunca saiu do cliente
    }

    @Test
    void caDeOutroEmissorERecusada() throws Exception {
        OpenSearchIndexAdapter a = new OpenSearchIndexAdapter(url("localhost"), "fai_app", "s3nha", "fai-", otherCa.caPem(), false, true);

        assertThat(search(a)).isEmpty();
        assertThat(lastAuth.get()).isNull();
    }

    @Test
    void nomeDoHostDiferenteDoCertificadoERecusado() throws Exception {
        // o certificado vale só para "localhost"; conectar pelo IP falha na verificação do nome
        OpenSearchIndexAdapter strict = new OpenSearchIndexAdapter(url("127.0.0.1"), "fai_app", "s3nha", "fai-", pki.caPem(), false, true);
        assertThat(search(strict)).isEmpty();

        OpenSearchIndexAdapter chainOnly = new OpenSearchIndexAdapter(url("127.0.0.1"), "fai_app", "s3nha", "fai-", pki.caPem(), false, false);
        assertThat(search(chainOnly)).containsExactly(HIT);
    }

    @Test
    void modoInseguroAceitaAutoassinadoSemCa() {
        OpenSearchIndexAdapter a = new OpenSearchIndexAdapter(url("127.0.0.1"), "fai_app", "s3nha", "fai-", "", true, true);

        assertThat(search(a)).containsExactly(HIT);
    }

    @Test
    void pemInvalidoFalhaNaSubida() {
        assertThatThrownBy(() -> new OpenSearchIndexAdapter(url("localhost"), "", "", "fai-", "nao-e-um-pem", false, true))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("OPENSEARCH_CA_CERT_PEM");
        assertThatThrownBy(() -> new OpenSearchIndexAdapter(url("localhost"), "", "", "fai-",
                "-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----", false, true))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("OPENSEARCH_CA_CERT_PEM");
    }

    @Test
    void httpSimplesContinuaSemTls() {
        assertThat(OpenSearchIndexAdapter.sslContext(false, null, true, true)).isNull();
        assertThat(OpenSearchIndexAdapter.sslContext(true, null, false, true)).isNull();   // HTTPS com a confiança padrão da JVM
        assertThat(OpenSearchIndexAdapter.sslContext(true, null, true, true)).isNotNull();
    }
}
