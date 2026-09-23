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

import java.util.Map;
import java.util.Optional;

/** Meshy image-to-3D (RF16, fora do escopo mínimo): submete a peça e devolve o id da tarefa para acompanhamento. */
@Component
public class MeshyModel3dAdapter implements Model3dPort {
    private static final Logger log = LoggerFactory.getLogger(MeshyModel3dAdapter.class);
    private static final String ID = "meshy";
    private final RestClient client;
    private final String apiKey;

    public MeshyModel3dAdapter(@Value("${fashionai.ai.meshy-api-key:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = Http.client("https://api.meshy.ai", 30);
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(apiKey) && ProviderCircuit.closed(ID);
    }

    @Override
    public Optional<String> submit(byte[] image) {
        try {
            Map<String, Object> res = ProviderCircuit.run(ID, () -> client.post().uri("/openapi/v1/image-to-3d")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("image_url", ImageHttp.dataUri(image, "image/png"), "enable_pbr", true, "should_texture", true))
                    .retrieve().body(Map.class));
            Object id = res == null ? null : res.get("result");
            return id == null ? Optional.empty() : Optional.of(String.valueOf(id));
        } catch (Exception e) {
            log.warn("Meshy indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
