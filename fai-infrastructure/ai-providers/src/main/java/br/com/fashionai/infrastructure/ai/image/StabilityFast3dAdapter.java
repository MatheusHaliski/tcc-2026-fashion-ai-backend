package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.Model3dPort;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

/**
 * Stability AI · Stable Fast 3D (RF16, alternativa síncrona): uma imagem de objeto vira um GLB texturizado em poucos
 * segundos. Usado quando o Meshy não está configurado ou falhou.
 */
@Component
public class StabilityFast3dAdapter implements Model3dPort {
    private static final Logger log = LoggerFactory.getLogger(StabilityFast3dAdapter.class);
    private static final String ID = "stability-sf3d";
    private final RestClient client;
    private final String apiKey;

    public StabilityFast3dAdapter(@Value("${fashionai.ai.stability-api-key:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = Http.client("https://api.stability.ai", 60);
    }

    @Override
    public String providerId() {
        return ID;
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(apiKey) && ProviderCircuit.closed(ID);
    }

    @Override
    public boolean async() {
        return false;
    }

    @Override
    public BigDecimal costUsd() {
        return new BigDecimal("0.1000");
    }

    @Override
    public Optional<String> submit(byte[] image) {
        return Optional.empty();
    }

    @Override
    public Optional<byte[]> generateNow(byte[] image) {
        try {
            byte[] glb = ProviderCircuit.run(ID, () -> client.post().uri("/v2beta/3d/stable-fast-3d")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(ImageHttp.multipart("image", image, "image/png", Map.of("texture_resolution", "1024", "foreground_ratio", "0.85",
                            "remesh", "triangle")))
                    .retrieve().body(byte[].class));
            return glb == null || glb.length < 20 ? Optional.empty() : Optional.of(glb);
        } catch (Exception e) {
            log.warn("Stability SF3D indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
