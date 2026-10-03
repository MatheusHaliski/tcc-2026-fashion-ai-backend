package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ImageEditPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.platform.Http;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Gemini 2.5 Flash Image ("Nano Banana") — edita a partir da foto: recebe a imagem da peça + a instrução e devolve a
 * peça recriada (https://ai.google.dev/gemini-api/docs/image-generation). A imagem sai com a marca d'água invisível
 * SynthID do Google; o selo visível de IA é aplicado depois, no backend. Primeira opção; a reserva é a Replicate
 * ({@link ReplicateImageEditAdapter}).
 */
@Component
@Order(1)
public class GeminiImageEditAdapter implements ImageEditPort {
    static final String ID = "gemini-image";
    private static final String API = "https://generativelanguage.googleapis.com";
    private final RestClient client;
    private final String apiKey;
    private final String model;

    @Autowired
    public GeminiImageEditAdapter(@Value("${fashionai.ai.google-ai-api-key:}") String apiKey,
                                  @Value("${fashionai.ai.gemini-image-model:gemini-2.5-flash-image}") String model) {
        this(apiKey, model, API);
    }

    /** Origem da API configurável só para testes (servidor local). */
    GeminiImageEditAdapter(String apiKey, String model, String apiBase) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        // gerar imagem leva bem mais que uma resposta de texto: 90 s antes de desistir
        this.client = Http.client(apiBase, 90);
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(apiKey) && ProviderCircuit.closed(ID);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<ProviderImage> edit(byte[] image, String mimeType, String prompt) {
        long started = System.nanoTime();
        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("role", "user", "parts", List.of(
                        Map.of("text", prompt),
                        Map.of("inline_data", Map.of("mime_type", mimeType, "data", Base64.getEncoder().encodeToString(image)))))),
                "generationConfig", Map.of("responseModalities", List.of("IMAGE")));
        Map<String, Object> res;
        try {
            res = ProviderCircuit.run(ID, () -> client.post()
                    .uri("/v1beta/models/{model}:generateContent", model)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body).retrieve().body(Map.class));
        } catch (Exception e) {
            throw new IllegalStateException("Gemini (imagem): " + e.getMessage(), e);
        }
        return firstImage(res).map(img -> ImageHttp.result(img.bytes(), img.mimeType(), ID, "0.039", started, Map.of("model", model)));
    }

    record Inline(byte[] bytes, String mimeType) {
    }

    /** Primeira parte de imagem da resposta (a API devolve inlineData; aceita também inline_data). */
    @SuppressWarnings("unchecked")
    static Optional<Inline> firstImage(Map<String, Object> res) {
        List<Map<String, Object>> candidates = res == null ? List.of() : (List<Map<String, Object>>) res.getOrDefault("candidates", List.of());
        for (Map<String, Object> c : candidates) {
            Map<String, Object> content = (Map<String, Object>) c.get("content");
            List<Map<String, Object>> parts = content == null ? List.of() : (List<Map<String, Object>>) content.getOrDefault("parts", List.of());
            for (Map<String, Object> p : parts) {
                Object inline = p.containsKey("inlineData") ? p.get("inlineData") : p.get("inline_data");
                if (inline instanceof Map<?, ?> m && m.get("data") instanceof String data && !data.isBlank()) {
                    Object mime = m.containsKey("mimeType") ? m.get("mimeType") : m.get("mime_type");
                    return Optional.of(new Inline(Base64.getDecoder().decode(data), mime == null ? "image/png" : String.valueOf(mime)));
                }
            }
        }
        return Optional.empty();
    }
}
