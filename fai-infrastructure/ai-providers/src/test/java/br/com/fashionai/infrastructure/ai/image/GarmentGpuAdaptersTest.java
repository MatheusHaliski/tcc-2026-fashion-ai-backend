package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Adaptadores da GPU própria (services/garment_gpu) contra um servidor local que imita a API: envio multipart com a
 * chave no cabeçalho, acompanhamento do job até concluir, download do PNG, exclusão do job, QA reprovado descartado e
 * URL insegura recusada.
 */
class GarmentGpuAdaptersTest {
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13, 'I', 'H', 'D', 'R'};
    private static final String JOB = "0123456789abcdef0123456789abcdef";
    private HttpServer server;
    private final List<String> calls = new CopyOnWriteArrayList<>();
    private final List<String> bodies = new CopyOnWriteArrayList<>();
    private final AtomicInteger polls = new AtomicInteger();
    private volatile String finalJob;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/", ex -> {
            String call = ex.getRequestMethod() + " " + ex.getRequestURI().getPath();
            calls.add(call + " key=" + ex.getRequestHeaders().getFirst("X-API-Key"));
            bodies.add(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.ISO_8859_1));
            byte[] body;
            int status = 200;
            if (call.equals("POST /v1/garments")) {
                status = 202;
                body = ("{\"job_id\":\"" + JOB + "\",\"status\":\"queued\"}").getBytes(StandardCharsets.UTF_8);
            } else if (call.equals("GET /v1/jobs/" + JOB)) {
                body = (polls.incrementAndGet() < 2 ? "{\"status\":\"segmenting\"}" : finalJob).getBytes(StandardCharsets.UTF_8);
            } else if (call.equals("GET /v1/jobs/" + JOB + "/image")) {
                body = PNG;
            } else if (call.equals("DELETE /v1/jobs/" + JOB)) {
                ex.sendResponseHeaders(204, -1);
                ex.close();
                return;
            } else {
                status = 404;
                body = "{}".getBytes(StandardCharsets.UTF_8);
            }
            ex.sendResponseHeaders(status, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
    }

    @AfterEach
    void stop() throws Exception {
        server.stop(0);
        for (String id : new String[]{GarmentGpuSegmentationAdapter.ID, GarmentGpuImageEditAdapter.ID}) {
            ProviderCircuit.run(id, () -> true);
        }
    }

    private GarmentGpuClient client() {
        return new GarmentGpuClient("http://127.0.0.1:" + server.getAddress().getPort(), "k".repeat(64), true, Duration.ofMillis(5));
    }

    @Test
    void segmentacaoAcompanhaOJobBaixaOPngEApagaNoServidor() {
        finalJob = "{\"status\":\"completed\",\"segmentation\":{\"mask_score\":0.97,\"mask_fraction\":0.21,"
                + "\"detection_label\":\"jersey\",\"models\":{\"detector\":\"IDEA-Research/grounding-dino-tiny\"}}}";
        GarmentGpuSegmentationAdapter adapter = new GarmentGpuSegmentationAdapter(client(), 10);
        assertThat(adapter.available()).isTrue();

        ProviderImage img = adapter.removeBackground(new byte[]{1, 2, 3}, "image/jpeg").orElseThrow();

        assertThat(img.bytes()).containsExactly(PNG);
        assertThat(img.provider()).isEqualTo("garment-gpu-segment");
        assertThat(img.costUsd()).isZero();
        assertThat(img.confidence()).isEqualTo(0.97);
        assertThat(img.metadata()).containsEntry("jobId", JOB).containsEntry("detection", "jersey");
        assertThat(calls).allMatch(c -> c.endsWith("key=" + "k".repeat(64)));
        assertThat(calls.get(0)).startsWith("POST /v1/garments");
        assertThat(calls).anyMatch(c -> c.startsWith("DELETE /v1/jobs/" + JOB));
        assertThat(bodies.get(0)).contains("name=\"mode\"").contains("segment").contains("cutout").contains("transparent");
    }

    @Test
    void reconstrucaoAprovadaNoQaVoltaComMetadadosDeIa() {
        finalJob = "{\"status\":\"completed\",\"quality\":{\"verdict\":\"warn\",\"score\":0.71,\"flags\":[\"COLOR_DRIFT\"],"
                + "\"delta_e\":11.2},\"reconstruction\":{\"seed\":7,\"models\":{\"reconstruction\":\"Qwen/Qwen-Image-Edit-2511\"}}}";
        GarmentGpuImageEditAdapter adapter = new GarmentGpuImageEditAdapter(client(), 60, "0.012");

        ProviderImage img = adapter.edit(new byte[]{1, 2, 3}, "image/jpeg", "Recreate the item " + "x".repeat(3000)).orElseThrow();

        assertThat(img.costUsd()).isEqualByComparingTo("0.012");
        assertThat(img.confidence()).isEqualTo(0.71);
        assertThat(img.metadata()).containsEntry("qaVerdict", "warn").containsEntry("aiGenerated", true).containsEntry("seed", 7);
        assertThat(bodies.get(0)).contains("reconstruct").contains("Recreate the item").doesNotContain("x".repeat(2001));
    }

    @Test
    void reconstrucaoReprovadaNoQaOuJobFalhoNaoViraImagem() {
        finalJob = "{\"status\":\"completed\",\"quality\":{\"verdict\":\"fail\",\"flags\":[\"POSSIBLE_PERSON_LEFT\"]}}";
        assertThat(new GarmentGpuImageEditAdapter(client(), 60, "0").edit(new byte[]{1}, "image/png", "p")).isEmpty();
        polls.set(0);
        finalJob = "{\"status\":\"failed\",\"error\":{\"code\":\"NO_GARMENT_DETECTED\"}}";
        assertThat(new GarmentGpuSegmentationAdapter(client(), 10).removeBackground(new byte[]{1}, "image/png")).isEmpty();
        assertThat(calls).anyMatch(c -> c.startsWith("DELETE /v1/jobs/" + JOB));
    }

    @Test
    void semConfiguracaoOuComUrlInseguraFicaIndisponivel() {
        assertThat(new GarmentGpuSegmentationAdapter(new GarmentGpuClient("", "k".repeat(64), true), 10).available()).isFalse();
        assertThat(new GarmentGpuImageEditAdapter(new GarmentGpuClient("https://gpu.example.com", "", true), 60, "0").available()).isFalse();
        assertThat(GarmentGpuClient.acceptableUrl("https://gpu.example.com")).isTrue();
        assertThat(GarmentGpuClient.acceptableUrl("http://gpu.example.com")).isFalse();
        assertThat(GarmentGpuClient.acceptableUrl("http://10.8.0.1:8000")).isTrue();
        assertThat(GarmentGpuClient.acceptableUrl("http://100.101.102.103:8000")).isTrue();
        assertThat(GarmentGpuClient.acceptableUrl("http://garment-gpu.railway.internal:8000")).isTrue();
        assertThat(GarmentGpuClient.acceptableUrl("http://api:8000")).isTrue();
        assertThat(GarmentGpuClient.acceptableUrl("http://8.8.8.8")).isFalse();
        assertThat(GarmentGpuClient.acceptableUrl("https://user:pw@gpu.example.com")).isFalse();
        assertThat(GarmentGpuClient.acceptableUrl("ftp://10.0.0.1")).isFalse();
    }
}
