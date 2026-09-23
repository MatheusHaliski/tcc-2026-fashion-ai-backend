package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.BackgroundRemovalPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Optional;

/** rembg auto-hospedado (gratuito; imagem docker danielgatis/rembg com a API HTTP) — primeira opção de remoção de fundo. */
@Component
public class RembgAdapter implements BackgroundRemovalPort {
    private static final Logger log = LoggerFactory.getLogger(RembgAdapter.class);
    private static final String ID = "rembg";
    private final RestClient client;
    private final boolean configured;

    public RembgAdapter(@Value("${fashionai.ai.rembg-url:}") String url,
                        @Value("${fashionai.ai.timeout-seconds:30}") int timeoutSeconds) {
        this.configured = url != null && url.startsWith("http");
        this.client = Http.client(configured ? url : "http://localhost:7000", timeoutSeconds);
    }

    @Override
    public boolean available() {
        return configured && ProviderCircuit.closed(ID);
    }

    @Override
    public Optional<ProviderImage> removeBackground(byte[] image, String mimeType) {
        long started = System.nanoTime();
        try {
            byte[] png = ProviderCircuit.run(ID, () -> client.post().uri("/api/remove")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(ImageHttp.multipart("file", image, mimeType, Map.of()))
                    .retrieve().body(byte[].class));
            return png == null ? Optional.empty() : Optional.of(ImageHttp.result(png, "image/png", ID, "0.00", started, Map.of("model", "u2net")));
        } catch (Exception e) {
            log.warn("rembg indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
