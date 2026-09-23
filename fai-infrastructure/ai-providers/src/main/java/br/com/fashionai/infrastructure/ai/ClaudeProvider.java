package br.com.fashionai.infrastructure.ai;

import br.com.fashionai.application.ai.AiProviderPort;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.AiResponse;
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.TextBlockParam;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Anthropic Claude via SDK oficial (Messages API) — texto e visão. O SDK já aplica timeout e uma nova tentativa;
 * o {@link ProviderCircuit} adiciona o circuit breaker por provedor exigido no RF24.CA13.
 */
@Component
public class ClaudeProvider implements AiProviderPort {
    public static final String ID = "claude";
    private final AnthropicClient client;
    private final boolean configured;

    public ClaudeProvider(@Value("${fashionai.ai.anthropic-api-key:}") String apiKey,
                          @Value("${fashionai.ai.timeout-seconds:30}") int timeoutSeconds) {
        String key = apiKey == null ? "" : apiKey.trim();
        this.configured = !key.isBlank() && !key.startsWith("placeholder");
        this.client = AnthropicOkHttpClient.builder()
                .apiKey(configured ? key : "not-configured")
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .maxRetries(1)
                .build();
    }

    @Override
    public String providerId() {
        return ID;
    }

    @Override
    public boolean available() {
        return configured && ProviderCircuit.closed(ID);
    }

    @Override
    public AiResponse invoke(AiRequest request) {
        long started = System.nanoTime();
        List<ContentBlockParam> blocks = new ArrayList<>();
        for (AiRequest.AiImage img : request.images()) {
            blocks.add(ContentBlockParam.ofImage(ImageBlockParam.builder()
                    .source(Base64ImageSource.builder()
                            .mediaType(mediaType(img.mimeType()))
                            .data(Base64.getEncoder().encodeToString(img.bytes()))
                            .build())
                    .build()));
        }
        String prompt = request.prompt() == null ? "" : request.prompt();
        if (request.expectJson()) {
            prompt = prompt + "\n\nResponda somente com JSON válido, sem texto antes ou depois.";
        }
        blocks.add(ContentBlockParam.ofText(TextBlockParam.builder().text(prompt).build()));
        MessageCreateParams.Builder params = MessageCreateParams.builder()
                .model(request.model())
                .maxTokens(request.maxTokens())
                .addUserMessageOfBlockParams(blocks);
        if (request.system() != null && !request.system().isBlank()) {
            params.system(request.system());
        }
        Message message;
        try {
            message = ProviderCircuit.run(ID, () -> client.messages().create(params.build()));
        } catch (Exception e) {
            throw new IllegalStateException("Claude: " + e.getMessage(), e);
        }
        StringBuilder text = new StringBuilder();
        message.content().forEach(block -> block.text().ifPresent(t -> text.append(t.text())));
        long in = message.usage().inputTokens();
        long out = message.usage().outputTokens();
        long latency = (System.nanoTime() - started) / 1_000_000;
        return new AiResponse(ID, request.model(), latency, Pricing.estimate(request.model(), in, out), stripFences(text.toString()), in, out);
    }

    private static Base64ImageSource.MediaType mediaType(String mime) {
        if (mime == null) {
            return Base64ImageSource.MediaType.IMAGE_JPEG;
        }
        return switch (mime.toLowerCase()) {
            case "image/png" -> Base64ImageSource.MediaType.IMAGE_PNG;
            case "image/webp" -> Base64ImageSource.MediaType.IMAGE_WEBP;
            case "image/gif" -> Base64ImageSource.MediaType.IMAGE_GIF;
            default -> Base64ImageSource.MediaType.IMAGE_JPEG;
        };
    }

    /** Remove cercas ```json ... ``` caso o modelo as inclua, para o parser JSON do AiEngine. */
    static String stripFences(String s) {
        String t = s == null ? "" : s.trim();
        if (t.startsWith("```")) {
            t = t.substring(t.indexOf('\n') + 1);
            int end = t.lastIndexOf("```");
            if (end >= 0) {
                t = t.substring(0, end);
            }
        }
        return t.trim();
    }
}
