package br.com.fashionai.infrastructure.ai;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProviderHelpersTest {
    @Test
    void stripsMarkdownFencesAroundJson() {
        assertThat(ClaudeProvider.stripFences("```json\n{\"a\":1}\n```")).isEqualTo("{\"a\":1}");
        assertThat(ClaudeProvider.stripFences("{\"a\":1}")).isEqualTo("{\"a\":1}");
        assertThat(ClaudeProvider.stripFences(null)).isEmpty();
    }

    /**
     * O motor acha o provedor pelo id do catálogo: com o Claude catalogado como "anthropic" (e registrado como "claude")
     * nenhuma capacidade chegava a chamá-lo — a análise da peça caía no motor local, que não lê marca.
     */
    @Test
    void catalogUsesTheIdsTheAdaptersRegisterWith() {
        var analyzer = br.com.fashionai.application.ai.AiCatalog.spec(br.com.fashionai.application.ai.AiCapability.PIECE_ANALYZER);
        assertThat(analyzer.primary().providerId()).isEqualTo(GeminiProvider.ID);
        assertThat(analyzer.alternative().providerId()).isEqualTo(ClaudeProvider.ID);
        assertThat(br.com.fashionai.application.ai.AiCatalog.all()).allSatisfy(spec -> {
            for (var option : new br.com.fashionai.application.ai.AiCatalog.ProviderOption[]{spec.primary(), spec.alternative()}) {
                if (option != null) {
                    assertThat(option.providerId()).isNotEqualTo("anthropic");
                }
            }
        });
    }

    @Test
    void pricingUsesPerMillionTokenTables() {
        assertThat(Pricing.estimate("claude-opus-5", 1_000_000, 0)).isEqualByComparingTo(new BigDecimal("5.000000"));
        assertThat(Pricing.estimate("gemini-2.5-flash", 0, 1_000_000)).isEqualByComparingTo(new BigDecimal("2.500000"));
        assertThat(Pricing.estimate("claude-desconhecido", 1_000_000, 0)).isEqualByComparingTo(new BigDecimal("5.000000"));
    }

    @Test
    void circuitOpensAfterFiveConsecutiveFailuresAndClosesOnSuccess() throws Exception {
        String provider = "teste-" + System.nanoTime();
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> ProviderCircuit.run(provider, () -> {
                throw new RuntimeException("boom");
            })).hasMessage("boom");
        }
        assertThat(ProviderCircuit.closed(provider)).isFalse();
        assertThatThrownBy(() -> ProviderCircuit.run(provider, () -> "ok")).isInstanceOf(IllegalStateException.class);

        String healthy = "ok-" + System.nanoTime();
        AtomicInteger calls = new AtomicInteger();
        assertThat(ProviderCircuit.run(healthy, () -> "r" + calls.incrementAndGet())).isEqualTo("r1");
        assertThat(ProviderCircuit.closed(healthy)).isTrue();
    }
}
