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

    /** RF4 · estúdio — ampliação/nitidez por IA (Stability Upscale). */
    public interface UpscalePort {
        boolean available();

        Optional<ProviderImage> upscale(byte[] png);
    }

    /** RF4 · estúdio — foto de produto por IA: fundo de estúdio, reiluminação e sombra (Photoroom). */
    public interface StudioShotPort {
        boolean available();

        /**
         * @param cutoutPng recorte com margem transparente só nos lados inteiros (lados cortados encostam na borda)
         * @param padding   margem dos lados inteiros (fração) · @param width, height quadro de saída
         */
        Optional<ProviderImage> studio(byte[] cutoutPng, String backgroundHex, int width, int height, double padding);
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
    /**
     * RF16 — provedor de imagem → 3D. Assíncrono (Meshy): {@link #submit} devolve o id da tarefa e {@link #poll}
     * acompanha até o GLB ficar pronto. Síncrono (Stability SF3D): {@link #generateNow} devolve o GLB na hora.
     */
    public interface Model3dPort {
        boolean available();

        Optional<String> submit(byte[] image);

        default String providerId() {
            return getClass().getSimpleName();
        }

        default boolean async() {
            return true;
        }

        default Optional<TaskStatus> poll(String taskId) {
            return Optional.empty();
        }

        default Optional<byte[]> generateNow(byte[] image) {
            return Optional.empty();
        }

        default java.math.BigDecimal costUsd() {
            return java.math.BigDecimal.ZERO;
        }
    }

    /** Estado de uma tarefa externa de 3D: PENDING, RUNNING, SUCCEEDED ou FAILED; progresso 0–100. */
    public record TaskStatus(String state, int progress, String glbUrl, String error) {
    }

    public record ProviderImage(byte[] bytes, String mimeType, String provider, BigDecimal costUsd, long latencyMs,
                                double confidence, Map<String, Object> metadata) {
    }

    public record Landmark(String name, double x, double y, double angleDeg) {
    }

    public record LandmarkSet(List<Landmark> landmarks) {
    }
}
