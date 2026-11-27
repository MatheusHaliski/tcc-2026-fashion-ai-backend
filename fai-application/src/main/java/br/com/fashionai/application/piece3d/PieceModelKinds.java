package br.com.fashionai.application.piece3d;

import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Descobre a origem do modelo 3D de uma peça lendo o GLB guardado (armazenamento próprio ou URL https pública).
 * A URL do modelo muda a cada geração, então o veredito fica em cache por URL; falha de leitura não é guardada.
 */
@Component
public class PieceModelKinds {
    private static final int MAX_GLB_BYTES = 32 * 1024 * 1024;
    private static final int CACHE_SIZE = 512;

    private final MediaStoragePort media;
    private final WebFetchPort web;
    private final Map<String, PieceModelKind> cache = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, PieceModelKind> eldest) {
            return size() > CACHE_SIZE;
        }
    });

    public PieceModelKinds(MediaStoragePort media, WebFetchPort web) {
        this.media = media;
        this.web = web;
    }

    public PieceModelKind of(String modelUrl) {
        if (modelUrl == null || modelUrl.isBlank()) {
            return PieceModelKind.DESCONHECIDO;
        }
        PieceModelKind known = cache.get(modelUrl);
        if (known != null) {
            return known;
        }
        PieceModelKind kind = PieceModelKind.of(read(modelUrl));
        if (kind != PieceModelKind.DESCONHECIDO) {
            cache.put(modelUrl, kind);
        }
        return kind;
    }

    private byte[] read(String url) {
        try {
            var key = media.keyOf(url);
            if (key.isPresent()) {
                return media.get(key.get());
            }
            if (url.startsWith("https://")) {
                return web.get(url, MAX_GLB_BYTES, null).map(WebFetchPort.Fetched::body).orElse(null);
            }
        } catch (RuntimeException e) {
            return null;
        }
        return null;
    }
}
