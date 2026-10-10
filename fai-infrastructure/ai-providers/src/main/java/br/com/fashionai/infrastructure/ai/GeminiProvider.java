package br.com.fashionai.infrastructure.ai;

import br.com.fashionai.application.ai.AiProviderPort;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.AiResponse;
import br.com.fashionai.infrastructure.platform.Http;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Google Gemini (generateContent) — texto e visão; JSON garantido por responseMimeType quando pedido. */
@Component
public class GeminiProvider implements AiProviderPort {
    public static final String ID = "gemini";
    private final RestClient client;
    private final RestClient visionClient;
    private final String apiKey;

    public GeminiProvider(@Value("${fashionai.ai.google-ai-api-key:}") String apiKey,
                          @Value("${fashionai.ai.timeout-seconds:30}") int timeoutSeconds) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = Http.client("https://generativelanguage.googleapis.com", timeoutSeconds);
        this.visionClient = Http.client("https://generativelanguage.googleapis.com", Math.min(6, timeoutSeconds));
    }

    @Override
    public String providerId() {
        return ID;
    }

    @Override
    public boolean available() {
        return !apiKey.isBlank() && !apiKey.startsWith("placeholder") && ProviderCircuit.closed(ID);
    }

    @Override
    @SuppressWarnings("unchecked")
    public AiResponse invoke(AiRequest request) {
        long started = System.nanoTime();
        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", request.prompt() == null ? "" : request.prompt()));
        for (AiRequest.AiImage img : request.images()) {
            parts.add(Map.of("inline_data", Map.of("mime_type", img.mimeType(), "data", Base64.getEncoder().encodeToString(img.bytes()))));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        if (request.system() != null && !request.system().isBlank()) {
            body.put("system_instruction", Map.of("parts", List.of(Map.of("text", request.system()))));
        }
        body.put("contents", List.of(Map.of("role", "user", "parts", parts)));
        Map<String, Object> generation = new LinkedHashMap<>();
        generation.put("maxOutputTokens", request.maxTokens());
        generation.put("temperature", 0.4);
        if (request.expectJson()) {
            generation.put("responseMimeType", "application/json");
        }
        body.put("generationConfig", generation);
        Map<String, Object> res;
        boolean interactive = request.capability() == AiCapability.MULTI_PIECE_DETECTOR;
        RestClient selected = interactive ? visionClient : client;
        try {
            res = ProviderCircuit.run(ID, () -> selected.post()
                    .uri("/v1beta/models/{model}:generateContent", request.model())
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body).retrieve().body(Map.class), !interactive);
        } catch (Exception e) {
            throw new IllegalStateException("Gemini: " + e.getMessage(), e);
        }
        StringBuilder text = new StringBuilder();
        List<Map<String, Object>> candidates = res == null ? List.of() : (List<Map<String, Object>>) res.getOrDefault("candidates", List.of());
        if (!candidates.isEmpty()) {
            Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
            List<Map<String, Object>> outParts = content == null ? List.of() : (List<Map<String, Object>>) content.getOrDefault("parts", List.of());
            outParts.forEach(p -> text.append(String.valueOf(p.getOrDefault("text", ""))));
        }
        Map<String, Object> usage = res == null ? Map.of() : (Map<String, Object>) res.getOrDefault("usageMetadata", Map.of());
        long in = ((Number) usage.getOrDefault("promptTokenCount", 0)).longValue();
        long out = ((Number) usage.getOrDefault("candidatesTokenCount", 0)).longValue();
        long latency = (System.nanoTime() - started) / 1_000_000;
        return new AiResponse(ID, request.model(), latency, Pricing.estimate(request.model(), in, out), text.toString(), in, out);
    }
}
