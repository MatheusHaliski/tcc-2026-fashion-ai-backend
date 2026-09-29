package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Random;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reserva da cópia por IA (FLUX Kontext na Replicate): manda a foto como data URI junto com a instrução, no modelo de
 * edição, e devolve a imagem baixada; foto grande é reduzida antes para caber no data URI.
 */
class ReplicateImageEditAdapterTest {
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13, 'I', 'H', 'D', 'R', 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0};
    private HttpServer server;
    private final List<String> bodies = new CopyOnWriteArrayList<>();
    private final List<String> paths = new CopyOnWriteArrayList<>();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath();
            paths.add(path);
            bodies.add(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body;
            if (path.equals("/out.png")) {
                body = PNG;
                ex.getResponseHeaders().add("Content-Type", "image/png");
            } else {
                body = ("{\"id\":\"p1\",\"status\":\"succeeded\",\"output\":\"" + base() + "/out.png\"}").getBytes(StandardCharsets.UTF_8);
                ex.getResponseHeaders().add("Content-Type", "application/json");
            }
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private String base() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @Test
    void mandaAFotoEAInstrucaoParaOModeloDeEdicao() {
        String model = "black-forest-labs/flux-kontext-pro";
        ReplicateImageEditAdapter adapter = new ReplicateImageEditAdapter(
                new ReplicateImageGenerationAdapter("r8_teste", model, base(), Duration.ofMillis(10)), model);
        assertThat(adapter.available()).isTrue();

        ProviderImage img = adapter.edit(new byte[]{1, 2, 3}, "image/jpeg", "Recreate the item").orElseThrow();

        assertThat(img.bytes()).containsExactly(PNG);
        assertThat(img.costUsd()).isEqualByComparingTo("0.04");
        assertThat(paths.get(0)).isEqualTo("/v1/models/" + model + "/predictions");
        assertThat(bodies.get(0)).contains("\"prompt\":\"Recreate the item\"")
                .contains("\"input_image\":\"data:image/jpeg;base64,AQID\"")
                .contains("match_input_image");
    }

    @Test
    void semTokenNaoFicaDisponivel() {
        assertThat(new ReplicateImageEditAdapter("", "black-forest-labs/flux-kontext-pro").available()).isFalse();
    }

    @Test
    void fotoGrandeEReduzidaParaCaberNoDataUri() {
        // ruído não comprime: um PNG de 900 px passa com folga do limite
        BufferedImage noisy = new BufferedImage(900, 900, BufferedImage.TYPE_INT_RGB);
        Random r = new Random(7);
        for (int y = 0; y < 900; y++) {
            for (int x = 0; x < 900; x++) {
                noisy.setRGB(x, y, r.nextInt(0xFFFFFF));
            }
        }
        byte[] big = ImageOps.png(noisy);
        assertThat(big.length).isGreaterThan(ReplicateImageEditAdapter.MAX_DATA_URI_BYTES);
        assertThat(ReplicateImageEditAdapter.fitDataUri(big).length).isLessThan(big.length);
        byte[] small = {1, 2, 3};
        assertThat(ReplicateImageEditAdapter.fitDataUri(small)).isSameAs(small);
    }
}
