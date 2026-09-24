package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.Model3dPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.TaskStatus;
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
 * Meshy image-to-3D (RF16): submete o recorte da peça, acompanha a tarefa (PENDING → IN_PROGRESS → SUCCEEDED) e
 * devolve a URL do GLB texturizado (PBR). Tarefa típica: 1–3 min; o worker consulta a cada poucos segundos.
 */
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
    public String providerId() {
        return ID;
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(apiKey) && ProviderCircuit.closed(ID);
    }

    @Override
    public BigDecimal costUsd() {
        return new BigDecimal("0.4000");
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<String> submit(byte[] image) {
        try {
            Map<String, Object> res = ProviderCircuit.run(ID, () -> client.post().uri("/openapi/v1/image-to-3d")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("image_url", ImageHttp.dataUri(image, "image/png"), "enable_pbr", true, "should_texture", true,
                            "should_remesh", true, "topology", "triangle", "target_polycount", 30000))
                    .retrieve().body(Map.class));
            Object id = res == null ? null : res.get("result");
            return id == null ? Optional.empty() : Optional.of(String.valueOf(id));
        } catch (Exception e) {
            log.warn("Meshy indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<TaskStatus> poll(String taskId) {
        try {
            Map<String, Object> res = ProviderCircuit.run(ID, () -> client.get().uri("/openapi/v1/image-to-3d/{id}", taskId)
                    .header("Authorization", "Bearer " + apiKey).retrieve().body(Map.class));
            if (res == null) {
                return Optional.empty();
            }
            String status = String.valueOf(res.get("status"));
            int progress = res.get("progress") instanceof Number n ? n.intValue() : 0;
            Object urls = res.get("model_urls");
            String glb = urls instanceof Map<?, ?> m && m.get("glb") != null ? String.valueOf(m.get("glb")) : null;
            Object err = res.get("task_error");
            String error = err instanceof Map<?, ?> m && m.get("message") != null && !String.valueOf(m.get("message")).isBlank()
                    ? String.valueOf(m.get("message")) : null;
            String state = switch (status) {
                case "SUCCEEDED" -> "SUCCEEDED";
                case "FAILED", "CANCELED", "EXPIRED" -> "FAILED";
                case "IN_PROGRESS" -> "RUNNING";
                default -> "PENDING";
            };
            return Optional.of(new TaskStatus(state, progress, glb, error == null && "FAILED".equals(state) ? "Meshy: " + status : error));
        } catch (Exception e) {
            log.warn("Meshy (consulta) indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
