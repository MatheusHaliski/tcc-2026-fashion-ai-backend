package br.com.fashionai.application.ai;

/**
 * Provedor externo de IA textual/multimodal (Claude, Gemini). Cada adaptador aplica timeout de 30 s,
 * 1 retry com backoff e circuit breaker próprios (RF24.CA13 / RNF8) e só fica disponível quando a chave
 * existe no ambiente.
 */
public interface AiProviderPort {
    String providerId();

    boolean available();

    AiResponse invoke(AiRequest request);
}
