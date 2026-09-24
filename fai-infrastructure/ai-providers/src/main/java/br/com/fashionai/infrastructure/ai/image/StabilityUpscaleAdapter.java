package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.application.imaging.ImageProviderPorts.UpscalePort;
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

/** Stability AI · Upscale Fast (RF4 · estúdio): amplia 4× preservando detalhes de tecido, costura e zíper. */
@Component
public class StabilityUpscaleAdapter implements UpscalePort {
    private static final Logger log = LoggerFactory.getLogger(StabilityUpscaleAdapter.class);
    private static final String ID = "stability-upscale";
    private final RestClient client;
    private final String apiKey;

    public StabilityUpscaleAdapter(@Value("${fashionai.ai.stability-api-key:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = Http.client("https://api.stability.ai", 60);
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(apiKey) && ProviderCircuit.closed(ID);
    }

    @Override
    public Optional<ProviderImage> upscale(byte[] png) {
        long started = System.nanoTime();
        try {
            byte[] out = ProviderCircuit.run(ID, () -> client.post().uri("/v2beta/stable-image/upscale/fast")
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "image/*")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(ImageHttp.multipart("image", png, "image/png", Map.of("output_format", "png")))
                    .retrieve().body(byte[].class));
            return out == null || out.length == 0 ? Optional.empty()
                    : Optional.of(ImageHttp.result(out, "image/png", ID, "0.0200", started, Map.of("scale", 4)));
        } catch (Exception e) {
            log.warn("Stability Upscale indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
