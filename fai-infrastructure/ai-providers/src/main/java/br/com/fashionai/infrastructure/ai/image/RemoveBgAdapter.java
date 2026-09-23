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

/** remove.bg (pago, ~US$0,20/imagem) — remoção de fundo do pipeline RF4. */
@Component
public class RemoveBgAdapter implements BackgroundRemovalPort {
    private static final Logger log = LoggerFactory.getLogger(RemoveBgAdapter.class);
    private static final String ID = "removebg";
    private final RestClient client;
    private final String apiKey;

    public RemoveBgAdapter(@Value("${fashionai.ai.remove-bg-api-key:}") String apiKey,
                           @Value("${fashionai.ai.timeout-seconds:30}") int timeoutSeconds) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = Http.client("https://api.remove.bg", timeoutSeconds);
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(apiKey) && ProviderCircuit.closed(ID);
    }

    @Override
    public Optional<ProviderImage> removeBackground(byte[] image, String mimeType) {
        long started = System.nanoTime();
        try {
            byte[] png = ProviderCircuit.run(ID, () -> client.post().uri("/v1.0/removebg")
                    .header("X-Api-Key", apiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(ImageHttp.multipart("image_file", image, mimeType, Map.of("size", "auto", "format", "png")))
                    .retrieve().body(byte[].class));
            return png == null ? Optional.empty()
                    : Optional.of(ImageHttp.result(png, "image/png", ID, "0.20", started, Map.of("size", "auto")));
        } catch (Exception e) {
            log.warn("remove.bg indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
