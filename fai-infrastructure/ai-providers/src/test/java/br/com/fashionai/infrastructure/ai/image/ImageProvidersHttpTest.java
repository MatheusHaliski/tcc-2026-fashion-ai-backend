package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.ai.RestClientFakes;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.MultiValueMap;

import java.math.BigDecimal;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Provedores de imagem por HTTP (Photoroom, rembg, remove.bg, Stability, Gemini Image, FASHN): cabeçalhos de
 * autenticação, resultado montado com custo e provedor, e Optional vazio quando a API responde vazio ou com erro.
 */
class ImageProvidersHttpTest {
    private static final byte[] IMG = {1, 2, 3, 4};
    private static final byte[] GLB = new byte[32];

    @AfterEach
    void fechaCircuitos() throws Exception {
        for (String id : new String[]{"photoroom", "rembg", "removebg", "stability-upscale", "stability-sf3d", "gemini-image", "fashn"}) {
            ProviderCircuit.run(id, () -> true);
        }
    }

    private static void bytes(MockRestServiceServer server, String url, byte[] body) {
        server.reset();
        server.expect(requestTo(url)).andExpect(method(HttpMethod.POST))
                .andRespond(body == null ? withSuccess() : withSuccess(body, MediaType.IMAGE_PNG));
    }

    private static void erro(MockRestServiceServer server, String url) {
        server.reset();
        server.expect(requestTo(url)).andRespond(withBadRequest());
    }

    @Test
    void photoroomMontaOsCamposDoEstudioEDevolveJpeg() {
        PhotoroomStudioAdapter adapter = new PhotoroomStudioAdapter(" pr ");
        MockRestServiceServer server = RestClientFakes.bind(adapter, "https://image-api.photoroom.com");
        server.expect(requestTo("https://image-api.photoroom.com/v2/edit")).andExpect(header("x-api-key", "pr"))
                .andExpect(content().string(containsString("ai.soft")))
                .andRespond(withSuccess(IMG, MediaType.IMAGE_JPEG));
        ProviderImage img = adapter.studio(IMG, "#F5F5F5", 800, 1000, 0.05).orElseThrow();
        assertThat(img.mimeType()).isEqualTo("image/jpeg");
        assertThat(img.provider()).isEqualTo("photoroom");
        assertThat(img.costUsd()).isEqualByComparingTo("0.1");
        assertThat(img.metadata()).containsEntry("background", "#F5F5F5");
        assertThat(adapter.available()).isTrue();
        assertThat(new PhotoroomStudioAdapter(null).available()).isFalse();

        bytes(server, "https://image-api.photoroom.com/v2/edit", new byte[0]);
        assertThat(adapter.studio(IMG, "fff", 1, 1, 0)).isEmpty();
        erro(server, "https://image-api.photoroom.com/v2/edit");
        assertThat(adapter.studio(IMG, "fff", 1, 1, 0)).isEmpty();
    }

    @Test
    void rembgSoComUrlHttpEDevolvePng() {
        assertThat(new RembgAdapter(null, 5).available()).isFalse();
        assertThat(new RembgAdapter("ftp://x", 5).available()).isFalse();
        RembgAdapter adapter = new RembgAdapter("http://rembg.local", 5);
        assertThat(adapter.available()).isTrue();
        MockRestServiceServer server = RestClientFakes.bind(adapter, "http://rembg.local");
        bytes(server, "http://rembg.local/api/remove", IMG);
        ProviderImage img = adapter.removeBackground(IMG, "image/jpeg").orElseThrow();
        assertThat(img.bytes()).containsExactly(IMG);
        assertThat(img.metadata()).containsEntry("model", "u2net");
        bytes(server, "http://rembg.local/api/remove", null);
        assertThat(adapter.removeBackground(IMG, "image/png")).isEmpty();
        erro(server, "http://rembg.local/api/remove");
        assertThat(adapter.removeBackground(IMG, "image/png")).isEmpty();
    }

