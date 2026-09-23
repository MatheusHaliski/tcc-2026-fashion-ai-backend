package br.com.fashionai.web.error;

import java.time.Instant;
import java.util.Map;

/**
 * Corpo JSON de todo erro da API (RNF7/RNF8): código estável para a UI decidir o que fazer
 * e mensagem em português pronta para exibir.
 */
public record ApiError(int status, String code, String message, Map<String, Object> details, String path,
                       Instant timestamp, String correlationId) {
}
