package br.com.fashionai.web.support;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.RateLimitPort;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Freios das rotas de autenticação (OWASP API4:2023 — consumo irrestrito; A07 — falhas de autenticação):
 * <ol>
 *   <li><b>Limite por IP</b>: o bloqueio por conta (5 senhas erradas, IdentityService) não segura o "credential
 *       stuffing" que troca de conta a cada tentativa, nem a criação de contas em massa. O IP vem do
 *       {@link ClientIpResolver} (nunca do X-Forwarded-For); IPv6 conta por prefixo /64 — um único cliente IPv6
 *       recebe 2^64 endereços e abriria um balde novo a cada pedido. A regra casa com o método e o caminho
 *       normalizado ({@link RequestPaths}), não com a URI crua.</li>
 *   <li><b>Teto de hashes simultâneos</b> (bulkhead) nas rotas que calculam Argon2: o hash é CPU pesada e a requisição
 *       segura uma conexão do banco enquanto calcula. Sem teto, 60 logins em paralelo (dois IPs dentro do limite)
 *       esgotavam o pool do Hikari e a API inteira respondia 500. Quem não consegue vaga em poucos segundos recebe 503
 *       com Retry-After — o resto da API segue com conexões livres.</li>
 * </ol>
 * Contadores no RateLimitPort (Redis quando ligado, memória com teto de entradas no resto).
 */
