package br.com.fashionai.infrastructure.platform.memory;

import br.com.fashionai.application.ports.RenderCachePort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Cache de renderizações (cards, painéis) com TTL em memória. */
@Component
@ConditionalOnProperty(name = "fashionai.redis.enabled", havingValue = "false", matchIfMissing = true)
public class InMemoryRenderCache implements RenderCachePort {
    private record Entry(String value, Instant expiresAt) {
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    @Override
    public Optional<String> get(String key) {
        Entry e = entries.get(key);
        if (e == null) {
            return Optional.empty();
        }
        if (!e.expiresAt.isAfter(Instant.now())) {
            entries.remove(key);
            return Optional.empty();
        }
        return Optional.of(e.value);
    }

    @Override
    public void put(String key, String value, Duration ttl) {
        entries.put(key, new Entry(value, Instant.now().plus(ttl == null ? Duration.ofMinutes(10) : ttl)));
    }

    @Override
    public void evict(String key) {
        entries.remove(key);
    }

    @Scheduled(fixedDelay = 300_000)
    void sweep() {
        Instant now = Instant.now();
        entries.entrySet().removeIf(e -> !e.getValue().expiresAt.isAfter(now));
    }
}
