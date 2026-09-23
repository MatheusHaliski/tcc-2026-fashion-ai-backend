package br.com.fashionai.infrastructure.platform;

import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/** Cliente HTTP com timeouts explícitos (RNF8): nenhuma integração externa fica pendurada sem limite. */
public final class Http {
    private Http() {
    }

    public static RestClient client(String baseUrl, int timeoutSeconds) {
        HttpClient jdk = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(jdk);
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
}
