package br.com.fashionai.application.ai;

import java.math.BigDecimal;

/** Resposta de um provedor: texto (ou JSON), uso de tokens e custo estimado a partir do preço do catálogo. */
public record AiResponse(
        String provider,
        String model,
        long latencyMs,
        BigDecimal estimatedCostUsd,
        String text,
        long inputTokens,
        long outputTokens
) {
}
