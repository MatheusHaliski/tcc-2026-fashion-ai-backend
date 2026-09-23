package br.com.fashionai.domain.model.enums;

/** RF24.CA13-CA16 — resultado registrado de cada inferência. */
public enum AiCallResult {
    SUCCESS,
    FALLBACK_LOCAL,
    TIMEOUT,
    CIRCUIT_OPEN,
    RATE_LIMITED,
    CONSENT_DENIED,
    PROMPT_REJECTED,
    ERROR
}