    @Test
    void removeBgComChaveEDevolvePng() {
        RemoveBgAdapter adapter = new RemoveBgAdapter("rb", 5);
        assertThat(adapter.available()).isTrue();
        assertThat(new RemoveBgAdapter("placeholder", 5).available()).isFalse();
        MockRestServiceServer server = RestClientFakes.bind(adapter, "https://api.remove.bg");
        server.expect(requestTo("https://api.remove.bg/v1.0/removebg")).andExpect(header("X-Api-Key", "rb"))
                .andRespond(withSuccess(IMG, MediaType.IMAGE_PNG));
        assertThat(adapter.removeBackground(IMG, null).orElseThrow().costUsd()).isEqualByComparingTo("0.20");
        bytes(server, "https://api.remove.bg/v1.0/removebg", null);
        assertThat(adapter.removeBackground(IMG, null)).isEmpty();
        erro(server, "https://api.remove.bg/v1.0/removebg");
        assertThat(adapter.removeBackground(IMG, null)).isEmpty();
    }

    @Test
    void stabilityUpscaleAmplia4x() {
        StabilityUpscaleAdapter adapter = new StabilityUpscaleAdapter("st");
        assertThat(adapter.available()).isTrue();
        assertThat(new StabilityUpscaleAdapter(" ").available()).isFalse();
        MockRestServiceServer server = RestClientFakes.bind(adapter, "https://api.stability.ai");
        String url = "https://api.stability.ai/v2beta/stable-image/upscale/fast";
        server.expect(requestTo(url)).andExpect(header("Authorization", "Bearer st")).andRespond(withSuccess(IMG, MediaType.IMAGE_PNG));
        assertThat(adapter.upscale(IMG).orElseThrow().metadata()).containsEntry("scale", 4);
        bytes(server, url, new byte[0]);
        assertThat(adapter.upscale(IMG)).isEmpty();
        erro(server, url);
        assertThat(adapter.upscale(IMG)).isEmpty();
    }

    @Test
    void stabilityFast3dGeraGlbNaHoraEDescartaRespostaCurta() {
        StabilityFast3dAdapter adapter = new StabilityFast3dAdapter("st");
        assertThat(adapter.providerId()).isEqualTo("stability-sf3d");
        assertThat(adapter.async()).isFalse();
        assertThat(adapter.costUsd()).isEqualByComparingTo(new BigDecimal("0.1"));
        assertThat(adapter.submit(IMG)).isEmpty();
        assertThat(adapter.available()).isTrue();
        assertThat(new StabilityFast3dAdapter(null).available()).isFalse();
        MockRestServiceServer server = RestClientFakes.bind(adapter, "https://api.stability.ai");
        String url = "https://api.stability.ai/v2beta/3d/stable-fast-3d";
        bytes(server, url, GLB);
        assertThat(adapter.generateNow(IMG)).hasValueSatisfying(g -> assertThat(g).hasSize(32));
        bytes(server, url, IMG);
        assertThat(adapter.generateNow(IMG)).isEmpty();
        bytes(server, url, null);
        assertThat(adapter.generateNow(IMG)).isEmpty();
        erro(server, url);
        assertThat(adapter.generateNow(IMG)).isEmpty();
    }

