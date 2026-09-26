package br.com.fashionai.web.support;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.RateLimitPort;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Limite por IP nas rotas públicas de autenticação (OWASP API4 — consumo irrestrito; API2 — autenticação quebrada).
 * O bloqueio por conta (5 senhas erradas) já existe no IdentityService; este filtro freia o "credential stuffing" que
 * troca de conta a cada tentativa e a criação de contas em massa. Usa o mesmo RateLimitPort (Redis quando configurado,
 * memória no ambiente local), com o IP como dono do balde. O IP vem do proxy (server.forward-headers-strategy).
 */
@Component
@Order(-102)   // depois do gate (-103), antes do Spring Security (-100)
public class AuthRateLimitFilter extends OncePerRequestFilter {
    record Rule(int limit, Duration window) {
    }

    static final Map<String, Rule> RULES = Map.of(
            "/api/auth/login", new Rule(30, Duration.ofMinutes(10)),
            "/api/auth/register", new Rule(10, Duration.ofHours(1)),
            "/api/auth/uploads", new Rule(40, Duration.ofHours(1)),
            "/api/auth/refresh", new Rule(120, Duration.ofMinutes(10)),
            "/api/auth/password-reset/request", new Rule(10, Duration.ofHours(1)),
            "/api/auth/password-reset/confirm", new Rule(20, Duration.ofHours(1)));

    private final RateLimitPort rateLimit;
    private final boolean enabled;
    private final List<String> origins;

    public AuthRateLimitFilter(RateLimitPort rateLimit,
                               @Value("${fashionai.security.auth-rate-limit.enabled:true}") boolean enabled,
                               @Value("${fashionai.cors.allowed-origins:http://localhost:3000}") String origins) {
        this.rateLimit = rateLimit;
        this.enabled = enabled;
        this.origins = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !enabled || !"POST".equalsIgnoreCase(req.getMethod()) || !RULES.containsKey(req.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        Rule rule = RULES.get(req.getRequestURI());
        UUID owner = UUID.nameUUIDFromBytes(("ip:" + req.getRemoteAddr()).getBytes(StandardCharsets.UTF_8));
        String bucket = "ip" + req.getRequestURI().replace('/', ':');
        if (rateLimit.tryAcquire(owner, bucket, rule.limit(), rule.window())) {
            chain.doFilter(req, res);
            return;
        }
        String origin = req.getHeader("Origin");
        if (origin != null && origins.contains(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader("Access-Control-Expose-Headers", "Retry-After");
            res.addHeader("Vary", "Origin");
        }
        res.setStatus(429);
        res.setHeader("Retry-After", String.valueOf(rule.window().toSeconds()));
        res.setContentType("application/json;charset=UTF-8");
        String msg = Msg.t("security.muitas_tentativas_ip").replace("\\", "\\\\").replace("\"", "\\\"");
        res.getWriter().write("{\"code\":\"MUITAS_TENTATIVAS\",\"message\":\"" + msg + "\"}");
    }
}
