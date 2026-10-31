package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ImageEditPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Cópia da peça por IA (RF4) na GPU própria: segmenta a peça e o Qwen-Image-Edit (pesos abertos, Apache-2.0) recria a
 * foto de catálogo; o servidor compara a reconstrução com a foto original (cor ΔE, estrutura, silhueta, fundo, pele) e
 * devolve o veredito do QA. Reconstrução reprovada no QA é descartada aqui, e o fluxo segue para Gemini/Replicate (se
 * configurados). Primeira opção quando GARMENT_GPU_URL está configurada ({@code @Order(0)}).
 */
@Component
@Order(0)
public class GarmentGpuImageEditAdapter implements ImageEditPort {
    private static final Logger log = LoggerFactory.getLogger(GarmentGpuImageEditAdapter.class);
    static final String ID = "garment-gpu-edit";
    static final int MAX_PROMPT = 2000;
    private final GarmentGpuClient gpu;
    private final Duration deadline;
    private final String cost;

    public GarmentGpuImageEditAdapter(GarmentGpuClient gpu,
                                      @Value("${fashionai.ai.garment-gpu-edit-timeout-seconds:240}") int timeoutSeconds,
                                      @Value("${fashionai.ai.garment-gpu-edit-cost-usd:0.00}") String cost) {
        this.gpu = gpu;
        this.deadline = Duration.ofSeconds(Math.max(30, timeoutSeconds));
        this.cost = new BigDecimal(cost == null || cost.isBlank() ? "0.00" : cost.trim()).toPlainString();
    }

    @Override
    public boolean available() {
        return gpu.configured() && ProviderCircuit.closed(ID);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<ProviderImage> edit(byte[] image, String mimeType, String prompt) {
        long started = System.nanoTime();
        try {
            Map<String, String> fields = new LinkedHashMap<>(Map.of("mode", "reconstruct", "category", "auto",
                    "background", "white", "framing", "catalog"));
            if (prompt != null && !prompt.isBlank()) {
                fields.put("prompt", prompt.length() > MAX_PROMPT ? prompt.substring(0, MAX_PROMPT) : prompt);
            }
            Optional<GarmentGpuClient.Completed> done = ProviderCircuit.run(ID, () -> gpu.run(image, mimeType, fields, deadline), false);
            if (done.isEmpty()) {
                return Optional.empty();
            }
            Map<String, Object> job = done.get().job();
            Map<String, Object> qa = job.get("quality") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
            Map<String, Object> rec = job.get("reconstruction") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
            String verdict = String.valueOf(qa.getOrDefault("verdict", "fail"));
            if ("fail".equals(verdict)) {
                log.info("garment-gpu: reconstrução {} reprovada no QA {}", done.get().jobId(), qa.get("flags"));
                return Optional.empty();
            }
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("jobId", done.get().jobId());
            meta.put("models", rec.getOrDefault("models", Map.of()));
            meta.put("seed", rec.get("seed"));
            meta.put("qaVerdict", verdict);
            meta.put("qaFlags", qa.getOrDefault("flags", java.util.List.of()));
            meta.put("deltaE", qa.get("delta_e"));
            meta.put("aiGenerated", true);
            double confidence = qa.get("score") instanceof Number n ? n.doubleValue() : 0.6;
            return Optional.of(new ProviderImage(done.get().png(), "image/png", ID, new BigDecimal(cost),
                    (System.nanoTime() - started) / 1_000_000, confidence, meta));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("garment-gpu (reconstrução) indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
