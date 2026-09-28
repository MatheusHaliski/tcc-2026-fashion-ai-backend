package br.com.fashionai.infrastructure.opensearch;

import br.com.fashionai.application.ports.SearchIndexPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import javax.net.ssl.SSLContext;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Índice de busca no OpenSearch pela API REST (ligado com {@code fashionai.opensearch.enabled=true}).
 * Documentos de peças e esquemas são indexados na publicação; a busca combina texto livre com filtros exatos.
 * <p>
 * Conexão: HTTP simples (desenvolvimento, plugin de segurança desligado) ou HTTPS com o plugin de segurança
 * (infra/railway/opensearch): usuário/senha em Basic (OPENSEARCH_USERNAME/OPENSEARCH_PASSWORD) e confiança só na CA
 * do cluster (OPENSEARCH_CA_CERT_PEM), com verificação do nome do host (OPENSEARCH_TLS_VERIFY_HOSTNAME=true).
 * OPENSEARCH_TLS_INSECURE=true aceita certificado autoassinado sem CA — só na rede privada, e loga WARN.
 */
@Component
@ConditionalOnProperty(name = "fashionai.opensearch.enabled", havingValue = "true")
public class OpenSearchIndexAdapter implements SearchIndexPort {
    private static final Logger log = LoggerFactory.getLogger(OpenSearchIndexAdapter.class);
    private final RestClient client;
    private final String auth;
    private final String prefix;

    public OpenSearchIndexAdapter(@Value("${fashionai.opensearch.url:http://localhost:9200}") String url,
                                  @Value("${fashionai.opensearch.username:}") String username,
                                  @Value("${fashionai.opensearch.password:}") String password,
                                  @Value("${fashionai.opensearch.index-prefix:fai-}") String prefix,
                                  @Value("${fashionai.opensearch.ca-cert-pem:}") String caCertPem,
                                  @Value("${fashionai.opensearch.tls-insecure:false}") boolean tlsInsecure,
                                  @Value("${fashionai.opensearch.tls-verify-hostname:true}") boolean verifyHostname) {
        boolean https = url != null && url.trim().toLowerCase(Locale.ROOT).startsWith("https://");
        boolean hasCa = caCertPem != null && !caCertPem.isBlank();
        this.client = client(url, sslContext(https, hasCa ? caCertPem : null, tlsInsecure, verifyHostname));
        this.auth = username == null || username.isBlank() ? null
                : "Basic " + Base64.getEncoder().encodeToString((username + ":" + (password == null ? "" : password)).getBytes(StandardCharsets.UTF_8));
        this.prefix = prefix;
        if (auth != null && !https) {
            log.warn("OpenSearch: usuário configurado com URL http:// — a senha trafega sem TLS; use https:// ({})", host(url));
        }
    }

    /** Contexto TLS conforme a configuração; {@code null} = padrão da JVM (ou HTTP simples). */
    static SSLContext sslContext(boolean https, String caCertPem, boolean tlsInsecure, boolean verifyHostname) {
        if (!https) {
            return null;
        }
        if (caCertPem != null) {
            if (tlsInsecure) {
                log.info("OpenSearch: OPENSEARCH_CA_CERT_PEM definida; OPENSEARCH_TLS_INSECURE ignorada");
            }
            if (!verifyHostname) {
                log.warn("OpenSearch: verificação do nome do host desligada (OPENSEARCH_TLS_VERIFY_HOSTNAME=false); só a CA é conferida");
            }
            return OpenSearchTls.trusting(caCertPem, verifyHostname);
        }
        if (tlsInsecure) {
            log.warn("OpenSearch: OPENSEARCH_TLS_INSECURE=true — certificado do servidor NÃO é verificado. Use só na rede privada "
                    + "e troque por OPENSEARCH_CA_CERT_PEM assim que possível.");
            return OpenSearchTls.trustingAnything();
        }
        return null;
    }

    private static RestClient client(String url, SSLContext ssl) {
        HttpClient.Builder b = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5));
        if (ssl != null) {
            b.sslContext(ssl);
        }
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(b.build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        return RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    private static String host(String url) {
        try {
            return URI.create(url.trim()).getHost();
        } catch (RuntimeException e) {
            return "?";
        }
    }

    private RestClient.RequestBodySpec req(RestClient.RequestBodySpec spec) {
        return auth == null ? spec : spec.header("Authorization", auth);
    }

    @Override
    public void index(String indexName, UUID id, Map<String, Object> document) {
        try {
            req(client.put().uri("/{index}/_doc/{id}", prefix + indexName, id)).contentType(MediaType.APPLICATION_JSON)
                    .body(document).retrieve().toBodilessEntity();
        } catch (RuntimeException e) {
            log.warn("OpenSearch: falha ao indexar {}/{}: {}", indexName, id, e.getMessage());
        }
    }

    @Override
    public void remove(String indexName, UUID id) {
        try {
            RestClient.RequestHeadersSpec<?> spec = client.delete().uri("/{index}/_doc/{id}", prefix + indexName, id);
            (auth == null ? spec : spec.header("Authorization", auth)).retrieve().toBodilessEntity();
        } catch (RuntimeException e) {
            log.debug("OpenSearch: remoção de {}/{} ignorada: {}", indexName, id, e.getMessage());
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<UUID> search(String indexName, String term, Map<String, String> filters, int limit) {
        List<Map<String, Object>> must = new ArrayList<>();
        if (term != null && !term.isBlank()) {
            must.add(Map.of("multi_match", Map.of("query", term, "fields", List.of("title^3", "name^3", "description", "tags", "brand", "color", "occasion", "style"),
                    "fuzziness", "AUTO")));
        }
        if (filters != null) {
            filters.forEach((k, v) -> {
                if (v != null && !v.isBlank()) {
                    must.add(Map.of("term", Map.of(k + ".keyword", v)));
                }
            });
        }
        Map<String, Object> body = Map.of("size", Math.max(1, Math.min(limit, 200)), "_source", false,
                "query", Map.of("bool", Map.of("must", must)));
        try {
            Map<String, Object> res = req(client.post().uri("/{index}/_search", prefix + indexName)).contentType(MediaType.APPLICATION_JSON)
                    .body(body).retrieve().body(Map.class);
            Map<String, Object> hits = res == null ? null : (Map<String, Object>) res.get("hits");
            List<Map<String, Object>> rows = hits == null ? List.of() : (List<Map<String, Object>>) hits.get("hits");
            List<UUID> ids = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                ids.add(UUID.fromString(String.valueOf(row.get("_id"))));
            }
            return ids;
        } catch (RuntimeException e) {
            log.warn("OpenSearch: busca em {} falhou ({}); usando MySQL", indexName, e.getMessage());
            return List.of();
        }
    }

    @Override
    public boolean enabled() {
        return true;
    }
}
