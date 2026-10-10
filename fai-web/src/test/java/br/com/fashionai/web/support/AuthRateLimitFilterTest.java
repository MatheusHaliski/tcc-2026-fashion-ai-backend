package br.com.fashionai.web.support;

import br.com.fashionai.application.ports.RateLimitPort;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Limite por IP da autenticação: casa com o caminho decodificado e usa o IP resolvido, não o X-Forwarded-For. */
class AuthRateLimitFilterTest {
    private final Map<String, Integer> counts = new ConcurrentHashMap<>();
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

    private static MockHttpServletRequest from(String method, String path, String realIp) {
        MockHttpServletRequest r = new MockHttpServletRequest(method, path);
        r.setServletPath(path);
        r.setRemoteAddr("10.0.0.9");
        r.addHeader("X-Real-IP", realIp);
        return r;
    }

    /** Um cliente IPv6 controla um /64 inteiro: trocar o fim do endereço não pode abrir balde novo. */
    @Test
    void ipv6ContaPorPrefixo64() throws Exception {
        for (int i = 0; i < 30; i++) {
            assertEquals(200, send(from("POST", "/api/auth/login", "2001:db8:1:2::" + Integer.toHexString(i + 1))));
        }
        assertEquals(429, send(from("POST", "/api/auth/login", "2001:db8:1:2:ffff:ffff:ffff:1")));
        assertEquals(200, send(from("POST", "/api/auth/login", "2001:db8:1:3::1")));     // outro /64: outro cliente
        assertEquals("203.0.113.5", AuthRateLimitFilter.bucketKey("::ffff:203.0.113.5"));
        assertEquals("20010db800010002::/64", AuthRateLimitFilter.bucketKey("2001:db8:1:2::abcd"));
    }

    @Test
    void trocaDeSenhaEConsultaDeUsernamesTambemSaoLimitadas() throws Exception {
        for (int i = 0; i < 20; i++) {
            assertEquals(200, send(from("PUT", "/api/auth/password", "198.51.100.7")));
        }
        assertEquals(429, send(from("PUT", "/api/auth/password", "198.51.100.7")));
        for (int i = 0; i < 120; i++) {
            assertEquals(200, send(from("GET", "/api/usernames/alvo" + i + "/availability", "198.51.100.8")));
        }
        assertEquals(429, send(from("GET", "/api/usernames/outro/availability", "198.51.100.8")));
        assertEquals(200, send(from("GET", "/api/usernames/a/b/availability", "198.51.100.8")));  // * é um segmento só
    }

    /**
     * Bulkhead do Argon2: com as vagas ocupadas, o pedido seguinte espera pouco e recebe 503 + Retry-After em vez de
     * segurar uma conexão do banco (antes, 60 logins paralelos esgotavam o pool e a API toda dava 500).
     */
    @Test
    void hashesSimultaneosAcimaDoTetoRecebem503() throws Exception {
        AuthRateLimitFilter oneSlot = new AuthRateLimitFilter(rateLimit, new ClientIpResolver("", "X-Real-IP"), true,
                "http://localhost:3000", 1, 50, 10);
        CountDownLatch inside = new CountDownLatch(1);
        CountDownLatch leave = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<Integer> slow = pool.submit(() -> {
                MockHttpServletResponse res = new MockHttpServletResponse();
                oneSlot.doFilter(from("POST", "/api/auth/login", "198.51.100.20"), res, (rq, rs) -> {
                    inside.countDown();
                    try {
                        leave.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                });
                return res.getStatus();
            });
            inside.await(5, TimeUnit.SECONDS);
            MockHttpServletResponse busy = new MockHttpServletResponse();
            oneSlot.doFilter(from("POST", "/api/auth/login", "198.51.100.21"), busy, new MockFilterChain());
            assertEquals(503, busy.getStatus());
            assertEquals("2", busy.getHeader("Retry-After"));
            // rota que não calcula hash não disputa a vaga
            MockHttpServletResponse refresh = new MockHttpServletResponse();
            oneSlot.doFilter(from("POST", "/api/auth/refresh", "198.51.100.21"), refresh, new MockFilterChain());
            assertEquals(200, refresh.getStatus());
            leave.countDown();
            assertEquals(200, slow.get(5, TimeUnit.SECONDS));
            MockHttpServletResponse after = new MockHttpServletResponse();
            oneSlot.doFilter(from("POST", "/api/auth/login", "198.51.100.21"), after, new MockFilterChain());
            assertEquals(200, after.getStatus());          // a vaga volta depois do pedido
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void tetoPadraoSobraConexaoNoPool() {
        assertEquals(4, AuthRateLimitFilter.defaultHashPermits(4, 10));
        assertEquals(5, AuthRateLimitFilter.defaultHashPermits(16, 10));
        assertEquals(2, AuthRateLimitFilter.defaultHashPermits(1, 10));
        assertEquals(1, AuthRateLimitFilter.defaultHashPermits(8, 2));
    }

    @Test
    void outrasRotasNaoSaoLimitadas() throws Exception {
        for (int i = 0; i < 40; i++) {
            assertEquals(200, send(login("/api/feed", "/api/feed", null)));
        }
    }
}
