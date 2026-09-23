package br.com.fashionai.infrastructure.platform.memory;

import br.com.fashionai.application.ports.RateLimitPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Cotas por usuário em memória (janela fixa). Vale para uma instância; com Redis ligado o adaptador Redis assume. */
@Component
@ConditionalOnProperty(name = "fashionai.redis.enabled", havingValue = "false", matchIfMissing = true)
public class InMemoryRateLimit implements RateLimitPort {
    private record Window(long count, Instant resetAt) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private static String key(UUID userId, String bucket) {
        return bucket + ":" + userId;
    }

    @Override
    public boolean tryAcquire(UUID userId, String bucket, int limit, Duration window) {
        Instant now = Instant.now();
        Window w = windows.compute(key(userId, bucket), (k, old) -> {
            if (old == null || !old.resetAt.isAfter(now)) {
                return new Window(1, now.plus(window));
            }
            return new Window(old.count + 1, old.resetAt);
        });
        return w.count <= limit;
    }

    @Override
    public QuotaStatus status(UUID userId, String bucket, int limit, Duration window) {
        Window w = windows.get(key(userId, bucket));
        Instant now = Instant.now();
        if (w == null || !w.resetAt.isAfter(now)) {
            return new QuotaStatus(limit, 0, now.plus(window));
        }
        return new QuotaStatus(limit, w.count, w.resetAt);
    }
}