    @Test
    void geminiImageDevolveAPrimeiraImagemOuVazio() {
        GeminiImageEditAdapter adapter = new GeminiImageEditAdapter("g", "gemini-2.5-flash-image", "https://gl.local");
        MockRestServiceServer server = RestClientFakes.bind(adapter, "https://gl.local");
        String url = "https://gl.local/v1beta/models/gemini-2.5-flash-image:generateContent";
        String data = Base64.getEncoder().encodeToString(IMG);
        server.expect(requestTo(url)).andExpect(header("x-goog-api-key", "g"))
                .andRespond(withSuccess("{\"candidates\":[{\"content\":{\"parts\":[{\"inlineData\":{\"data\":\"" + data + "\"}}]}}]}",
                        MediaType.APPLICATION_JSON));
        ProviderImage img = adapter.edit(IMG, "image/png", "recrie").orElseThrow();
        assertThat(img.mimeType()).isEqualTo("image/png");
        assertThat(img.metadata()).containsEntry("model", "gemini-2.5-flash-image");

        server.reset();
        server.expect(requestTo(url)).andRespond(withSuccess("{\"candidates\":[{},{\"content\":{\"parts\":[{\"inlineData\":{\"data\":\" \"}}]}}]}",
                MediaType.APPLICATION_JSON));
        assertThat(adapter.edit(IMG, "image/png", "x")).isEmpty();
        erro(server, url);
        assertThatThrownBy(() -> adapter.edit(IMG, "image/png", "x")).isInstanceOf(IllegalStateException.class)
                .hasMessageStartingWith("Gemini (imagem): ");
    }

    @Test
    void fashnSemIdOuComErroNaoEspera() {
        FashnTryOnAdapter adapter = new FashnTryOnAdapter("fa", "tryon-v1.6");
        assertThat(adapter.available()).isTrue();
        assertThat(new FashnTryOnAdapter(null, "m").available()).isFalse();
        MockRestServiceServer server = RestClientFakes.bind(adapter, "https://api.fashn.ai");
        server.expect(requestTo("https://api.fashn.ai/v1/run")).andExpect(header("Authorization", "Bearer fa"))
                .andExpect(content().string(containsString("\"category\":\"auto\"")))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThat(adapter.tryOn(IMG, IMG, null)).isEmpty();
        server.verify();
        bytes(server, "https://api.fashn.ai/v1/run", null);
        assertThat(adapter.tryOn(IMG, IMG, "tops")).isEmpty();
        erro(server, "https://api.fashn.ai/v1/run");
        assertThat(adapter.tryOn(IMG, IMG, "tops")).isEmpty();
    }

    @Test
    void fashnInterrompidoDuranteAEsperaDesisteSemImagem() {
        FashnTryOnAdapter adapter = new FashnTryOnAdapter("fa", "tryon-v1.6");
        MockRestServiceServer server = RestClientFakes.bind(adapter, "https://api.fashn.ai");
        server.expect(requestTo("https://api.fashn.ai/v1/run")).andRespond(withSuccess("{\"id\":\"p1\"}", MediaType.APPLICATION_JSON));
        Thread.currentThread().interrupt();
        Optional<ProviderImage> out = adapter.tryOn(IMG, IMG, "tops");
        boolean stillInterrupted = Thread.interrupted();
        assertThat(out).isEmpty();
        assertThat(stillInterrupted).isFalse();
    }

    @Test
    void utilitariosDeMultipartEDataUri() {
        MultiValueMap<String, Object> png = ImageHttp.multipart("f", IMG, "image/png", Map.of("a", "1"));
        assertThat(((org.springframework.core.io.Resource) png.getFirst("f")).getFilename()).isEqualTo("image.png");
        assertThat(png.getFirst("a")).isEqualTo("1");
        MultiValueMap<String, Object> jpg = ImageHttp.multipart("f", IMG, null, Map.of());
        assertThat(((org.springframework.core.io.Resource) jpg.getFirst("f")).getFilename()).isEqualTo("image.jpg");
        assertThat(ImageHttp.dataUri(IMG, null)).startsWith("data:image/jpeg;base64,");
        assertThat(ImageHttp.dataUri(IMG, "image/webp")).startsWith("data:image/webp;base64,");
        assertThat(ImageHttp.configured(null)).isFalse();
        assertThat(ImageHttp.configured(" ")).isFalse();
        assertThat(ImageHttp.configured("placeholder")).isFalse();
        assertThat(ImageHttp.configured("k")).isTrue();
    }
}
