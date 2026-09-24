package br.com.fashionai.infrastructure.platform;

import br.com.fashionai.infrastructure.platform.web.JdkWebFetchAdapter;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

/** A URL do logo pode vir de uma resposta de IA: nada de http, portas estranhas ou endereços internos (SSRF). */
class WebFetchSafetyTest {
    private static boolean safe(String url) throws Exception {
        Method m = JdkWebFetchAdapter.class.getDeclaredMethod("safe", URI.class);
        m.setAccessible(true);
        return (boolean) m.invoke(null, URI.create(url));
    }

    @Test
    void onlyPublicHttpsIsAllowed() throws Exception {
        assertThat(safe("http://example.com/logo.png")).isFalse();
        assertThat(safe("https://127.0.0.1/logo.png")).isFalse();
        assertThat(safe("https://localhost/logo.png")).isFalse();
        assertThat(safe("https://10.0.0.8/logo.png")).isFalse();
        assertThat(safe("https://192.168.1.1/logo.png")).isFalse();
        assertThat(safe("https://169.254.169.254/latest/meta-data")).isFalse();
        assertThat(safe("https://[::1]/logo.png")).isFalse();
        assertThat(safe("https://user:pw@example.com/logo.png")).isFalse();
        assertThat(safe("https://example.com:8443/logo.png")).isFalse();
        assertThat(safe("https://metadata.google.internal/x")).isFalse();
        assertThat(safe("file:///etc/passwd")).isFalse();
    }
}
