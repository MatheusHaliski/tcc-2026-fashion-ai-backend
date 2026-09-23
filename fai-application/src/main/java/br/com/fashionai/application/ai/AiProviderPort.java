package br.com.fashionai.application.ai;

public interface AiProviderPort {
    AiResponse invoke(AiRequest request);
}
