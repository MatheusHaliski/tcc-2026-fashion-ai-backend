package br.com.fashionai.web.support;

import jakarta.servlet.http.HttpServletRequestWrapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** IP do cliente: assinatura do BFF, cabeçalho da borda e conexão — o X-Forwarded-For nunca decide. */
class ClientIpResolverTest {
    private static final String SECRET = "segredo-da-borda";
    private static final long NOW = 1_800_000_000L;

    private static ClientIpResolver resolver(String secret, String header) {
        return new ClientIpResolver(secret, header, () -> NOW);
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest r = new MockHttpServletRequest("POST", "/api/auth/login");
        r.setRemoteAddr("10.0.0.9");
        return r;
    }

    private static void signed(MockHttpServletRequest r, String ip, long ts, String secret) {
        r.addHeader(ClientIpResolver.SIGNED_IP, ip);
        r.addHeader(ClientIpResolver.SIGNED_TS, String.valueOf(ts));
        r.addHeader(ClientIpResolver.SIGNED_SIG, ClientIpResolver.signature(secret, ip, ts));
    }

    @Test
    void cabecalhoAssinadoPeloBffVence() {
        MockHttpServletRequest r = request();
        signed(r, "203.0.113.7", NOW - 5, SECRET);
        r.addHeader("X-Real-IP", "198.51.100.1");
        assertEquals("203.0.113.7", resolver(SECRET, "X-Real-IP").resolve(r));
    }

    @Test
    void assinaturaErradaVencidaOuSemSegredoCaiParaABorda() {
        MockHttpServletRequest wrongSecret = request();
        signed(wrongSecret, "203.0.113.7", NOW, "outro-segredo");
        wrongSecret.addHeader("X-Real-IP", "198.51.100.1");
        assertEquals("198.51.100.1", resolver(SECRET, "X-Real-IP").resolve(wrongSecret));

        MockHttpServletRequest old = request();
        signed(old, "203.0.113.7", NOW - 61, SECRET);
        assertEquals("10.0.0.9", resolver(SECRET, "").resolve(old));

        MockHttpServletRequest future = request();
        signed(future, "203.0.113.7", NOW + 61, SECRET);
        assertEquals("10.0.0.9", resolver(SECRET, "").resolve(future));

        MockHttpServletRequest noSecret = request();
        signed(noSecret, "203.0.113.7", NOW, SECRET);
        assertEquals("10.0.0.9", resolver("", "").resolve(noSecret));
    }

    @Test
    void ipTrocadoDepoisDeAssinadoNaoVale() {
        MockHttpServletRequest r = request();
        r.addHeader(ClientIpResolver.SIGNED_IP, "203.0.113.99");
        r.addHeader(ClientIpResolver.SIGNED_TS, String.valueOf(NOW));
        r.addHeader(ClientIpResolver.SIGNED_SIG, ClientIpResolver.signature(SECRET, "203.0.113.7", NOW));
        assertEquals("10.0.0.9", resolver(SECRET, "").resolve(r));
    }

    @Test
    void xForwardedForEscritoPeloClienteNuncaDecide() {
        MockHttpServletRequest r = request();
        r.addHeader("X-Forwarded-For", "1.2.3.4, 10.0.0.9");
        assertEquals("10.0.0.9", resolver("", "X-Real-IP").resolve(r));
        assertEquals("10.0.0.9", CorrelationIdFilter.clientIp(request()));
    }

    @Test
    void conexaoOriginalMesmoComORequestEmbrulhadoPeloForwardedHeaderFilter() {
        MockHttpServletRequest raw = request();
        HttpServletRequestWrapper forwarded = new HttpServletRequestWrapper(raw) {
            @Override
            public String getRemoteAddr() {
                return "1.2.3.4";                              // o que o ForwardedHeaderFilter devolveria do XFF
            }
        };
        assertEquals("10.0.0.9", resolver("", "X-Real-IP").resolve(forwarded));
    }

    @Test
    void valorQueNaoEIpLiteralCaiParaAProximaFonte() {
        for (String bad : new String[]{"exemplo.com", "1.2.3.4, 5.6.7.8", "999.1.1.1", "localhost", "::g", ""}) {
            MockHttpServletRequest r = request();
            r.addHeader("X-Real-IP", bad);
            assertEquals("10.0.0.9", resolver("", "X-Real-IP").resolve(r), bad);
        }
        MockHttpServletRequest disabled = request();
        disabled.addHeader("X-Real-IP", "198.51.100.1");
        assertEquals("10.0.0.9", resolver("", "").resolve(disabled));
    }

    @Test
    void normalizaIpv6() {
        assertEquals("2001:db8:0:0:0:0:0:1", ClientIpResolver.literalIp("2001:db8::1"));
        assertEquals("2001:db8:0:0:0:0:0:1", ClientIpResolver.literalIp("[2001:DB8::1]"));
        assertEquals("192.0.2.1", ClientIpResolver.literalIp("::ffff:192.0.2.1"));
        assertNull(ClientIpResolver.literalIp("fe80::1%eth0"));
    }

    @Test
    void resolveUmaVezEDeixaParaOClientIpEstatico() {
        MockHttpServletRequest r = request();
        r.addHeader("X-Real-IP", "198.51.100.1");
        resolver("", "X-Real-IP").resolve(r);
        assertEquals("198.51.100.1", CorrelationIdFilter.clientIp(r));
    }
}
