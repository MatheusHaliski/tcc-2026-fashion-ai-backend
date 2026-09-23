package br.com.fashionai.infrastructure.platform.memory;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryAdaptersTest {
    @Test
    void rateLimitCountsWithinTheWindow() {
        InMemoryRateLimit limit = new InMemoryRateLimit();
        UUID user = UUID.randomUUID();
        assertThat(limit.tryAcquire(user, "ai", 2, Duration.ofMinutes(1))).isTrue();
        assertThat(limit.tryAcquire(user, "ai", 2, Duration.ofMinutes(1))).isTrue();
        assertThat(limit.tryAcquire(user, "ai", 2, Duration.ofMinutes(1))).isFalse();
        assertThat(limit.status(user, "ai", 2, Duration.ofMinutes(1)).used()).isEqualTo(3);
        assertThat(limit.status(user, "ai", 2, Duration.ofMinutes(1)).exhausted()).isTrue();
        assertThat(limit.status(UUID.randomUUID(), "ai", 2, Duration.ofMinutes(1)).used()).isZero();
    }

    @Test
    void countersAreIsolatedPerEntity() {
        InMemoryCounterStore counters = new InMemoryCounterStore();
        UUID a = UUID.randomUUID(), b = UUID.randomUUID();
        assertThat(counters.increment("scheme", a, "likes", 1)).isEqualTo(1);
        assertThat(counters.increment("scheme", a, "likes", 2)).isEqualTo(3);
        assertThat(counters.increment("scheme", b, "likes", 1)).isEqualTo(1);
        assertThat(counters.read("scheme", a)).containsEntry("likes", 3L);
        assertThat(counters.read("piece", a)).isEmpty();
    }

    @Test
    void renderCacheHonoursTtl() {
        InMemoryRenderCache cache = new InMemoryRenderCache();
        cache.put("k", "v", Duration.ofMinutes(5));
        assertThat(cache.get("k")).contains("v");
        cache.put("expired", "v", Duration.ofMillis(-1));
        assertThat(cache.get("expired")).isEmpty();
        cache.evict("k");
        assertThat(cache.get("k")).isEmpty();
    }

    @Test
    void jobQueueTracksPendingJobs() {
        InMemoryJobQueue queue = new InMemoryJobQueue();
        queue.enqueue("flatlay-reprocess", UUID.randomUUID());
        assertThat(queue.pending("flatlay-reprocess")).isEqualTo(1);
        assertThat(queue.pending("outra")).isZero();
    }
}
