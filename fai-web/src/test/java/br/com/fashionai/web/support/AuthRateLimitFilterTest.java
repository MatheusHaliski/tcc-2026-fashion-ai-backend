package br.com.fashionai.web.support;

import br.com.fashionai.application.ports.RateLimitPort;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Limite por IP da autenticação: casa com o caminho decodificado e usa o IP resolvido, não o X-Forwarded-For. */
class AuthRateLimitFilterTest {
    private final Map<String, Integer> counts = new HashMap<>();
    private final RateLimitPort rateLimit = new RateLimitPort() {
        @Override
        public boolean tryAcquire(UUID userId, String bucket, int limit, Duration window) {
            return counts.merge(bucket + ":" + userId, 1, Integer::sum) <= limit;
        }

        @Override
        public QuotaStatus status(UUID userId, String bucket, int limit, Duration window) {
            return new QuotaStatus(limit, 0, Instant.now());
        }
    };
    private final AuthRateLimitFilter filter = new AuthRateLimitFilter(rateLimit, new ClientIpResolver("", "X-Real-IP"), true,
            "http://localhost:3000");

    /** Como o Tomcat entrega: URI crua como veio, servletPath já decodificado. */
    private static MockHttpServletRequest login(String rawUri, String servletPath, String xff) {
        MockHttpServletRequest r = new MockHttpServletRequest("POST", rawUri);
        r.setServletPath(servletPath);
        r.setRemoteAddr("10.0.0.9");
        if (xff != null) {
            r.addHeader("X-Forwarded-For", xff);
        }
        return r;
    }

    private int send(MockHttpServletRequest r) throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(r, res, new MockFilterChain());
        return res.getStatus();
    }

    @Test
    void uriCodificadaNaoEscapaDaRegraDoLogin() throws Exception {
        for (int i = 0; i < 30; i++) {
            assertEquals(200, send(login("/api/auth/login", "/api/auth/login", null)));
        }
        assertEquals(429, send(login("/api/auth/%6cogin", "/api/auth/login", null)));
        assertEquals(429, send(login("/api/auth/login/", "/api/auth/login/", null)));
        assertEquals(429, send(login("/api//auth/LOGIN", "/api//auth/LOGIN", null)));
    }

    @Test
    void trocarOXForwardedForNaoAbreUmBaldeNovo() throws Exception {
        for (int i = 0; i < 30; i++) {
            assertEquals(200, send(login("/api/auth/login", "/api/auth/login", "203.0.113." + i)));
        }
        assertEquals(429, send(login("/api/auth/login", "/api/auth/login", "198.51.100.1")));
    }

    @Test
    void semServletPathDecodificaAUri() throws Exception {
        for (int i = 0; i < 30; i++) {
            send(login("/api/auth/%6Cogin", "", null));
        }
        assertEquals(429, send(login("/api/auth/login", "", null)));
    }

    @Test
    void outrasRotasNaoSaoLimitadas() throws Exception {
        for (int i = 0; i < 40; i++) {
            assertEquals(200, send(login("/api/feed", "/api/feed", null)));
        }
    }
}
