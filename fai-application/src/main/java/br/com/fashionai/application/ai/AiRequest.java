package br.com.fashionai.application.ai;

import java.util.Map;
import java.util.UUID;

public record AiRequest(
        UUID userId,
        AiCapability capability,
        String provider,
        String model,
        Map<String, Object> input
) {
}
