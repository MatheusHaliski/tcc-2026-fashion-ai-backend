package br.com.fashionai.infrastructure.ai.moderation;

import br.com.fashionai.application.moderation.ImageSafetyPorts.Likelihoods;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Leitura da resposta do SafeSearch (sem rede): a escala textual vira 0–5; e a chave só no cabeçalho. */
class GoogleVisionSafeSearchAdapterTest {

    @Test
    void escalaDoSafeSearch() {
        Optional<Likelihoods> l = GoogleVisionSafeSearchAdapter.parse(Map.of("safeSearchAnnotation",
                Map.of("adult", "LIKELY", "racy", "VERY_LIKELY", "violence", "VERY_UNLIKELY", "spoof", "UNLIKELY", "medical", "POSSIBLE")));
        assertEquals(new Likelihoods(4, 5, 1), l.orElseThrow());
        assertEquals(0, GoogleVisionSafeSearchAdapter.level("OUTRA_COISA"));
        assertEquals(0, GoogleVisionSafeSearchAdapter.level(null));
    }

    @Test
    void respostaSemAnotacaoNaoDecide() {
        assertTrue(GoogleVisionSafeSearchAdapter.parse(Map.of("error", Map.of("code", 403))).isEmpty());
    }

    @Test
    void semChaveNaoEChamado() {
        assertFalse(new GoogleVisionSafeSearchAdapter("", 30).available());
        assertFalse(new GoogleVisionSafeSearchAdapter("placeholder-key", 30).available());
    }

    @Test
    void chaveVaiNoCabecalhoENuncaNaUrl() throws Exception {
        AtomicReference<String> query = new AtomicReference<>();
        AtomicReference<String> header = new AtomicReference<>();
        AtomicReference<String> path = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/", ex -> {
            query.set(ex.getRequestURI().getRawQuery());
            path.set(ex.getRequestURI().getPath());
            header.set(ex.getRequestHeaders().getFirst("x-goog-api-key"));
            byte[] body = ("{\"responses\":[{\"safeSearchAnnotation\":"
                    + "{\"adult\":\"VERY_UNLIKELY\",\"racy\":\"UNLIKELY\",\"violence\":\"VERY_UNLIKELY\"}}]}").getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
        try {
            GoogleVisionSafeSearchAdapter a = new GoogleVisionSafeSearchAdapter("AIza-teste-123", 5, "http://127.0.0.1:" + server.getAddress().getPort());
            assertEquals(new Likelihoods(1, 2, 1), a.classify(new byte[]{1, 2, 3}).orElseThrow());
            assertEquals("/v1/images:annotate", path.get());
            assertEquals("AIza-teste-123", header.get());
            assertNull(query.get(), "a chave não pode ir na query string");
        } finally {
            server.stop(0);
        }
    }
}
