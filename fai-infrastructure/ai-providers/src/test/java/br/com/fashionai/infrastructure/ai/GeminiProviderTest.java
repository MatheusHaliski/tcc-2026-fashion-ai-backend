package br.com.fashionai.infrastructure.ai;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.AiResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Gemini generateContent: corpo do pedido, cliente de visão para detecção de peças e leitura de texto e uso. */
class GeminiProviderTest {
    private static final String BASE = "https://generativelanguage.googleapis.com";
    private static final String URL = BASE + "/v1beta/models/gemini-2.5-flash:generateContent";
    private final GeminiProvider provider = new GeminiProvider(" g ", 30);
    private final MockRestServiceServer server = RestClientFakes.bind(provider, "client", BASE);
    private final MockRestServiceServer vision = RestClientFakes.bind(provider, "visionClient", BASE);

    @AfterEach
    void fechaCircuito() throws Exception {
        ProviderCircuit.run(GeminiProvider.ID, () -> true);
    }

    private static AiCapability texto() {
        return AiCapability.values()[0] == AiCapability.MULTI_PIECE_DETECTOR ? AiCapability.values()[1] : AiCapability.values()[0];
    }

    @Test
    void disponivelSoComChaveReal() {
        assertThat(provider.providerId()).isEqualTo("gemini");
        assertThat(provider.available()).isTrue();
        assertThat(new GeminiProvider(null, 30).available()).isFalse();
        assertThat(new GeminiProvider("placeholder", 30).available()).isFalse();
    }

    @Test
    void pedidoComSistemaJsonEImagemEJuntaOTextoDasPartes() {
        server.expect(requestTo(URL)).andExpect(header("x-goog-api-key", "g"))
                .andExpect(content().string(allOf(containsString("system_instruction"), containsString("\"responseMimeType\":\"application/json\""),
                        containsString("inline_data"))))
                .andRespond(withSuccess("{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"{\\\"a\\\"\"},{\"text\":\":1}\"},{}]}}],"
                        + "\"usageMetadata\":{\"promptTokenCount\":10,\"candidatesTokenCount\":4}}", MediaType.APPLICATION_JSON));
        AiResponse r = provider.invoke(new AiRequest(null, texto(), "gemini-2.5-flash", "sistema", "oi",
                List.of(new AiRequest.AiImage(new byte[]{1}, "image/png")), 50, true));
        assertThat(r.text()).isEqualTo("{\"a\":1}");
        assertThat(r.inputTokens()).isEqualTo(10);
        assertThat(r.outputTokens()).isEqualTo(4);
        assertThat(r.estimatedCostUsd()).isEqualByComparingTo(Pricing.estimate("gemini-2.5-flash", 10, 4));
        server.verify();
    }

    @Test
    void deteccaoUsaClienteDeVisaoERespostaSemCandidatosFicaVazia() {
        vision.expect(requestTo(URL)).andExpect(content().string(allOf(not(containsString("system_instruction")),
                        not(containsString("responseMimeType")))))
                .andRespond(withSuccess("{\"candidates\":[]}", MediaType.APPLICATION_JSON));
        AiResponse r = provider.invoke(new AiRequest(null, AiCapability.MULTI_PIECE_DETECTOR, "gemini-2.5-flash", " ", null, List.of(), 50, false));
        assertThat(r.text()).isEmpty();
        assertThat(r.inputTokens()).isZero();
        vision.verify();
    }

    @Test
    void candidatoSemConteudoECorpoVazio() {
        server.expect(requestTo(URL)).andRespond(withSuccess("{\"candidates\":[{}]}", MediaType.APPLICATION_JSON));
        assertThat(provider.invoke(new AiRequest(null, texto(), "gemini-2.5-flash", null, "x", List.of(), 50, false)).text()).isEmpty();
        server.reset();
        server.expect(requestTo(URL)).andRespond(withSuccess());
        assertThat(provider.invoke(new AiRequest(null, texto(), "gemini-2.5-flash", null, "x", List.of(), 50, false)).outputTokens()).isZero();
    }

    @Test
    void erroDaApiViraIllegalState() {
        server.expect(requestTo(URL)).andRespond(withBadRequest());
        assertThatThrownBy(() -> provider.invoke(new AiRequest(null, texto(), "gemini-2.5-flash", null, "x", List.of(), 50, false)))
                .isInstanceOf(IllegalStateException.class).hasMessageStartingWith("Gemini: ");
    }
}
