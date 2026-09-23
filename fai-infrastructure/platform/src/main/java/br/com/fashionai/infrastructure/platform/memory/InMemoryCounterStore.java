package br.com.fashionai.infrastructure.platform.memory;

import br.com.fashionai.application.ports.CounterStorePort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Contadores "ao vivo" (curtidas, views, remixes) em memória; os totais persistidos ficam no MySQL. */
@Component
@ConditionalOnProperty(name = "fashionai.redis.enabled", havingValue = "false", matchIfMissing = true)
public class InMemoryCounterStore implements CounterStorePort {
    private final Map<String, Map<String, AtomicLong>> counters = new ConcurrentHashMap<>();

    private static String key(String entityType, UUID entityId) {
        return entityType + ":" + entityId;
    }

    @Override
    public long increment(String entityType, UUID entityId, String field, long delta) {
        return counters.computeIfAbsent(key(entityType, entityId), k -> new ConcurrentHashMap<>())
                .computeIfAbsent(field, f -> new AtomicLong()).addAndGet(delta);
    }

    @Override
    public Map<String, Long> read(String entityType, UUID entityId) {
        Map<String, AtomicLong> m = counters.get(key(entityType, entityId));
        if (m == null) {
            return Map.of();
        }
        Map<String, Long> out = new ConcurrentHashMap<>();
        m.forEach((k, v) -> out.put(k, v.get()));
        return out;
    }
}
