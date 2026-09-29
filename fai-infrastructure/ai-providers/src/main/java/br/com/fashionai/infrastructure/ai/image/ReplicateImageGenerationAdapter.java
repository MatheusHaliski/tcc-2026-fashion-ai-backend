package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ImageGenerationPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Geração de arte de fundo (RF11) com FLUX schnell via Replicate (~US$0,003/imagem).
 * <p>
 * O token (Bearer) só vai para a própria API da Replicate: as URLs que chegam no corpo da resposta ({@code urls.get}
 * e a saída) são dados de terceiros. {@code urls.get} só é seguida se for da mesma origem da API
 * (https://api.replicate.com); o arquivo de saída, normalmente em replicate.delivery, é baixado SEM o cabeçalho
 * Authorization — o token só acompanha o download quando a saída também está em api.replicate.com.
 */
@Component
public class ReplicateImageGenerationAdapter implements ImageGenerationPort {
    private static final Logger log = LoggerFactory.getLogger(ReplicateImageGenerationAdapter.class);
    private static final String ID = "replicate";
    static final String API = "https://api.replicate.com";
    private final RestClient client;
    private final String token;
    private final String model;
    private final URI apiOrigin;
    private final Duration pollInterval;

    @Autowired
    public ReplicateImageGenerationAdapter(@Value("${fashionai.ai.replicate-api-token:}") String token,
                                           @Value("${fashionai.ai.replicate-image-model:black-forest-labs/flux-schnell}") String model) {
        this(token, model, API, Duration.ofSeconds(2));
    }

    /** Origem da API e intervalo de consulta configuráveis só para testes (servidor local). */
    ReplicateImageGenerationAdapter(String token, String model, String apiBase, Duration pollInterval) {
        this.token = token == null ? "" : token.trim();
        this.model = model;
        this.apiOrigin = URI.create(apiBase);
        this.pollInterval = pollInterval;
        this.client = Http.client(apiBase, 60);
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(token) && ProviderCircuit.closed(ID);
    }

    @Override
    public Optional<ProviderImage> generate(String prompt, String negativePrompt, int width, int height) {
        String aspect = width == height ? "1:1" : width > height ? "16:9" : "9:16";
        Map<String, Object> input = Map.of("prompt", prompt, "aspect_ratio", aspect, "output_format", "png", "num_outputs", 1);
        return predict(model, input, "0.003");
    }

    /**
     * Uma previsão da Replicate do começo ao fim: cria (esperando até 60 s), acompanha pela {@code urls.get} da mesma
     * origem e baixa a saída com as regras do token descritas na classe. Também usada pela cópia da peça por IA
     * ({@link ReplicateImageEditAdapter}), com outro modelo e outra entrada.
     */
    @SuppressWarnings("unchecked")
    Optional<ProviderImage> predict(String model, Map<String, Object> input, String cost) {
        long started = System.nanoTime();
        try {
            Map<String, Object> prediction = ProviderCircuit.run(ID, () -> client.post()
                    .uri("/v1/models/{model}/predictions", model)
                    .header("Authorization", "Bearer " + token)
                    .header("Prefer", "wait=60")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("input", input)).retrieve().body(Map.class));
            for (int i = 0; i < 30 && prediction != null && !"succeeded".equals(prediction.get("status")); i++) {
                String state = String.valueOf(prediction.get("status"));
                if ("failed".equals(state) || "canceled".equals(state)) {
                    log.warn("Replicate falhou: {}", prediction.get("error"));
                    return Optional.empty();
                }
                Thread.sleep(pollInterval.toMillis());
                Map<String, Object> urls = (Map<String, Object>) prediction.get("urls");
                Object get = urls == null ? null : urls.get("get");
                if (get == null) {
                    return Optional.empty();
                }
                URI poll = parse(String.valueOf(get));
                if (!sameOrigin(poll)) {
                    // nunca manda o token para um host que veio no corpo da resposta
                    log.warn("Replicate: urls.get fora de {} recusada ({})", apiOrigin.getAuthority(), poll == null ? "?" : poll.getScheme() + "://" + poll.getHost() + (poll.getPort() == -1 ? "" : ":" + poll.getPort()));
                    return Optional.empty();
                }
                prediction = Http.client(poll.toString(), 30).get().header("Authorization", "Bearer " + token).retrieve().body(Map.class);
            }
            if (prediction == null || !"succeeded".equals(prediction.get("status"))) {
                return Optional.empty();
            }
            Object output = prediction.get("output");
            String url = output instanceof List<?> l && !l.isEmpty() ? String.valueOf(l.get(0)) : String.valueOf(output);
            byte[] bytes = downloadOutput(url);
            return Optional.of(ImageHttp.result(bytes, "image/png", ID, cost, started, Map.of("model", model, "predictionId", String.valueOf(prediction.get("id")))));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Replicate indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** Saída da previsão: token só se o arquivo estiver na própria API; em outro host (replicate.delivery), sem ele. */
    byte[] downloadOutput(String url) {
        URI uri = parse(url);
        // saída em outro host: https (ou o mesmo esquema da API configurada, que em produção já é https)
        boolean schemeOk = uri != null && ("https".equalsIgnoreCase(uri.getScheme()) || apiOrigin.getScheme().equalsIgnoreCase(String.valueOf(uri.getScheme())));
        if (!schemeOk || uri.getHost() == null) {
            throw new IllegalStateException("Replicate: URL de saída recusada (esperado https)");
        }
        if (!sameOrigin(uri)) {
            return ImageHttp.download(uri.toString(), 30);
        }
        byte[] bytes = Http.client(uri.toString(), 30).get().header("Authorization", "Bearer " + token).retrieve().body(byte[].class);
        if (bytes == null || bytes.length == 0) {
            throw new IllegalStateException("download vazio: " + uri.getPath());
        }
        return bytes;
    }

    /** Mesmo esquema, host e porta da API configurada (https://api.replicate.com), sem usuário embutido na URL. */
    boolean sameOrigin(URI uri) {
        return uri != null && uri.getRawUserInfo() == null
                && apiOrigin.getScheme().equalsIgnoreCase(String.valueOf(uri.getScheme()))
                && apiOrigin.getHost() != null && uri.getHost() != null
                && apiOrigin.getHost().toLowerCase(Locale.ROOT).equals(uri.getHost().toLowerCase(Locale.ROOT))
                && port(apiOrigin) == port(uri);
    }

    private static int port(URI u) {
        if (u.getPort() != -1) {
            return u.getPort();
        }
        return "https".equalsIgnoreCase(u.getScheme()) ? 443 : 80;
    }

    private static URI parse(String url) {
        try {
            return url == null || url.isBlank() || "null".equals(url) ? null : URI.create(url.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
