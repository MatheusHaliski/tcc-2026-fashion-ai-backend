package br.com.fashionai.application.ai;

import java.util.List;
import java.util.UUID;

/**
 * Pedido para um provedor externo: prompt de sistema, prompt do usuário, imagens opcionais e saída JSON.
 * {@code webSearch} libera a ferramenta de busca na web do provedor (hoje só o Claude), usada pelo Brand Logo Finder.
 */
public record AiRequest(
        UUID userId,
        AiCapability capability,
        String model,
        String system,
        String prompt,
        List<AiImage> images,
        long maxTokens,
        boolean expectJson,
        boolean webSearch
) {
    public AiRequest {
        images = images == null ? List.of() : List.copyOf(images);
        maxTokens = maxTokens <= 0 ? 2048 : maxTokens;
    }

    public AiRequest(UUID userId, AiCapability capability, String model, String system, String prompt, List<AiImage> images,
                     long maxTokens, boolean expectJson) {
        this(userId, capability, model, system, prompt, images, maxTokens, expectJson, false);
    }

    public record AiImage(byte[] bytes, String mimeType) {
    }
}
