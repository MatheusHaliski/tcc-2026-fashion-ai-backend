package br.com.fashionai.web.support;

import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletRequestWrapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.function.LongSupplier;
import java.util.regex.Pattern;

/**
 * IP real de quem fez a requisição — a única fonte para limite por IP, auditoria e sessões (OWASP API4/A09).
 * O {@code X-Forwarded-For} nunca é usado: o valor mais à esquerda é escrito pelo próprio cliente (e é ele que o
 * {@code server.forward-headers-strategy: framework} devolve em {@code getRemoteAddr()}). Ordem de confiança:
 * <ol>
 *   <li>cabeçalho assinado pelo nosso BFF Next.js: {@code X-Fai-Client-Ip}, {@code X-Fai-Proxy-Ts} (epoch em segundos) e
 *       {@code X-Fai-Proxy-Sig} = base64url sem preenchimento de HMAC-SHA256(EDGE_PROXY_SECRET, ip + "|" + ts); vale só
 *       com o segredo configurado, assinatura correta (tempo constante) e relógio a no máximo 60 s;</li>
 *   <li>cabeçalho de valor único escrito pela borda da hospedagem ({@code CLIENT_IP_HEADER}, padrão {@code X-Real-IP}:
 *       o proxy da Railway o sobrescreve com o IP real); vazio desliga;</li>
 *   <li>o endereço da conexão TCP (o pedido original do contêiner, sem o invólucro de cabeçalhos encaminhados).</li>
 * </ol>
 * Qualquer valor precisa ser um IP literal (nunca há consulta DNS); senão cai para a próxima fonte.
 */
@Component
public class ClientIpResolver {
    public static final String SIGNED_IP = "X-Fai-Client-Ip";
    public static final String SIGNED_TS = "X-Fai-Proxy-Ts";
    public static final String SIGNED_SIG = "X-Fai-Proxy-Sig";
    /** Atributo da requisição com o IP já resolvido (a assinatura é conferida uma vez por requisição). */
    static final String ATTRIBUTE = ClientIpResolver.class.getName() + ".ip";
    static final long MAX_SKEW_SECONDS = 60;
    /** O mesmo mínimo do BFF (app/bff/auth/[action]/route.ts). */
    static final int MIN_SECRET_LENGTH = 32;
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(ClientIpResolver.class);
    private static final Pattern IPV4 = Pattern.compile("^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$");
    private static final Pattern IPV6_CHARS = Pattern.compile("^[0-9A-Fa-f:.]{2,45}$");

    private final byte[] edgeSecret;
    private final String header;
    private final LongSupplier nowEpochSeconds;

    @Autowired
    public ClientIpResolver(@Value("${fashionai.security.edge-proxy-secret:}") String edgeSecret,
                            @Value("${fashionai.security.client-ip-header:X-Real-IP}") String header) {
        this(edgeSecret, header, () -> System.currentTimeMillis() / 1000);
    }

    ClientIpResolver(String edgeSecret, String header, LongSupplier nowEpochSeconds) {
        String secret = edgeSecret == null ? "" : edgeSecret.trim();
        if (secret.isEmpty()) {
            LOG.warn("EDGE_PROXY_SECRET ausente: pedidos que passam pelo BFF (Vercel) contam no IP da Vercel — o limite por IP"
                    + " do login vira um balde só para todos os usuários do site. Defina o mesmo segredo na Vercel e aqui.");
        } else if (secret.length() < MIN_SECRET_LENGTH) {
            // o BFF só assina com 32+ caracteres: abaixo disso nada chega assinado e o IP do cliente nunca é conhecido
            LOG.warn("EDGE_PROXY_SECRET com {} caracteres: o BFF exige {}+ e não vai assinar; gere com openssl rand -hex 32",
                    secret.length(), MIN_SECRET_LENGTH);
        }
        this.edgeSecret = secret.isEmpty() ? null : secret.getBytes(StandardCharsets.UTF_8);
        this.header = header == null ? "" : header.trim();
        this.nowEpochSeconds = nowEpochSeconds;
    }

    /** IP do cliente (resolvido uma vez e guardado na requisição). */
    public String resolve(HttpServletRequest request) {
        Object cached = request.getAttribute(ATTRIBUTE);
        if (cached instanceof String ip) {
            return ip;
        }
        String ip = compute(request);
        request.setAttribute(ATTRIBUTE, ip);
        return ip;
    }

    /** IP já resolvido nesta requisição pelo {@link CorrelationIdFilter}, se houver. */
    static String cached(HttpServletRequest request) {
        Object cached = request.getAttribute(ATTRIBUTE);
        return cached instanceof String ip ? ip : null;
    }

    private String compute(HttpServletRequest request) {
        if (edgeSecret != null) {
            String signed = signedIp(request.getHeader(SIGNED_IP), request.getHeader(SIGNED_TS), request.getHeader(SIGNED_SIG));
            if (signed != null) {
                return signed;
            }
        }
        if (!header.isEmpty()) {
            String trusted = literalIp(request.getHeader(header));
            if (trusted != null) {
                return trusted;
            }
        }
        return socketAddress(request);
    }

    /** Endereço da conexão: desembrulha a requisição até a original do contêiner (antes do ForwardedHeaderFilter). */
    public static String socketAddress(ServletRequest request) {
        ServletRequest inner = request;
        while (inner instanceof ServletRequestWrapper wrapper) {
            inner = wrapper.getRequest();
        }
        String addr = inner.getRemoteAddr();
        String ip = literalIp(addr);
        return ip != null ? ip : addr;
    }

    String signedIp(String ip, String ts, String sig) {
        if (ip == null || ts == null || sig == null) {
            return null;
        }
        long when;
        try {
            when = Long.parseLong(ts.trim());
        } catch (NumberFormatException e) {
            return null;
        }
        if (Math.abs(nowEpochSeconds.getAsLong() - when) > MAX_SKEW_SECONDS) {
            return null;
        }
        String value = ip.trim();
        byte[] given;
        try {
            given = Base64.getUrlDecoder().decode(sig.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!MessageDigest.isEqual(sign(edgeSecret, value + "|" + ts.trim()), given)) {
            return null;
        }
        return literalIp(value);
    }

    static byte[] sign(byte[] secret, String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Assinatura no formato do BFF (base64url sem preenchimento) — usada nos testes e na documentação. */
    static String signature(String secret, String ip, long ts) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(sign(secret.getBytes(StandardCharsets.UTF_8), ip + "|" + ts));
    }

    /**
     * IP literal normalizado (IPv6 na forma canônica, IPv4 mapeado em IPv6 vira IPv4) ou null. Só chega ao
     * {@link InetAddress#getByName} texto já validado como IPv4 ou com ':' — que o Java trata como literal IPv6 e nunca
     * resolve por DNS.
     */
    static String literalIp(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim();
        if (v.startsWith("[") && v.endsWith("]")) {
            v = v.substring(1, v.length() - 1);
        }
        if (IPV4.matcher(v).matches()) {
            return v;
        }
        if (v.indexOf(':') < 0 || !IPV6_CHARS.matcher(v).matches()) {
            return null;
        }
        try {
            InetAddress addr = InetAddress.getByName(v);
            return addr instanceof Inet6Address six ? six.getHostAddress() : addr.getHostAddress();
        } catch (Exception e) {
            return null;
        }
    }
}
