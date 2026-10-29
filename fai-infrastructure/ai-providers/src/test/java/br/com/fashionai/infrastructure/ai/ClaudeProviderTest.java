package br.com.fashionai.infrastructure.ai;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.AiResponse;
import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.ServerToolUsage;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Claude: monta o pedido (imagens, JSON, sistema, busca), escolhe o cliente e lê texto, uso e custo da resposta. */
class ClaudeProviderTest {
    private final ClaudeProvider provider = new ClaudeProvider(" sk-ant ", 30);
    private final AnthropicClient client = mock(AnthropicClient.class, RETURNS_DEEP_STUBS);
    private final AnthropicClient vision = mock(AnthropicClient.class, RETURNS_DEEP_STUBS);

    ClaudeProviderTest() {
        RestClientFakes.set(provider, "client", client);
        RestClientFakes.set(provider, "visionClient", vision);
    }

    @AfterEach
    void fechaCircuito() throws Exception {
        ProviderCircuit.run(ClaudeProvider.ID, () -> true);
    }

    private static Message message(String text, StopReason stop, long searches) {
        Message m = mock(Message.class, RETURNS_DEEP_STUBS);
        when(m.usage().inputTokens()).thenReturn(1000L);
        when(m.usage().outputTokens()).thenReturn(500L);
        ServerToolUsage tools = mock(ServerToolUsage.class);
        when(tools.webSearchRequests()).thenReturn(searches);
        when(m.usage().serverToolUse()).thenReturn(searches > 0 ? Optional.of(tools) : Optional.empty());
        when(m.stopReason()).thenReturn(Optional.ofNullable(stop));
        ContentBlock block = mock(ContentBlock.class);
        TextBlock tb = mock(TextBlock.class);
        when(tb.text()).thenReturn(text);
        when(block.text()).thenReturn(Optional.of(tb));
        ContentBlock other = mock(ContentBlock.class);
        when(other.text()).thenReturn(Optional.empty());
        when(m.content()).thenReturn(List.of(other, block));
        return m;
    }

    private static AiRequest request(AiCapability cap, String system, List<AiRequest.AiImage> images, boolean json, boolean web) {
        return new AiRequest(null, cap, "claude-opus-5", system, "descreva", images, 100, json, web);
    }

    @Test
    void identidadeEDisponibilidadeConformeAChave() {
        assertThat(provider.providerId()).isEqualTo("claude");
        assertThat(provider.available()).isTrue();
        assertThat(new ClaudeProvider(null, 30).available()).isFalse();
        assertThat(new ClaudeProvider("placeholder-x", 30).available()).isFalse();
    }

    @Test
    void respostaComCercasEUsoViraAiResponse() {
        Message m = message("```json\n{\"ok\":true}\n```", null, 0);
        when(client.messages().create(any(MessageCreateParams.class))).thenReturn(m);
        List<AiRequest.AiImage> images = List.of(new AiRequest.AiImage(new byte[]{1}, "image/png"),
                new AiRequest.AiImage(new byte[]{2}, "IMAGE/WEBP"), new AiRequest.AiImage(new byte[]{3}, "image/gif"),
                new AiRequest.AiImage(new byte[]{4}, "image/bmp"), new AiRequest.AiImage(new byte[]{5}, null));
        AiResponse r = provider.invoke(request(AiCapability.values()[0] == AiCapability.MULTI_PIECE_DETECTOR
                ? AiCapability.values()[1] : AiCapability.values()[0], "seja breve", images, true, false));
        assertThat(r.text()).isEqualTo("{\"ok\":true}");
        assertThat(r.provider()).isEqualTo("claude");
        assertThat(r.inputTokens()).isEqualTo(1000);
        assertThat(r.outputTokens()).isEqualTo(500);
        assertThat(r.estimatedCostUsd()).isEqualByComparingTo(Pricing.estimate("claude-opus-5", 1000, 500));
        ArgumentCaptor<MessageCreateParams> params = ArgumentCaptor.forClass(MessageCreateParams.class);
        verify(client.messages(), atLeastOnce()).create(params.capture());
        assertThat(params.getValue().system()).isPresent();
        assertThat(params.getValue().tools()).isEmpty();
        assertThat(params.getValue().messages().get(0).toString()).contains("Responda somente com JSON válido");
    }

    @Test
    void deteccaoDePecasUsaOClienteDeVisao() {
        Message m = message("{}", null, 0);
        when(vision.messages().create(any(MessageCreateParams.class))).thenReturn(m);
        provider.invoke(request(AiCapability.MULTI_PIECE_DETECTOR, " ", List.of(), false, false));
        verify(vision.messages()).create(any(MessageCreateParams.class));
        verify(client.messages(), never()).create(any(MessageCreateParams.class));
    }

    @Test
    void buscaNaWebContinuaAposPausaESomaOCustoDasBuscas() {
        Message paused = message("pensando", StopReason.PAUSE_TURN, 2);
        Message done = message("Fontes: x. {\"logo\":\"a\"} fim", StopReason.END_TURN, 1);
        when(client.messages().create(any(MessageCreateParams.class))).thenReturn(paused, done);
        AiResponse r = provider.invoke(new AiRequest(null, AiCapability.values()[0] == AiCapability.MULTI_PIECE_DETECTOR
                ? AiCapability.values()[1] : AiCapability.values()[0], "claude-opus-5", null, null, List.of(), 100, false, true));
        assertThat(r.text()).isEqualTo("{\"logo\":\"a\"}");
        assertThat(r.inputTokens()).isEqualTo(2000);
        assertThat(r.estimatedCostUsd()).isEqualByComparingTo(Pricing.estimate("claude-opus-5", 2000, 1000).add(Pricing.webSearch(3)));
        ArgumentCaptor<MessageCreateParams> params = ArgumentCaptor.forClass(MessageCreateParams.class);
        verify(client.messages(), times(2)).create(params.capture());
        assertThat(params.getValue().tools()).isPresent();
    }

    @Test
    void falhaDoSdkViraIllegalState() {
        when(vision.messages().create(any(MessageCreateParams.class))).thenThrow(new RuntimeException("recusado"));
        assertThatThrownBy(() -> provider.invoke(request(AiCapability.MULTI_PIECE_DETECTOR, null, List.of(), false, false)))
                .isInstanceOf(IllegalStateException.class).hasMessage("Claude: recusado");
    }

    @Test
    void ultimoJsonDoTexto() {
        assertThat(ClaudeProvider.lastJson(null)).isEmpty();
        assertThat(ClaudeProvider.lastJson("{\"a\":1}")).isEqualTo("{\"a\":1}");
        assertThat(ClaudeProvider.lastJson("```json\n{}\n```")).startsWith("```");
        assertThat(ClaudeProvider.lastJson("sem json")).isEqualTo("sem json");
        assertThat(ClaudeProvider.lastJson("antes {\"a\":{\"b\":1}} depois")).isEqualTo("{\"a\":{\"b\":1}}");
        assertThat(ClaudeProvider.lastJson("só fecha }")).isEqualTo("só fecha }");
        assertThat(ClaudeProvider.stripFences("```\nsem fim")).isEqualTo("sem fim");
        assertThat(ClaudeProvider.stripFences(null)).isEmpty();
    }
}
