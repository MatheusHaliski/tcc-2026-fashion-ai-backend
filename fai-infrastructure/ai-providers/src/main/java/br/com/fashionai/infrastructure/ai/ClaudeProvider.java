package br.com.fashionai.infrastructure.ai;

import br.com.fashionai.application.ai.AiProviderPort;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.AiResponse;
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.ServerToolUsage;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlockParam;
import com.anthropic.models.messages.WebSearchTool20260209;
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
    private final AnthropicClient visionClient;
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
        this.visionClient = AnthropicOkHttpClient.builder()
                .apiKey(configured ? key : "not-configured")
                .timeout(Duration.ofSeconds(Math.min(6, timeoutSeconds)))
                .maxRetries(0).build();
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
        if (request.webSearch()) {
            // busca na web executada no servidor da Anthropic; o modelo cita as fontes e devolve só o JSON pedido
            params.addTool(WebSearchTool20260209.builder().maxUses(3L).build());
        }
        Message message;
        long in = 0;
        long out = 0;
        long searches = 0;
        boolean interactive = request.capability() == AiCapability.MULTI_PIECE_DETECTOR;
        AnthropicClient selected = interactive ? visionClient : client;
        try {
            message = ProviderCircuit.run(ID, () -> selected.messages().create(params.build()), !interactive);
            in += message.usage().inputTokens();
            out += message.usage().outputTokens();
            searches += message.usage().serverToolUse().map(ServerToolUsage::webSearchRequests).orElse(0L);
            // ferramentas de servidor podem pausar a vez em execuções longas: reenviamos a resposta para o modelo continuar
            for (int i = 0; i < 2 && message.stopReason().map(StopReason.PAUSE_TURN::equals).orElse(false); i++) {
                params.addMessage(message);
                message = ProviderCircuit.run(ID, () -> client.messages().create(params.build()));
                in += message.usage().inputTokens();
                out += message.usage().outputTokens();
                searches += message.usage().serverToolUse().map(ServerToolUsage::webSearchRequests).orElse(0L);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Claude: " + e.getMessage(), e);
        }
        StringBuilder text = new StringBuilder();
        message.content().forEach(block -> block.text().ifPresent(t -> text.append(t.text())));
        long latency = (System.nanoTime() - started) / 1_000_000;
        java.math.BigDecimal cost = Pricing.estimate(request.model(), in, out).add(Pricing.webSearch(searches));
        return new AiResponse(ID, request.model(), latency, cost, stripFences(lastJson(text.toString())), in, out);
    }

    /** Com busca na web o modelo pode escrever antes do JSON final; ficamos com o último objeto {...}. */
    static String lastJson(String s) {
        String t = s == null ? "" : s.trim();
        int end = t.lastIndexOf('}');
        if (t.startsWith("{") || t.startsWith("```") || end < 0) {
            return t;
        }
        int depth = 0;
        for (int i = end; i >= 0; i--) {
            char c = t.charAt(i);
            if (c == '}') {
                depth++;
            } else if (c == '{' && --depth == 0) {
                return t.substring(i, end + 1);
            }
        }
        return t;
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
