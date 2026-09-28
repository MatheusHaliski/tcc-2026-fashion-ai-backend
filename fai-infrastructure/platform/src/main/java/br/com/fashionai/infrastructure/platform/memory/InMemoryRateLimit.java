package br.com.fashionai.infrastructure.platform.memory;

import br.com.fashionai.application.ports.RateLimitPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Cotas por usuário em memória (janela fixa). Vale para uma instância; com Redis ligado o adaptador Redis assume.
 * Janelas vencidas são varridas periodicamente e o mapa tem teto: sem isso, cada IP ou conta nova (o limite por IP
 * da autenticação cria um balde por endereço) ficaria para sempre na memória.
 */
@Component
@ConditionalOnProperty(name = "fashionai.redis.enabled", havingValue = "false", matchIfMissing = true)
public class InMemoryRateLimit implements RateLimitPort {
    static final int DEFAULT_MAX_ENTRIES = 100_000;
    /** A cada tantas operações, remove as janelas vencidas. */
    static final int SWEEP_EVERY = 1_000;

    private record Window(long count, Instant resetAt) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicInteger operations = new AtomicInteger();
    private final int maxEntries;
    private final Clock clock;

    public InMemoryRateLimit() {
        this(DEFAULT_MAX_ENTRIES, Clock.systemUTC());
    }

    InMemoryRateLimit(int maxEntries, Clock clock) {
        this.maxEntries = maxEntries;
        this.clock = clock;
    }

    private static String key(UUID userId, String bucket) {
        return bucket + ":" + userId;
    }

    @Override
    public boolean tryAcquire(UUID userId, String bucket, int limit, Duration window) {
        Instant now = clock.instant();
        String key = key(userId, bucket);
        if (!windows.containsKey(key)) {
            makeRoom(now);
        } else if (operations.incrementAndGet() % SWEEP_EVERY == 0) {
            sweep(now);
        }
        Window w = windows.compute(key, (k, old) -> {
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
        Instant now = clock.instant();
        if (w == null || !w.resetAt.isAfter(now)) {
            return new QuotaStatus(limit, 0, now.plus(window));
        }
        return new QuotaStatus(limit, w.count, w.resetAt);
    }

    @Override
    public void reset(UUID userId, String bucket) {
        windows.remove(key(userId, bucket));
    }

    int size() {
        return windows.size();
    }

    /** Antes de abrir um balde novo: varre vencidos e, se ainda estiver cheio, descarta os que vencem primeiro. */
    private void makeRoom(Instant now) {
        if (operations.incrementAndGet() % SWEEP_EVERY == 0 || windows.size() >= maxEntries) {
            sweep(now);
        }
        int excess = windows.size() - maxEntries + 1;
        if (excess > 0) {
            // teto atingido só com janelas vivas: sai o que venceria antes (perde menos informação de bloqueio)
            windows.entrySet().stream()
                    .sorted(Comparator.comparing(e -> e.getValue().resetAt()))
                    .limit(Math.max(excess, maxEntries / 10))
                    .map(Map.Entry::getKey)
                    .toList()
                    .forEach(windows::remove);
        }
    }

    void sweep(Instant now) {
        windows.entrySet().removeIf(e -> !e.getValue().resetAt().isAfter(now));
    }
}
