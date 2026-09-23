package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.infrastructure.platform.Http;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Base64;
import java.util.Map;

/** Utilidades dos provedores de imagem: multipart, data URI, download e montagem do resultado. */
final class ImageHttp {
    private ImageHttp() {
    }

    static MultiValueMap<String, Object> multipart(String field, byte[] bytes, String mime, Map<String, String> fields) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        String ext = mime != null && mime.contains("png") ? "png" : "jpg";
        form.add(field, new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return "image." + ext;
            }
        });
        fields.forEach(form::add);
        return form;
    }

    static String dataUri(byte[] bytes, String mime) {
        return "data:" + (mime == null ? "image/jpeg" : mime) + ";base64," + Base64.getEncoder().encodeToString(bytes);
    }

    static byte[] download(String url, int timeoutSeconds) {
        RestClient c = Http.client(url, timeoutSeconds);
        byte[] bytes = c.get().retrieve().body(byte[].class);
        if (bytes == null || bytes.length == 0) {
            throw new IllegalStateException("download vazio: " + url);
        }
        return bytes;
    }

    static ProviderImage result(byte[] bytes, String mime, String provider, String cost, long startedNanos, Map<String, Object> meta) {
        return new ProviderImage(bytes, mime, provider, new BigDecimal(cost), (System.nanoTime() - startedNanos) / 1_000_000, 0.9, meta);
    }

    static boolean configured(String key) {
        return key != null && !key.isBlank() && !key.startsWith("placeholder");
    }
}
