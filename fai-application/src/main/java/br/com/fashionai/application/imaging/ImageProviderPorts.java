package br.com.fashionai.application.imaging;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Portas dos provedores externos de imagem usados pelos pipelines RF4 (Flat Lay), RF5 (card) e RF18
 * (provador híbrido). Cada adaptador só é ativado quando a chave existe no ambiente; sem chave, o
 * pipeline usa as etapas locais (Java2D) e registra fallback_used = true.
 */
public final class ImageProviderPorts {
    private ImageProviderPorts() {
    }

    /** Remoção de fundo — Rembg.com (primário) / Remove.bg (alternativa). */
    public interface BackgroundRemovalPort {
        boolean available();

        Optional<ProviderImage> removeBackground(byte[] image, String mimeType);
    }

    /** Normalização de cor/transformações — Cloudinary. */
    public interface ColorNormalizationPort {
        boolean available();

        Optional<ProviderImage> normalize(byte[] image, String mimeType);
    }

    /** Try-on por difusão — FASHN.ai (slots TOP/BOTTOM/OUTER/acessório flexível). */
    public interface TryOnProviderPort {
        boolean available();

        Optional<ProviderImage> tryOn(byte[] modelImage, byte[] garmentImage, String category);
    }

    /** Polimento pós try-on — Cleanup.ai (remoção de artefatos). */
    public interface ArtifactCleanupPort {
        boolean available();

        Optional<ProviderImage> cleanup(byte[] image);
    }

    /** Geração de arte de fundo — Adobe Firefly / Replicate (SD) / Gemini Image. */
    public interface ImageGenerationPort {
        boolean available();

        Optional<ProviderImage> generate(String prompt, String negativePrompt, int width, int height);
    }

    /** RF16 — geração 3D (Meshy). Tema futuro: permanece desabilitado por feature flag. */
    public interface Model3dPort {
        boolean available();

        Optional<String> submit(byte[] image);
    }

    public record ProviderImage(byte[] bytes, String mimeType, String provider, BigDecimal costUsd, long latencyMs,
                                double confidence, Map<String, Object> metadata) {
    }

    public record Landmark(String name, double x, double y, double angleDeg) {
    }

    public record LandmarkSet(List<Landmark> landmarks) {
    }
}
