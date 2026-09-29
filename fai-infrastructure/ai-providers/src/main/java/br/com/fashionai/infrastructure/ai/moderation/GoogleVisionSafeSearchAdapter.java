package br.com.fashionai.infrastructure.ai.moderation;

import br.com.fashionai.application.moderation.ImageSafetyPorts.Likelihoods;
import br.com.fashionai.application.moderation.ImageSafetyPorts.RemoteClassifierPort;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.platform.Http;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Google Cloud Vision SafeSearch (moderação de imagens enviadas, docs/seguranca/moderacao-de-imagens.md): classificador
 * de nudez/conteúdo adulto. Só é usado com {@code GOOGLE_VISION_API_KEY} configurada no ambiente do servidor; sem ela,
 * vale a segmentação local, que só retém para revisão humana. A imagem vai reduzida (≤ 1024 px, JPEG) e não é guardada
 * pelo Google para treino (termos do Cloud Vision).
 * <p>
 * A chave vai no cabeçalho {@code x-goog-api-key}, nunca na URL: URL com {@code ?key=} acaba em mensagens de erro do
 * cliente HTTP (logadas pelo ProviderCircuit), em logs de proxy e em traces.
 */
@Component
public class GoogleVisionSafeSearchAdapter implements RemoteClassifierPort {
    private static final String ID = "google-vision-safesearch";
    private static final List<String> SCALE = List.of("UNKNOWN", "VERY_UNLIKELY", "UNLIKELY", "POSSIBLE", "LIKELY", "VERY_LIKELY");
    private final RestClient client;
    private final String apiKey;

    @Autowired
    public GoogleVisionSafeSearchAdapter(@Value("${fashionai.ai.google-vision-api-key:}") String apiKey,
                                         @Value("${fashionai.ai.timeout-seconds:30}") int timeoutSeconds) {
        this(apiKey, timeoutSeconds, "https://vision.googleapis.com");
    }

    /** Base da API configurável só para testes (servidor local). */
    GoogleVisionSafeSearchAdapter(String apiKey, int timeoutSeconds, String baseUrl) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = Http.client(baseUrl, Math.min(timeoutSeconds, 15));
    }

    @Override
    public String name() {
        return ID;
    }

    @Override
    public boolean available() {
        return !apiKey.isBlank() && !apiKey.startsWith("placeholder") && ProviderCircuit.closed(ID);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<Likelihoods> classify(byte[] jpeg) {
        Map<String, Object> body = Map.of("requests", List.of(Map.of(
                "image", Map.of("content", Base64.getEncoder().encodeToString(jpeg)),
                "features", List.of(Map.of("type", "SAFE_SEARCH_DETECTION")))));
        try {
            Map<String, Object> res = ProviderCircuit.run(ID, () -> client.post().uri("/v1/images:annotate")
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(Map.class));
            List<Map<String, Object>> responses = res == null ? null : (List<Map<String, Object>>) res.get("responses");
            if (responses == null || responses.isEmpty()) {
                return Optional.empty();
            }
            return parse(responses.get(0));
        } catch (Exception ex) {
            throw new IllegalStateException(ex.getMessage(), ex);
        }
    }

    @SuppressWarnings("unchecked")
    static Optional<Likelihoods> parse(Map<String, Object> response) {
        Object ann = response.get("safeSearchAnnotation");
        if (!(ann instanceof Map<?, ?> a)) {
            return Optional.empty();
        }
        Map<String, Object> m = (Map<String, Object>) a;
        return Optional.of(new Likelihoods(level(m.get("adult")), level(m.get("racy")), level(m.get("violence"))));
    }

    static int level(Object v) {
        int i = v == null ? 0 : SCALE.indexOf(String.valueOf(v));
        return Math.max(i, 0);
    }
}
