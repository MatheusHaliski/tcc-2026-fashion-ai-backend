package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.BackgroundRemovalPort;
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
 * Remoção de fundo do RF4 pela GPU própria: Grounding DINO localiza a peça e o SAM 2.1 recorta só os pixels dela
 * (PNG do mesmo quadro, fundo transparente — mesmo contrato do rembg). Primeira opção quando GARMENT_GPU_URL está
 * configurada ({@code @Order(0)}); sem ela, ou com o circuito aberto, seguem rembg/remove.bg e o motor local.
 */
@Component
@Order(0)
public class GarmentGpuSegmentationAdapter implements BackgroundRemovalPort {
    private static final Logger log = LoggerFactory.getLogger(GarmentGpuSegmentationAdapter.class);
    static final String ID = "garment-gpu-segment";
    private final GarmentGpuClient gpu;
    private final Duration deadline;

    public GarmentGpuSegmentationAdapter(GarmentGpuClient gpu,
                                         @Value("${fashionai.ai.garment-gpu-segment-timeout-seconds:45}") int timeoutSeconds) {
        this.gpu = gpu;
        this.deadline = Duration.ofSeconds(Math.max(5, timeoutSeconds));
    }

    @Override
    public boolean available() {
        return gpu.configured() && ProviderCircuit.closed(ID);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<ProviderImage> removeBackground(byte[] image, String mimeType) {
        long started = System.nanoTime();
        try {
            Map<String, String> fields = Map.of("mode", "segment", "category", "auto", "background", "transparent",
                    "framing", "cutout");
            Optional<GarmentGpuClient.Completed> done = ProviderCircuit.run(ID, () -> gpu.run(image, mimeType, fields, deadline), false);
            if (done.isEmpty()) {
                return Optional.empty();
            }
            Map<String, Object> seg = done.get().job().get("segmentation") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("jobId", done.get().jobId());
            meta.put("models", seg.getOrDefault("models", Map.of()));
            meta.put("maskFraction", seg.get("mask_fraction"));
            meta.put("detection", seg.get("detection_label"));
            double confidence = seg.get("mask_score") instanceof Number n ? n.doubleValue() : 0.9;
            return Optional.of(new ProviderImage(done.get().png(), "image/png", ID, BigDecimal.ZERO,
                    (System.nanoTime() - started) / 1_000_000, confidence, meta));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("garment-gpu (segmentação) indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
