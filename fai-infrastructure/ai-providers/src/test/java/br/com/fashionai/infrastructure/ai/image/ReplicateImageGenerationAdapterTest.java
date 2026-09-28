package br.com.fashionai.infrastructure.ai.image;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * O token da Replicate só vai para a própria API: {@code urls.get} de outro host é recusada e a saída hospedada fora
 * (replicate.delivery) é baixada sem o cabeçalho Authorization. Dois servidores locais fazem os papéis de
 * api.replicate.com e de um host de terceiros.
 */
class ReplicateImageGenerationAdapterTest {
    private static final String TOKEN = "r8_token_de_teste";
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13, 'I', 'H', 'D', 'R', 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0};

    /** Servidor com respostas por caminho e registro do Authorization recebido em cada pedido. */
    private static final class Fake {
        final HttpServer server;
        final Map<String, String> json = new ConcurrentHashMap<>();
        final Map<String, byte[]> files = new ConcurrentHashMap<>();
        final List<String> hits = new CopyOnWriteArrayList<>();

        Fake() throws Exception {
            server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
            server.createContext("/", ex -> {
                String path = ex.getRequestURI().getPath();
                hits.add(path + " auth=" + ex.getRequestHeaders().getFirst("Authorization"));
                ex.getRequestBody().transferTo(new ByteArrayOutputStream());
                byte[] body;
                if (files.containsKey(path)) {
                    body = files.get(path);
                    ex.getResponseHeaders().add("Content-Type", "image/png");
                } else {
                    body = json.getOrDefault(path, "{}").getBytes(StandardCharsets.UTF_8);
                    ex.getResponseHeaders().add("Content-Type", "application/json");
                }
                ex.sendResponseHeaders(json.containsKey(path) || files.containsKey(path) ? 200 : 404, body.length);
                ex.getResponseBody().write(body);
                ex.close();
            });
            server.start();
        }

        String base() {
            return "http://127.0.0.1:" + server.getAddress().getPort();
        }
    }

    private Fake api;
    private Fake other;

    @BeforeEach
    void start() throws Exception {
        api = new Fake();
        other = new Fake();
    }

    @AfterEach
    void stop() {
        api.server.stop(0);
        other.server.stop(0);
    }

    private ReplicateImageGenerationAdapter adapter() {
        return new ReplicateImageGenerationAdapter(TOKEN, "black-forest-labs/flux-schnell", api.base(), Duration.ofMillis(10));
    }

    @Test
    void saidaEmOutroHostEBaixadaSemToken() {
        api.json.put("/v1/models/black-forest-labs/flux-schnell/predictions",
                "{\"id\":\"p1\",\"status\":\"starting\",\"urls\":{\"get\":\"" + api.base() + "/v1/predictions/p1\"}}");
        api.json.put("/v1/predictions/p1", "{\"id\":\"p1\",\"status\":\"succeeded\",\"output\":[\"" + other.base() + "/out.png\"]}");
        other.files.put("/out.png", PNG);

        var img = adapter().generate("fundo", "", 1024, 1024);

        assertThat(img).isPresent();
        assertThat(api.hits).allMatch(h -> h.endsWith("auth=Bearer " + TOKEN)).hasSize(2);
        assertThat(other.hits).containsExactly("/out.png auth=null");
    }

    @Test
    void urlsGetDeOutroHostNaoRecebeOToken() {
        api.json.put("/v1/models/black-forest-labs/flux-schnell/predictions",
                "{\"id\":\"p2\",\"status\":\"processing\",\"urls\":{\"get\":\"" + other.base() + "/v1/predictions/p2\"}}");
        other.json.put("/v1/predictions/p2", "{\"id\":\"p2\",\"status\":\"succeeded\",\"output\":[\"" + other.base() + "/out.png\"]}");

        var img = adapter().generate("fundo", "", 1024, 576);

        assertThat(img).isEmpty();
        assertThat(other.hits).isEmpty();   // o host de terceiros nem foi consultado
    }

    @Test
    void saidaNaPropriaApiVaiComToken() {
        api.json.put("/v1/models/black-forest-labs/flux-schnell/predictions",
                "{\"id\":\"p3\",\"status\":\"succeeded\",\"output\":\"" + api.base() + "/v1/files/f3/download\"}");
        api.files.put("/v1/files/f3/download", PNG);

        assertThat(adapter().generate("fundo", "", 576, 1024)).isPresent();
        assertThat(api.hits).contains("/v1/files/f3/download auth=Bearer " + TOKEN);
    }

    @Test
    void origemConfereEsquemaHostEPorta() {
        ReplicateImageGenerationAdapter prod = new ReplicateImageGenerationAdapter(TOKEN, "m", ReplicateImageGenerationAdapter.API, Duration.ofSeconds(2));
        assertThat(prod.sameOrigin(URI.create("https://api.replicate.com/v1/predictions/x"))).isTrue();
        assertThat(prod.sameOrigin(URI.create("https://API.replicate.com:443/v1/predictions/x"))).isTrue();
        assertThat(prod.sameOrigin(URI.create("http://api.replicate.com/v1/predictions/x"))).isFalse();
        assertThat(prod.sameOrigin(URI.create("https://api.replicate.com.evil.example/v1"))).isFalse();
        assertThat(prod.sameOrigin(URI.create("https://evil.example@api.replicate.com/v1"))).isFalse();
        assertThat(prod.sameOrigin(URI.create("https://api.replicate.com:8443/v1"))).isFalse();
        assertThat(prod.sameOrigin(URI.create("https://replicate.delivery/abc/out.png"))).isFalse();
    }

    @Test
    void saidaSemHttpsEmOutroHostERecusadaEmProducao() {
        ReplicateImageGenerationAdapter prod = new ReplicateImageGenerationAdapter(TOKEN, "m", ReplicateImageGenerationAdapter.API, Duration.ofSeconds(2));
        assertThatThrownBy(() -> prod.downloadOutput("http://replicate.delivery/abc/out.png")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> prod.downloadOutput("file:///etc/passwd")).isInstanceOf(IllegalStateException.class);
    }
}
