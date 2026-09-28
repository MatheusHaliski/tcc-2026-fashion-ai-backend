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
    void rateLimitEvictsExpiredWindowsAndStaysBounded() {
        java.util.concurrent.atomic.AtomicReference<java.time.Instant> now = new java.util.concurrent.atomic.AtomicReference<>(java.time.Instant.parse("2026-01-01T00:00:00Z"));
        java.time.Clock clock = new java.time.Clock() {
            public java.time.ZoneId getZone() { return java.time.ZoneOffset.UTC; }
            public java.time.Clock withZone(java.time.ZoneId zone) { return this; }
            public java.time.Instant instant() { return now.get(); }
        };
        InMemoryRateLimit limit = new InMemoryRateLimit(50, clock);
        for (int i = 0; i < 40; i++) {
            limit.tryAcquire(UUID.randomUUID(), "ip:login", 5, Duration.ofMinutes(1));
        }
        now.set(now.get().plus(Duration.ofMinutes(2)));
        limit.sweep(now.get());
        assertThat(limit.size()).isZero();
        for (int i = 0; i < 500; i++) {
            limit.tryAcquire(UUID.randomUUID(), "ip:login", 5, Duration.ofMinutes(1));
            assertThat(limit.size()).isLessThanOrEqualTo(50);
        }
    }

    @Test
    void rateLimitResetClearsTheBucket() {
        InMemoryRateLimit limit = new InMemoryRateLimit();
        UUID user = UUID.randomUUID();
        for (int i = 0; i < 5; i++) {
            limit.tryAcquire(user, "login-fail", 5, Duration.ofMinutes(15));
        }
        assertThat(limit.status(user, "login-fail", 5, Duration.ofMinutes(15)).exhausted()).isTrue();
        limit.reset(user, "login-fail");
        assertThat(limit.status(user, "login-fail", 5, Duration.ofMinutes(15)).used()).isZero();
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
