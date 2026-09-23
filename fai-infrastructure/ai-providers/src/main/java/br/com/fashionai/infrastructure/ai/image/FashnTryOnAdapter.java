package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.application.imaging.ImageProviderPorts.TryOnProviderPort;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** FASHN.ai try-on (RF18): submete manequim + peça, aguarda a predição e baixa a imagem final. */
@Component
public class FashnTryOnAdapter implements TryOnProviderPort {
    private static final Logger log = LoggerFactory.getLogger(FashnTryOnAdapter.class);
    private static final String ID = "fashn";
    private final RestClient client;
    private final String apiKey;
    private final String model;

    public FashnTryOnAdapter(@Value("${fashionai.ai.fashn-api-key:}") String apiKey,
                             @Value("${fashionai.ai.fashn-model:tryon-v1.6}") String model) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.client = Http.client("https://api.fashn.ai", 30);
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(apiKey) && ProviderCircuit.closed(ID);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<ProviderImage> tryOn(byte[] modelImage, byte[] garmentImage, String category) {
        long started = System.nanoTime();
        try {
            Map<String, Object> submitted = ProviderCircuit.run(ID, () -> client.post().uri("/v1/run")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model_name", model, "inputs", Map.of(
                            "model_image", ImageHttp.dataUri(modelImage, "image/png"),
                            "garment_image", ImageHttp.dataUri(garmentImage, "image/png"),
                            "category", category == null ? "auto" : category)))
                    .retrieve().body(Map.class));
            String id = submitted == null ? null : String.valueOf(submitted.get("id"));
            if (id == null || "null".equals(id)) {
                return Optional.empty();
            }
            for (int i = 0; i < 30; i++) {
                Thread.sleep(2000);
                Map<String, Object> status = client.get().uri("/v1/status/{id}", id)
                        .header("Authorization", "Bearer " + apiKey).retrieve().body(Map.class);
                String state = status == null ? "" : String.valueOf(status.get("status"));
                if ("completed".equals(state)) {
                    List<String> output = (List<String>) status.get("output");
                    if (output == null || output.isEmpty()) {
                        return Optional.empty();
                    }
                    byte[] bytes = ImageHttp.download(output.get(0), 30);
                    return Optional.of(ImageHttp.result(bytes, "image/png", ID, "0.075", started, Map.of("model", model, "predictionId", id)));
                }
                if ("failed".equals(state) || "canceled".equals(state)) {
                    log.warn("FASHN falhou: {}", status.get("error"));
                    return Optional.empty();
                }
            }
            log.warn("FASHN: tempo esgotado aguardando a predição {}", id);
            return Optional.empty();
        } catch (Exception e) {
            log.warn("FASHN indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
