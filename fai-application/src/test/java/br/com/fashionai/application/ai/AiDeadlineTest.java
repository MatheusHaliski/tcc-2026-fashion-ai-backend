package br.com.fashionai.application.ai;

import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiDeadlineTest {
    @Test
    void stalledProviderReturnsAtDeadlineAndIsInterrupted() throws Exception {
        var interrupted = new CountDownLatch(1);
        assertThatThrownBy(() -> AiDeadline.call(() -> {
            try { new CountDownLatch(1).await(); } catch (InterruptedException ex) { interrupted.countDown(); throw ex; }
            return "never";
        }, System.nanoTime() + Duration.ofMillis(200).toNanos())).isInstanceOf(TimeoutException.class);
        assertThat(interrupted.await(1, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void expiredBudgetNeverCallsAnotherProviderAndFailuresArePreserved() throws Exception {
        assertThatThrownBy(() -> AiDeadline.call(() -> { throw new AssertionError("must not call"); }, System.nanoTime() - 1))
                .isInstanceOf(TimeoutException.class);
        assertThatThrownBy(() -> AiDeadline.call(() -> { throw new IllegalStateException("invalid json"); }, System.nanoTime() + Duration.ofSeconds(1).toNanos()))
                .isInstanceOf(IllegalStateException.class).hasMessage("invalid json");
        assertThat(AiDeadline.call(() -> "ok", System.nanoTime() + Duration.ofSeconds(1).toNanos())).isEqualTo("ok");
    }
}
