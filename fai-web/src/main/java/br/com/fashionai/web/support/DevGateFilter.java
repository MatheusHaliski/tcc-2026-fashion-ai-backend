package br.com.fashionai.web.support;

import br.com.fashionai.application.common.Msg;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
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
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Gate de desenvolvedor na API: enquanto o app não é público, toda requisição precisa passar pelo gate. Dois modos
 * ({@code fashionai.dev-gate.mode}):
 * <ul>
 *   <li>{@code builtin} (padrão): cabeçalho {@code X-Dev-Gate} com o token curto de API emitido pelo /gate do frontend —
 *   {@code ga.<json base64url>.<expira>.<HMAC-SHA256 base64url>}, JSON {@code {"i": identidade, "j": entrada}}, mesmo
 *   segredo DEV_GATE_SECRET (mínimo de 32 caracteres; mais curto, a aplicação não sobe). Com DEV_GATE_ALLOWED_EMAILS
 *   também aqui, a identidade é conferida contra a lista a cada requisição (revogação por pessoa na hora); sem a lista,
 *   vale a do frontend e o token vence em até 1 h.</li>
 *   <li>{@code cloudflare}: o Cloudflare Access faz o login e manda {@code Cf-Access-Jwt-Assertion}; conferimos o JWT
 *   (RS256 pelas chaves da equipe, emissor e audiência CF_ACCESS_AUD). Acesso direto pela URL do Railway, fora do
 *   Cloudflare, fica sem o JWT e é recusado.</li>
 * </ul>
 * Ficam de fora o preflight CORS, a saúde do serviço e /media (imagens carregadas por &lt;img&gt;, que não enviam
 * cabeçalhos; caminhos com UUID, e o que é sensível fica em restricted/ ou atrás de rotas autenticadas). Ligado com
 * DEV_GATE_ENABLED=true. Não substitui a autenticação: o JWT do usuário continua valendo depois do gate.
 */
@Component
@Order(-103)   // depois do idioma (-104), antes do Spring Security (-100)
public class DevGateFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(DevGateFilter.class);
    static final String HEADER = "X-Dev-Gate";
    static final String CLOUDFLARE_HEADER = "Cf-Access-Jwt-Assertion";
    static final int MIN_SECRET_LENGTH = 32;
    private static final List<String> OPEN = List.of("/actuator/health", "/actuator/info", "/media/");
    private static final ObjectMapper JSON = new ObjectMapper();

    private final boolean enabled;
    private final boolean cloudflareMode;
    private final String secret;
    private final Set<String> allowed;
    private final List<String> origins;
    private final JwtDecoder cloudflare;

    public DevGateFilter(@Value("${fashionai.dev-gate.enabled:false}") boolean enabled,
                         @Value("${fashionai.dev-gate.mode:builtin}") String mode,
                         @Value("${fashionai.dev-gate.secret:}") String secret,
                         @Value("${fashionai.dev-gate.user:matheushaliskitcc20233}") String user,
                         @Value("${fashionai.dev-gate.allowed-emails:}") String allowedEmails,
                         @Value("${fashionai.dev-gate.cloudflare.team-domain:}") String teamDomain,
                         @Value("${fashionai.dev-gate.cloudflare.aud:}") String aud,
                         @Value("${fashionai.cors.allowed-origins:http://localhost:3000}") String origins) {
        this.enabled = enabled;
        this.cloudflareMode = "cloudflare".equalsIgnoreCase(mode == null ? "" : mode.trim());
        this.secret = secret == null ? "" : secret.trim();
        this.origins = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        Set<String> emails = csv(allowedEmails);
        this.allowed = emails.isEmpty() ? Set.of()
                : Stream.concat(emails.stream(), Stream.of(user == null ? "" : user.trim().toLowerCase(Locale.ROOT)))
                .filter(s -> !s.isEmpty()).collect(Collectors.toUnmodifiableSet());
        if (enabled && !cloudflareMode && this.secret.length() < MIN_SECRET_LENGTH) {
            // configuração insegura não entra no ar: o health check falha e a versão anterior continua servindo
            throw new IllegalStateException("DEV_GATE_SECRET precisa ter pelo menos " + MIN_SECRET_LENGTH + " caracteres com DEV_GATE_ENABLED=true");
        }
        if (enabled && cloudflareMode) {
            String team = teamDomain == null ? "" : teamDomain.trim().replaceFirst("^https?://", "").replaceAll("/+$", "");
            if (team.isEmpty() || aud == null || aud.isBlank()) {
                throw new IllegalStateException("DEV_GATE_MODE=cloudflare exige CF_ACCESS_TEAM_DOMAIN e CF_ACCESS_AUD");
            }
            this.cloudflare = cloudflareDecoder(team, aud.trim());
        } else {
            this.cloudflare = null;
        }
        if (enabled && !cloudflareMode && emails.isEmpty()) {
            log.warn("Gate: DEV_GATE_ALLOWED_EMAILS não está definida na API; a revogação por pessoa aqui depende da validade de 1 h do token.");
        }
    }

    static JwtDecoder cloudflareDecoder(String teamDomain, String aud) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri("https://" + teamDomain + "/cdn-cgi/access/certs")
                .jwsAlgorithm(SignatureAlgorithm.RS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer("https://" + teamDomain),
                new JwtClaimValidator<List<String>>("aud", a -> a != null && a.contains(aud))));
        return decoder;
    }

    private static Set<String> csv(String value) {
        if (value == null) {
            return Set.of();
        }
        return Arrays.stream(value.split(",")).map(s -> s.trim().toLowerCase(Locale.ROOT)).filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
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
        boolean ok = cloudflareMode
                ? validCloudflare(req.getHeader(CLOUDFLARE_HEADER))
                : valid(req.getHeader(HEADER), secret, allowed, Instant.now().getEpochSecond());
        if (ok) {
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

    private boolean validCloudflare(String jwt) {
        if (jwt == null || jwt.isBlank() || cloudflare == null) {
            return false;
        }
        try {
            Jwt token = cloudflare.decode(jwt.trim());
            String who = token.getClaimAsString("email");
            String id = (who == null ? token.getSubject() : who);
            return id != null && (allowed.isEmpty() || allowed.contains(id.toLowerCase(Locale.ROOT)));
        } catch (RuntimeException e) {
            return false;
        }
    }

    /**
     * Confere tipo ("ga"), assinatura (tempo constante), validade e — com lista configurada — se a identidade ainda
     * está autorizada. {@code allowed} vazio = qualquer identidade assinada.
     */
    static boolean valid(String token, String secret, Set<String> allowed, long nowEpoch) {
        if (token == null || secret == null || secret.length() < MIN_SECRET_LENGTH) {
            return false;
        }
        String[] p = token.trim().split("\\.");
        if (p.length != 4 || !"ga".equals(p[0])) {
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
            byte[] expected = mac.doFinal((p[0] + "." + p[1] + "." + p[2]).getBytes(StandardCharsets.UTF_8));
            if (!MessageDigest.isEqual(expected, Base64.getUrlDecoder().decode(p[3]))) {
                return false;
            }
            JsonNode data = JSON.readTree(Base64.getUrlDecoder().decode(p[1]));
            String id = data.path("i").asText("").trim().toLowerCase(Locale.ROOT);
            return !id.isEmpty() && (allowed.isEmpty() || allowed.contains(id));
        } catch (Exception e) {
            return false;
        }
    }
}
