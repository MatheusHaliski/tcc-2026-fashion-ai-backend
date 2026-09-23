package br.com.fashionai.application.ai;

import br.com.fashionai.domain.model.enums.AiCallResult;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Resultado governado de uma capacidade de IA. Carrega, além do valor, o "por quê?" (RF24.CA12), o
 * estado de degradação (CA13), a cota restante com horário de reposição (CA14), o estado do
 * consentimento (CA15) e o id do registro da inferência (CA16).
 */
public record AiOutcome<T>(
        T value,
        UUID inferenceId,
        AiCallResult result,
        boolean fallbackUsed,
        String provider,
        String model,
        long latencyMs,
        BigDecimal costUsd,
        String userMessage,
        Explanation explanation,
        Quota quota
) {
    public record Explanation(String capability, String hostRf, String provider, String model,
                              List<String> inputsUsed, String consentState, String reason) {
    }

    public record Quota(int limit, long used, Instant resetAt) {
    }
}
