package br.com.fashionai.infrastructure.ai;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Nova tentativa só para falhas transitórias (E/S, timeout, 429/5xx) e nunca para erro definitivo. */
class ProviderCircuitRetryTest {

    @Test
    void falhaTransitoriaGanhaUmaNovaTentativa() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        String out = ProviderCircuit.run("retry-io", () -> {
            if (calls.incrementAndGet() == 1) throw new IOException("reset");
            return "ok";
        });
        assertThat(out).isEqualTo("ok");
        assertThat(calls).hasValue(2);
        assertThat(ProviderCircuit.closed("retry-io")).isTrue();
    }

    @Test
    void mensagemComCodigoTransitorioTambemRepete() {
        AtomicInteger calls = new AtomicInteger();
        assertThatThrownBy(() -> ProviderCircuit.run("retry-429", () -> {
            calls.incrementAndGet();
            throw new IllegalStateException("HTTP 429 too many");
        })).hasMessageContaining("429");
        assertThat(calls).hasValue(2);
    }

    @Test
    void erroDefinitivoOuSemMensagemNaoRepete() {
        AtomicInteger calls = new AtomicInteger();
        assertThatThrownBy(() -> ProviderCircuit.run("retry-400", () -> {
            calls.incrementAndGet();
            throw new IllegalArgumentException();
        })).isInstanceOf(IllegalArgumentException.class);
        assertThat(calls).hasValue(1);
    }

    @Test
    void circuitoAbertoRecusaSemChamar() throws Exception {
        for (int i = 0; i < 5; i++) {
            try {
                ProviderCircuit.run("retry-open", () -> {
                    throw new IllegalArgumentException("400");
                }, false);
            } catch (IllegalArgumentException expected) {
                // conta mais uma falha
            }
        }
        assertThat(ProviderCircuit.closed("retry-open")).isFalse();
        AtomicInteger calls = new AtomicInteger();
        assertThatThrownBy(() -> ProviderCircuit.run("retry-open", calls::incrementAndGet))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Circuito aberto");
        assertThat(calls).hasValue(0);
    }
}
