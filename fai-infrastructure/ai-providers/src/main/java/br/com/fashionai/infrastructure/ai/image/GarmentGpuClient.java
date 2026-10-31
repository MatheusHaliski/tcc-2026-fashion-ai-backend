package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.InetAddress;
import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Cliente da API própria de GPU ({@code services/garment_gpu}): Grounding DINO + SAM 2.1 (segmentação) e
 * Qwen-Image-Edit (reconstrução) rodando em servidores NVIDIA da equipe, sem API de imagem de terceiros.
 * <p>
 * A API é assíncrona: envia a foto ({@code POST /v1/garments}), acompanha o job até {@code completed}/{@code failed}
 * ou o prazo, e baixa o PNG final. A chave vai só no cabeçalho {@code X-API-Key}; a URL precisa ser https, ou http
 * apenas em rede privada (loopback, 10/8, 172.16/12, 192.168/16, 100.64/10 do Tailscale, nomes {@code *.internal} ou
 * nome de serviço sem ponto). Por padrão o job é apagado no servidor de GPU depois do download (minimização de dados).
 */
@Component
class GarmentGpuClient {
    private static final Logger log = LoggerFactory.getLogger(GarmentGpuClient.class);
    private static final Pattern JOB_ID = Pattern.compile("[0-9a-f]{32}");
    static final int MAX_JSON_BYTES = 256_000;
    static final int MAX_IMAGE_BYTES = 30_000_000;
    private final RestClient client;
    private final String apiKey;
    private final boolean configured;
    private final boolean deleteAfterDownload;
    private final Duration pollInterval;

    @Autowired
    GarmentGpuClient(@Value("${fashionai.ai.garment-gpu-url:}") String url,
                     @Value("${fashionai.ai.garment-gpu-api-key:}") String apiKey,
                     @Value("${fashionai.ai.garment-gpu-delete-after-download:true}") boolean deleteAfterDownload) {
        this(url, apiKey, deleteAfterDownload, Duration.ofMillis(1500));
    }

    GarmentGpuClient(String url, String apiKey, boolean deleteAfterDownload, Duration pollInterval) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.configured = acceptableUrl(url) && ImageHttp.configured(this.apiKey);
        this.deleteAfterDownload = deleteAfterDownload;
        this.pollInterval = pollInterval;
        this.client = Http.client(configured ? url.trim() : "http://localhost:8000", 30);
        if (url != null && !url.isBlank() && !acceptableUrl(url)) {
            log.warn("GARMENT_GPU_URL recusada: use https, ou http só em rede privada");
        }
    }

    boolean configured() {
        return configured;
    }

    /** Job concluído: o registro público (status, métricas, QA, revisão) e o PNG final. */
    record Completed(String jobId, Map<String, Object> job, byte[] png) {
    }

    /**
     * Envia e acompanha até o fim. Vazio quando o job termina em {@code failed} (ex.: nenhuma peça detectada) ou o
     * prazo acaba — nesses casos o job é apagado no servidor de GPU. Erro de rede/HTTP sobe como exceção (conta para o
     * circuit breaker do adaptador).
     */
    Optional<Completed> run(byte[] image, String mimeType, Map<String, String> fields, Duration deadline) throws Exception {
        Map<String, Object> accepted = json(client.post().uri("/v1/garments").header("X-API-Key", apiKey)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(ImageHttp.multipart("image", image, mimeType, fields)));
        String jobId = String.valueOf(accepted.get("job_id"));
        if (!JOB_ID.matcher(jobId).matches()) {
            throw new IllegalStateException("garment-gpu: job_id inválido na resposta");
        }
        long until = System.nanoTime() + deadline.toNanos();
        Map<String, Object> job = accepted;
        while (System.nanoTime() < until) {
            Thread.sleep(pollInterval.toMillis());
            job = json(client.get().uri("/v1/jobs/{id}", jobId).header("X-API-Key", apiKey));
            String status = String.valueOf(job.get("status"));
            if ("completed".equals(status)) {
                byte[] png = bytes(client.get().uri("/v1/jobs/{id}/image", jobId).header("X-API-Key", apiKey));
                discard(jobId, deleteAfterDownload);
                return Optional.of(new Completed(jobId, job, png));
            }
            if ("failed".equals(status)) {
                log.info("garment-gpu: job {} falhou ({})", jobId, job.get("error"));
                discard(jobId, true);
                return Optional.empty();
            }
        }
        log.warn("garment-gpu: job {} passou do prazo de {} s (último status: {})", jobId, deadline.toSeconds(), job.get("status"));
        discard(jobId, true);
        return Optional.empty();
    }

    private void discard(String jobId, boolean delete) {
        if (!delete) {
            return;
        }
        try {
            client.delete().uri("/v1/jobs/{id}", jobId).header("X-API-Key", apiKey).retrieve().toBodilessEntity();
        } catch (Exception e) {
            log.debug("garment-gpu: não apagou o job {}: {}", jobId, e.getMessage());   // a retenção do bucket expira
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> json(RestClient.RequestHeadersSpec<?> request) {
        return request.exchange((req, res) -> {
            byte[] body = res.getBody().readNBytes(MAX_JSON_BYTES + 1);
            if (res.getStatusCode().isError() || body.length > MAX_JSON_BYTES) {
                throw new IllegalStateException("garment-gpu respondeu HTTP " + res.getStatusCode().value());
            }
            return Json.MAPPER.readValue(body, Map.class);
        });
    }

    private static byte[] bytes(RestClient.RequestHeadersSpec<?> request) {
        return request.exchange((req, res) -> {
            byte[] body = res.getBody().readNBytes(MAX_IMAGE_BYTES + 1);
            if (res.getStatusCode().isError() || body.length == 0 || body.length > MAX_IMAGE_BYTES) {
                throw new IllegalStateException("garment-gpu: download da imagem falhou (HTTP " + res.getStatusCode().value() + ")");
            }
            return body;
        });
    }

    /** https sempre; http só para destinos privados (a chave não pode trafegar em claro pela internet). */
    static boolean acceptableUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (IllegalArgumentException e) {
            return false;
        }
        String scheme = String.valueOf(uri.getScheme()).toLowerCase(Locale.ROOT);
        String host = uri.getHost();
        if (host == null || uri.getRawUserInfo() != null) {
            return false;
        }
        if ("https".equals(scheme)) {
            return true;
        }
        if (!"http".equals(scheme)) {
            return false;
        }
        host = host.toLowerCase(Locale.ROOT);
        if (host.equals("localhost") || host.endsWith(".internal") || !host.contains(".") && !host.contains(":")) {
            return true;
        }
        if (!host.matches("[0-9.]+|\\[?[0-9a-f:]+]?")) {
            return false;
        }
        try {
            InetAddress ip = InetAddress.getByName(host.replace("[", "").replace("]", ""));
            byte[] a = ip.getAddress();
            boolean cgnat = a.length == 4 && (a[0] & 0xFF) == 100 && (a[1] & 0xC0) == 64;
            return ip.isLoopbackAddress() || ip.isSiteLocalAddress() || cgnat || a.length == 16 && (a[0] & 0xFE) == 0xFC;
        } catch (Exception e) {
            return false;
        }
    }
}
