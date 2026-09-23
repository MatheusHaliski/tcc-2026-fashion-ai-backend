package br.com.fashionai.application.ai;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Map;

public record AiResponse(
        String provider,
        String model,
        Duration latency,
        BigDecimal estimatedCostUsd,
        Map<String, Object> output
) {
}
