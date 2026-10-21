package br.com.fashionai.infrastructure.platform.web;

import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JdkWebFetchDeadlineTest {
    static final class Subscription implements Flow.Subscription {
        boolean cancelled;
        long requested;
        @Override public void request(long n) { requested += n; }
        @Override public void cancel() { cancelled = true; }
    }

    @Test
    void incompleteResponseBodyTimesOutAndCancelsRequest() {
        // The HTTP response future cannot complete until LimitedBody.onComplete.
        var body = new JdkWebFetchAdapter.LimitedBody(32);
        body.onSubscribe(new Subscription());
        body.onNext(List.of(ByteBuffer.wrap(new byte[]{1, 2, 3})));
        var pending = new CompletableFuture<Object>();
        assertThat(body.getBody().toCompletableFuture().isDone()).isFalse();
        assertThatThrownBy(() -> JdkWebFetchAdapter.awaitResponse(pending, Duration.ofMillis(10).toNanos()))
                .isInstanceOf(TimeoutException.class);
        assertThat(pending.isCancelled()).isTrue();
    }

    @Test
    void oversizedBodyCancelsSubscriptionWithoutBufferingBeyondLimit() {
        var body = new JdkWebFetchAdapter.LimitedBody(3);
        var subscription = new Subscription(); body.onSubscribe(subscription);
        body.onNext(List.of(ByteBuffer.wrap(new byte[]{1, 2})));
        body.onNext(List.of(ByteBuffer.wrap(new byte[]{3, 4})));
        assertThat(subscription.cancelled).isTrue();
        assertThat(body.getBody().toCompletableFuture()).isCompletedExceptionally();
    }

    @Test
    void completeBodyRetainsAllBytesWithinLimit() throws Exception {
        var body = new JdkWebFetchAdapter.LimitedBody(4);
        var subscription = new Subscription(); body.onSubscribe(subscription);
        body.onNext(List.of(ByteBuffer.wrap(new byte[]{1, 2}), ByteBuffer.wrap(new byte[]{3, 4})));
        body.onComplete();
        assertThat(body.getBody().toCompletableFuture().get()).containsExactly(1, 2, 3, 4);
        assertThat(subscription.cancelled).isFalse();
        assertThat(subscription.requested).isEqualTo(2);
    }
}
