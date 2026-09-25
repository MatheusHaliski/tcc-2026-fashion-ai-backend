package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaProxyControllerTest {
    private final Map<String, byte[]> objects = new HashMap<>();
    private final List<String> reads = new ArrayList<>();
    private final MediaStoragePort storage = new MediaStoragePort() {
        public URI createUploadUrl(String key, String type) { throw new UnsupportedOperationException(); }
        public URI publicUrl(String key) { return URI.create("https://api.test/media/" + key); }
        public StoredObject put(String key, byte[] content, String type) { throw new UnsupportedOperationException(); }
        public byte[] get(String key) {
            reads.add(key);
            byte[] b = objects.get(key);
            if (b == null) throw ApiException.notFound("Arquivo");
            return b;
        }
        public void delete(String key) { }
        public Optional<String> keyOf(String url) { return Optional.empty(); }
    };
    private final MediaProxyController controller = new MediaProxyController(storage);

    private static MockHttpServletRequest get(String uri) {
        return new MockHttpServletRequest("GET", uri);
    }

    @Test
    void entregaOArquivoDoBucketComTipoECachePublico() {
        byte[] png = {(byte) 0x89, 'P', 'N', 'G'};
        objects.put("users/u1/foto de perfil.png", png);
        ResponseEntity<byte[]> res = controller.media(get("/media/users/u1/foto%20de%20perfil.png"));
        assertThat(res.getBody()).isEqualTo(png);
        assertThat(res.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(res.getHeaders().getCacheControl()).contains("max-age=86400").contains("public");
    }

    @Test
    void documentosRestritosNaoFicamEmCache() {
        objects.put("restricted/u1/doc.pdf", new byte[]{1});
        ResponseEntity<byte[]> res = controller.media(get("/media/restricted/u1/doc.pdf"));
        assertThat(res.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void recusaChavesQueSaemDoBucket() {
        for (String uri : new String[]{"/media/", "/media/users/../restricted/x.pdf", "/media/%2E%2E/x", "/media//etc/passwd", "/media/a%5Cb"}) {
            assertThatThrownBy(() -> controller.media(get(uri))).as(uri).isInstanceOf(ApiException.class);
        }
        assertThat(reads).isEmpty();
    }
}
