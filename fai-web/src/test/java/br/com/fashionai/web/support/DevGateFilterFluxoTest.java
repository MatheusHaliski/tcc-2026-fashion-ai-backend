package br.com.fashionai.web.support;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Gate na requisição: rotas abertas, token builtin/legado, modo Cloudflare e a resposta 403 com CORS. */
class DevGateFilterFluxoTest {
    static final String SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres";
    static final String ORIGIN = "http://localhost:3000";
    static final long FUTURE = Instant.now().getEpochSecond() + 3600;

    static String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String ga(String json, long exp) {
        String body = "ga." + Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8)) + "." + exp;
        return body + "." + sign(body);
    }

    static String legacy(String user, long exp) {
        String body = "v1." + user + "." + exp;
        return body + "." + sign(body);
    }

    private static DevGateFilter builtin(String emails, boolean acceptLegacy) {
        return new DevGateFilter(true, "builtin", SECRET, "equipe", emails, "", "", acceptLegacy, ORIGIN + ", ,http://app");
    }

    private static MockHttpServletResponse run(DevGateFilter filter, MockHttpServletRequest req, MockFilterChain chain) throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, chain);
        return res;
    }

    private static MockHttpServletRequest get(String path) {
        return new MockHttpServletRequest("GET", path);
    }

    @Test
    void desligadoPreflightSaudeEMediaPassamSemToken() throws Exception {
        DevGateFilter off = new DevGateFilter(false, null, null, null, null, null, null, true, ORIGIN);
        MockFilterChain chain = new MockFilterChain();
        run(off, get("/api/x"), chain);
        assertThat(chain.getRequest()).isNotNull();
        DevGateFilter on = builtin("", true);
        for (MockHttpServletRequest req : new MockHttpServletRequest[]{new MockHttpServletRequest("OPTIONS", "/api/x"),
                get("/actuator/health"), get("/actuator/info"), get("/media/a.png")}) {
            MockFilterChain c = new MockFilterChain();
            assertThat(run(on, req, c).getStatus()).isEqualTo(200);
            assertThat(c.getRequest()).isSameAs(req);
        }
    }

    @Test
    void semTokenRecebe403ComCorsParaOrigemPermitida() throws Exception {
        MockHttpServletRequest req = get("/actuator/health/x");
        req.addHeader("Origin", ORIGIN);
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse res = run(builtin("", true), req, chain);
        assertThat(chain.getRequest()).isNull();
        assertThat(res.getStatus()).isEqualTo(403);
        assertThat(res.getHeader("X-Dev-Gate-Required")).isEqualTo("1");
        assertThat(res.getHeader("Access-Control-Allow-Origin")).isEqualTo(ORIGIN);
        assertThat(res.getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(res.getContentAsString()).startsWith("{\"code\":\"DEV_GATE\",\"message\":\"");
    }

    @Test
    void origemDesconhecidaNaoRecebeCors() throws Exception {
        MockHttpServletRequest req = get("/api/x");
        req.addHeader("Origin", "https://evil.example");
        MockHttpServletResponse res = run(builtin("", true), req, new MockFilterChain());
        assertThat(res.getStatus()).isEqualTo(403);
        assertThat(res.getHeader("Access-Control-Allow-Origin")).isNull();
    }

    @Test
    void tokenDeApiValidoPassaERevogadoNao() throws Exception {
        String token = ga("{\"i\":\" Ana@Exemplo.com \",\"j\":\"x\"}", FUTURE);
        MockHttpServletRequest req = get("/api/x");
        req.addHeader(DevGateFilter.HEADER, token);
        MockFilterChain chain = new MockFilterChain();
        run(builtin("ana@exemplo.com", true), req, chain);
        assertThat(chain.getRequest()).isSameAs(req);

        MockHttpServletRequest revoked = get("/api/x");
        revoked.addHeader(DevGateFilter.HEADER, token);
        assertThat(run(builtin("bia@exemplo.com", false), revoked, new MockFilterChain()).getStatus()).isEqualTo(403);
    }

    @Test
    void tokenLegadoSoComTransicaoLigada() throws Exception {
        String token = legacy("equipe", FUTURE);
        MockHttpServletRequest req = get("/api/x");
        req.addHeader(DevGateFilter.HEADER, token);
        MockFilterChain chain = new MockFilterChain();
        run(builtin("", true), req, chain);
        assertThat(chain.getRequest()).isSameAs(req);

        MockHttpServletRequest off = get("/api/x");
        off.addHeader(DevGateFilter.HEADER, token);
        assertThat(run(builtin("", false), off, new MockFilterChain()).getStatus()).isEqualTo(403);
    }

    @Test
    void tokenMalFormadoEhRecusado() {
        long now = Instant.now().getEpochSecond();
        assertThat(DevGateFilter.valid("ga.x.nao-numero.y", SECRET, Set.of(), now)).isFalse();
        assertThat(DevGateFilter.valid(ga("{\"j\":\"x\"}", FUTURE), SECRET, Set.of(), now)).isFalse();
        assertThat(DevGateFilter.valid(ga("{\"i\":\"ana\"}", FUTURE), null, Set.of(), now)).isFalse();
        String naoJson = "ga.bmFvLWpzb24." + FUTURE;
        assertThat(DevGateFilter.valid(naoJson + "." + sign(naoJson), SECRET, Set.of(), now)).isFalse();
        assertThat(DevGateFilter.validLegacy("v1.equipe.x.y", SECRET, "equipe", now)).isFalse();
        assertThat(DevGateFilter.validLegacy("v2.equipe." + FUTURE + ".y", SECRET, "equipe", now)).isFalse();
        assertThat(DevGateFilter.validLegacy("v1.equipe." + FUTURE, SECRET, "equipe", now)).isFalse();
        assertThat(DevGateFilter.validLegacy(legacy("equipe", FUTURE), SECRET, "", now)).isFalse();
        assertThat(DevGateFilter.validLegacy(legacy("equipe", FUTURE), SECRET, null, now)).isFalse();
        assertThat(DevGateFilter.validLegacy(null, SECRET, "equipe", now)).isFalse();
        assertThat(DevGateFilter.validLegacy(legacy("equipe", FUTURE), null, "equipe", now)).isFalse();
    }

    private static DevGateFilter cloudflare(String emails, JwtDecoder decoder) throws Exception {
        DevGateFilter f = new DevGateFilter(true, " Cloudflare ", "", "equipe", emails, "https://time.cloudflareaccess.com/", "aud-1", true, ORIGIN);
        Field field = DevGateFilter.class.getDeclaredField("cloudflare");
        field.setAccessible(true);
        field.set(f, decoder);
        return f;
    }

    private static Jwt jwt(String email, String sub) {
        Jwt.Builder b = Jwt.withTokenValue("t").header("alg", "RS256").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60));
        if (email != null) b.claim("email", email);
        if (sub != null) b.subject(sub);
        if (email == null && sub == null) b.claim("x", 1);
        return b.build();
    }

    private static int status(DevGateFilter f, String header) throws Exception {
        MockHttpServletRequest req = get("/api/x");
        if (header != null) req.addHeader(DevGateFilter.CLOUDFLARE_HEADER, header);
        MockFilterChain chain = new MockFilterChain();
        int code = run(f, req, chain).getStatus();
        return chain.getRequest() == null ? code : 200;
    }

    @Test
    void cloudflareConfereEmailOuSubjectContraALista() throws Exception {
        assertThat(status(cloudflare("", t -> jwt("Ana@Exemplo.com", null)), " jwt ")).isEqualTo(200);
        assertThat(status(cloudflare("ana@exemplo.com", t -> jwt(null, "ANA@exemplo.com")), "jwt")).isEqualTo(200);
        assertThat(status(cloudflare("bia@exemplo.com", t -> jwt("ana@exemplo.com", null)), "jwt")).isEqualTo(403);
        assertThat(status(cloudflare("", t -> jwt(null, null)), "jwt")).isEqualTo(403);
        assertThat(status(cloudflare("", t -> {
            throw new JwtException("assinatura");
        }), "jwt")).isEqualTo(403);
        assertThat(status(cloudflare("", t -> jwt("a", null)), null)).isEqualTo(403);
        assertThat(status(cloudflare("", t -> jwt("a", null)), " ")).isEqualTo(403);
        assertThat(status(cloudflare("", null), "jwt")).isEqualTo(403);
    }

    @Test
    void cloudflareSemAudienciaNaoSobe() {
        assertThatThrownBy(() -> new DevGateFilter(true, "cloudflare", "", "u", "", "time.example", " ", true, ORIGIN))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new DevGateFilter(true, "cloudflare", "", "u", "", null, "aud", true, ORIGIN))
                .isInstanceOf(IllegalStateException.class);
    }
}
