package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ImageGenerationPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
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

/** Geração de arte de fundo (RF11) com FLUX schnell via Replicate (~US$0,003/imagem). */
@Component
public class ReplicateImageGenerationAdapter implements ImageGenerationPort {
    private static final Logger log = LoggerFactory.getLogger(ReplicateImageGenerationAdapter.class);
    private static final String ID = "replicate";
    private final RestClient client;
    private final String token;
    private final String model;

    public ReplicateImageGenerationAdapter(@Value("${fashionai.ai.replicate-api-token:}") String token,
                                           @Value("${fashionai.ai.replicate-image-model:black-forest-labs/flux-schnell}") String model) {
        this.token = token == null ? "" : token.trim();
        this.model = model;
        this.client = Http.client("https://api.replicate.com", 60);
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(token) && ProviderCircuit.closed(ID);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<ProviderImage> generate(String prompt, String negativePrompt, int width, int height) {
        long started = System.nanoTime();
        String aspect = width == height ? "1:1" : width > height ? "16:9" : "9:16";
        try {
            Map<String, Object> input = Map.of("prompt", prompt, "aspect_ratio", aspect, "output_format", "png", "num_outputs", 1);
            Map<String, Object> prediction = ProviderCircuit.run(ID, () -> client.post()
                    .uri("/v1/models/{model}/predictions", model)
                    .header("Authorization", "Bearer " + token)
                    .header("Prefer", "wait=60")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("input", input)).retrieve().body(Map.class));
            for (int i = 0; i < 30 && prediction != null && !"succeeded".equals(prediction.get("status")); i++) {
                String state = String.valueOf(prediction.get("status"));
                if ("failed".equals(state) || "canceled".equals(state)) {
                    log.warn("Replicate falhou: {}", prediction.get("error"));
                    return Optional.empty();
                }
                Thread.sleep(2000);
                Map<String, Object> urls = (Map<String, Object>) prediction.get("urls");
                String get = urls == null ? null : String.valueOf(urls.get("get"));
                if (get == null) {
                    return Optional.empty();
                }
                prediction = Http.client(get, 30).get().header("Authorization", "Bearer " + token).retrieve().body(Map.class);
            }
            if (prediction == null || !"succeeded".equals(prediction.get("status"))) {
                return Optional.empty();
            }
            Object output = prediction.get("output");
            String url = output instanceof List<?> l && !l.isEmpty() ? String.valueOf(l.get(0)) : String.valueOf(output);
            byte[] bytes = ImageHttp.download(url, 30);
            return Optional.of(ImageHttp.result(bytes, "image/png", ID, "0.003", started, Map.of("model", model, "predictionId", String.valueOf(prediction.get("id")))));
        } catch (Exception e) {
            log.warn("Replicate indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
