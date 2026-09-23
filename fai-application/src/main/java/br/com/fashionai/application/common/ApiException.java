package br.com.fashionai.application.common;

import java.util.Map;

/**
 * Erro de negócio com status HTTP e código estável — a UI nunca recebe erro cru (RNF8/RNF7):
 * sempre um código e uma mensagem tratada em português.
 */
public class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    private final Map<String, Object> details;

    public ApiException(int status, String code, String message) {
        this(status, code, message, Map.of());
    }

    public ApiException(int status, String code, String message, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details == null ? Map.of() : details;
    }

    public int status() {
        return status;
    }

    public String code() {
        return code;
    }

    public Map<String, Object> details() {
        return details;
    }

    public static ApiException notFound(String what) {
        return new ApiException(404, "NAO_ENCONTRADO", what + " não encontrado(a).");
    }

    public static ApiException forbidden(String message) {
        return new ApiException(403, "ACESSO_NEGADO", message);
    }

    public static ApiException badRequest(String code, String message) {
        return new ApiException(400, code, message);
    }

    public static ApiException badRequest(String code, String message, Map<String, Object> details) {
        return new ApiException(400, code, message, details);
    }

    public static ApiException conflict(String code, String message) {
        return new ApiException(409, code, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(401, "NAO_AUTENTICADO", message);
    }

    public static ApiException tooMany(String message, Map<String, Object> details) {
        return new ApiException(429, "COTA_ESGOTADA", message, details);
    }
}
