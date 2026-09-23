package br.com.fashionai.application.ai;

import java.util.List;
import java.util.UUID;

/** Pedido para um provedor externo: prompt de sistema, prompt do usuário, imagens opcionais e saída JSON. */
public record AiRequest(
        UUID userId,
        AiCapability capability,
        String model,
        String system,
        String prompt,
        List<AiImage> images,
        long maxTokens,
        boolean expectJson
) {
    public AiRequest {
        images = images == null ? List.of() : List.copyOf(images);
        maxTokens = maxTokens <= 0 ? 2048 : maxTokens;
    }

    public record AiImage(byte[] bytes, String mimeType) {
    }
}
