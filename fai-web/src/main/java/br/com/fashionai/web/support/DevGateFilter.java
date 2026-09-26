package br.com.fashionai.web.support;

import br.com.fashionai.application.common.Msg;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

/**
 * Gate de desenvolvedor na API: enquanto o app não é público, toda requisição precisa do cabeçalho {@code X-Dev-Gate}
 * com o token assinado pelo /gate do frontend ({@code v1.<usuário>.<expira>.<HMAC-SHA256 base64url>}, mesmo segredo
 * DEV_GATE_SECRET nos dois lados). Ficam de fora o preflight CORS, a saúde do serviço e /media (imagens carregadas por
 * &lt;img&gt;, que não enviam cabeçalhos; os caminhos têm UUID). Ligado com DEV_GATE_ENABLED=true; ligado sem segredo,
 * falha fechado. Não substitui a autenticação: o JWT continua valendo depois do gate.
 */
@Component
@Order(-103)   // depois do idioma (-104), antes do Spring Security (-100)
public class DevGateFilter extends OncePerRequestFilter {
    static final String HEADER = "X-Dev-Gate";
    private static final List<String> OPEN = List.of("/actuator/health", "/actuator/info", "/media/");

    private final boolean enabled;
    private final String secret;
    private final String user;
    private final List<String> origins;

    public DevGateFilter(@Value("${fashionai.dev-gate.enabled:false}") boolean enabled,
                         @Value("${fashionai.dev-gate.secret:}") String secret,
                         @Value("${fashionai.dev-gate.user:matheushaliskitcc20233}") String user,
                         @Value("${fashionai.cors.allowed-origins:http://localhost:3000}") String origins) {
        this.enabled = enabled;
        this.secret = secret == null ? "" : secret.trim();
        this.user = user == null ? "" : user.trim();
        this.origins = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        if (!enabled || "OPTIONS".equalsIgnoreCase(req.getMethod())) {
            return true;
        }
        String path = req.getRequestURI();
        return OPEN.stream().anyMatch(p -> p.endsWith("/") ? path.startsWith(p) : path.equals(p));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        if (valid(req.getHeader(HEADER), secret, user, Instant.now().getEpochSecond())) {
            chain.doFilter(req, res);
            return;
        }
        String origin = req.getHeader("Origin");
        if (origin != null && origins.contains(origin)) {       // o navegador precisa do CORS para ler o 403
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader("Access-Control-Expose-Headers", "X-Dev-Gate-Required");
            res.addHeader("Vary", "Origin");
        }
        res.setStatus(HttpServletResponse.SC_FORBIDDEN);
        res.setHeader("X-Dev-Gate-Required", "1");
        res.setHeader("Cache-Control", "no-store");
        res.setContentType("application/json;charset=UTF-8");
        String msg = Msg.t("security.gate_de_desenvolvedor").replace("\\", "\\\\").replace("\"", "\\\"");
        res.getWriter().write("{\"code\":\"DEV_GATE\",\"message\":\"" + msg + "\"}");
    }

    /** Confere formato, usuário, validade e assinatura (comparação em tempo constante). */
    static boolean valid(String token, String secret, String user, long nowEpoch) {
        if (token == null || secret == null || secret.isEmpty()) {
            return false;
        }
        String[] p = token.trim().split("\\.");
        if (p.length != 4 || !"v1".equals(p[0]) || !p[1].equals(user)) {
            return false;
        }
        long exp;
        try {
            exp = Long.parseLong(p[2]);
        } catch (NumberFormatException e) {
            return false;
        }
        if (exp < nowEpoch) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(("v1." + p[1] + "." + p[2]).getBytes(StandardCharsets.UTF_8));
            byte[] given = Base64.getUrlDecoder().decode(p[3]);
            return MessageDigest.isEqual(expected, given);
        } catch (Exception e) {
            return false;
        }
    }
}
