package br.com.fashionai.infrastructure.platform.web;

import br.com.fashionai.application.ports.WebFetchPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

/**
 * GET na internet pública com proteção contra SSRF: só https, host resolvido não pode ser loopback, rede privada,
 * link-local ou multicast, no máximo 3 redirecionamentos (cada um reavaliado), 8 s de timeout e limite de bytes.
 * Usa o proxy do sistema (https.proxyHost) quando houver.
 */
@Component
public class JdkWebFetchAdapter implements WebFetchPort {
    private static final Logger log = LoggerFactory.getLogger(JdkWebFetchAdapter.class);
    private static final int MAX_REDIRECTS = 3;
    private final HttpClient client;
    private final boolean enabled;

    public JdkWebFetchAdapter(@Value("${fashionai.web-fetch.enabled:true}") boolean enabled) {
        this.enabled = enabled;
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @Override
    public Optional<Fetched> get(String url, int maxBytes, String acceptPrefix) {
        if (!enabled || url == null) {
            return Optional.empty();
        }
        String current = url.trim();
        try {
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                URI uri = URI.create(current);
                if (!safe(uri)) {
                    log.debug("web-fetch recusado (host não público ou esquema inválido): {}", current);
                    return Optional.empty();
                }
                HttpRequest req = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8))
                        .header("User-Agent", "FashionAI-BrandLogo/1.0 (+https://fashion-ai.app)")
                        .header("Accept", acceptPrefix == null ? "*/*" : acceptPrefix + "*, */*;q=0.5").GET().build();
                HttpResponse<InputStream> res = client.send(req, HttpResponse.BodyHandlers.ofInputStream());
                int status = res.statusCode();
                if (status >= 300 && status < 400) {
                    res.body().close();
                    String loc = res.headers().firstValue("location").orElse(null);
                    if (loc == null) {
                        return Optional.empty();
                    }
                    current = uri.resolve(loc).toString();
                    continue;
                }
                if (status < 200 || status >= 300) {
                    res.body().close();
                    return Optional.empty();
                }
                String type = res.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
                if (acceptPrefix != null && !type.startsWith(acceptPrefix) && !(acceptPrefix.startsWith("image/") && type.isBlank())) {
                    res.body().close();
                    return Optional.empty();
                }
                try (InputStream in = res.body()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        if (out.size() + n > maxBytes) {
                            return Optional.empty();
                        }
                        out.write(buf, 0, n);
                    }
                    return Optional.of(new Fetched(current, type, out.toByteArray()));
                }
            }
        } catch (Exception e) {
            log.debug("web-fetch falhou para {}: {}", current, e.toString());
        }
        return Optional.empty();
    }

    /** https e host público (todas as resoluções DNS precisam ser públicas). */
    static boolean safe(URI uri) {
        return safe(uri, System.getProperty("https.proxyHost") != null);
    }

    /**
     * @param proxied há proxy de saída configurado (https.proxyHost): só então um nome que não resolve localmente pode
     *                seguir — quem resolve e conecta é o proxy. Sem proxy, DNS que falha é recusa (fail-closed): um nome
     *                que não resolve aqui pode resolver para a rede interna na hora da conexão.
     */
    static boolean safe(URI uri, boolean proxied) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
            return false;
        }
        int port = uri.getPort();
        if (port != -1 && port != 443) {
            return false;
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (host.equals("localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
            return false;
        }
        try {
            for (InetAddress a : InetAddress.getAllByName(host)) {
                if (a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress() || a.isAnyLocalAddress()
                        || a.isMulticastAddress() || isUniqueLocalV6(a) || isCgnat(a)) {
                    return false;
                }
            }
            return true;
        } catch (Exception e) {
            // sem DNS local: só atrás de proxy (ele resolve e conecta); nomes internos e IPs literais já foram barrados acima
            return proxied && host.contains(".") && !host.matches("[0-9.]+") && !host.contains(":");
        }
    }

    private static boolean isUniqueLocalV6(InetAddress a) {
        byte[] b = a.getAddress();
        return b.length == 16 && (b[0] & 0xFE) == 0xFC;
    }

    private static boolean isCgnat(InetAddress a) {
        byte[] b = a.getAddress();
        return b.length == 4 && (b[0] & 0xFF) == 100 && (b[1] & 0xC0) == 64;
    }
}