@Component
@Order(-102)   // depois do gate (-103), antes do Spring Security (-100)
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(AuthRateLimitFilter.class);

    /** {@code *} casa com exatamente um segmento do caminho. {@code hashes}: a rota calcula Argon2 (entra no bulkhead). */
    record Rule(String method, String path, int limit, Duration window, boolean hashes) {
        boolean matches(String m, String p) {
            if (!method.equalsIgnoreCase(m)) {
                return false;
            }
            String[] want = path.split("/");
            String[] got = p.split("/");
            if (want.length != got.length) {
                return false;
            }
            for (int i = 0; i < want.length; i++) {
                if (!want[i].equals("*") && !want[i].equals(got[i])) {
                    return false;
                }
            }
            return true;
        }

        String bucket() {
            return "ip:" + method.toLowerCase() + path.replace('/', ':').replace("*", "_");
        }
    }

    static final List<Rule> RULES = List.of(
            new Rule("POST", "/api/auth/login", 30, Duration.ofMinutes(10), true),
            new Rule("POST", "/api/auth/register", 10, Duration.ofHours(1), true),
            new Rule("POST", "/api/auth/uploads", 40, Duration.ofHours(1), false),
            new Rule("POST", "/api/auth/refresh", 120, Duration.ofMinutes(10), false),
            new Rule("POST", "/api/auth/password-reset/request", 10, Duration.ofHours(1), false),
            new Rule("POST", "/api/auth/password-reset/confirm", 20, Duration.ofHours(1), true),
            // logado, mas confere a senha atual (o bloqueio por conta é o freio principal; aqui entra o bulkhead)
            new Rule("PUT", "/api/auth/password", 20, Duration.ofHours(1), true),
            new Rule("PATCH", "/api/me/sensitive", 30, Duration.ofHours(1), true),
            new Rule("POST", "/api/me/deletion", 10, Duration.ofHours(1), true),
            // enumeração de usernames em massa
            new Rule("GET", "/api/usernames/*/availability", 120, Duration.ofMinutes(10), false),
            new Rule("GET", "/api/auth/username-suggestions", 60, Duration.ofMinutes(10), false));

    private final RateLimitPort rateLimit;
    private final ClientIpResolver clientIp;
    private final boolean enabled;
    private final List<String> origins;
    private final Semaphore hashing;
    private final long hashWaitMillis;

    @Autowired
    public AuthRateLimitFilter(RateLimitPort rateLimit, ClientIpResolver clientIp,
                               @Value("${fashionai.security.auth-rate-limit.enabled:true}") boolean enabled,
                               @Value("${fashionai.cors.allowed-origins:http://localhost:3000}") String origins,
                               @Value("${fashionai.security.auth-hash-concurrency:0}") int hashConcurrency,
                               @Value("${fashionai.security.auth-hash-wait-ms:2000}") long hashWaitMillis,
                               @Value("${spring.datasource.hikari.maximum-pool-size:10}") int dbPoolSize) {
        this.rateLimit = rateLimit;
        this.clientIp = clientIp;
        this.enabled = enabled;
        this.origins = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        int permits = hashConcurrency > 0 ? hashConcurrency : defaultHashPermits(Runtime.getRuntime().availableProcessors(), dbPoolSize);
        this.hashing = new Semaphore(permits, true);
        this.hashWaitMillis = Math.max(0, hashWaitMillis);
        log.info("Autenticação: até {} hashes de senha simultâneos (pool do banco: {})", permits, dbPoolSize);
    }

    AuthRateLimitFilter(RateLimitPort rateLimit, ClientIpResolver clientIp, boolean enabled, String origins) {
        this(rateLimit, clientIp, enabled, origins, 0, 2000, 10);
    }

    /** Um por núcleo (o Argon2 é CPU), no mínimo 2, e no máximo metade do pool do banco: sempre sobra conexão. */
    static int defaultHashPermits(int cores, int dbPoolSize) {
        return Math.max(1, Math.min(Math.max(2, cores), dbPoolSize / 2));
    }

    static Optional<Rule> ruleFor(String method, String path) {
        return RULES.stream().filter(r -> r.matches(method, path)).findFirst();
    }

    /** Dono do balde: o IP; IPv6 pelo prefixo /64 (o endereço já é literal, validado no ClientIpResolver: sem DNS). */
    static String bucketKey(String ip) {
        if (ip == null || ip.indexOf(':') < 0) {
            return ip;
        }
        int zone = ip.indexOf('%');
        String literal = zone >= 0 ? ip.substring(0, zone) : ip;
        try {
            byte[] b = InetAddress.getByName(literal).getAddress();
            if (b.length == 4) {
                return InetAddress.getByAddress(b).getHostAddress();      // ::ffff:a.b.c.d conta como o IPv4
            }
            return HexFormat.of().formatHex(b, 0, 8) + "::/64";
        } catch (UnknownHostException e) {
            return ip;
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !enabled || ruleFor(req.getMethod(), RequestPaths.normalized(req)).isEmpty();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        Rule rule = ruleFor(req.getMethod(), RequestPaths.normalized(req)).orElseThrow();
        UUID owner = UUID.nameUUIDFromBytes(("ip:" + bucketKey(clientIp.resolve(req))).getBytes(StandardCharsets.UTF_8));
        if (!rateLimit.tryAcquire(owner, rule.bucket(), rule.limit(), rule.window())) {
            reject(req, res, 429, rule.window().toSeconds(), "MUITAS_TENTATIVAS", "security.muitas_tentativas_ip");
            return;
        }
        if (!rule.hashes()) {
            chain.doFilter(req, res);
            return;
        }
        boolean acquired;
        try {
            acquired = hashing.tryAcquire(hashWaitMillis, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            acquired = false;
        }
        if (!acquired) {
            reject(req, res, 503, 2, "AUTENTICACAO_OCUPADA", "security.autenticacao_ocupada");
            return;
        }
        try {
            chain.doFilter(req, res);
        } finally {
            hashing.release();
        }
    }

    private void reject(HttpServletRequest req, HttpServletResponse res, int status, long retryAfterSeconds, String code,
                        String messageKey) throws IOException {
        String origin = req.getHeader("Origin");
        if (origin != null && origins.contains(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader("Access-Control-Expose-Headers", "Retry-After");
            res.addHeader("Vary", "Origin");
        }
        res.setStatus(status);
        res.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        res.setContentType("application/json;charset=UTF-8");
        String msg = Msg.t(messageKey).replace("\\", "\\\\").replace("\"", "\\\"");
        res.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + msg + "\"}");
    }
}
