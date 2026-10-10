package br.com.fashionai.infrastructure.redis;

import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.ports.JobQueuePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.ports.RenderCachePort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Adaptadores Redis (ligados com {@code fashionai.redis.enabled=true}): cotas de IA, contadores ao vivo,
 * cache de renderizações e fila de jobs. Chaves prefixadas por finalidade; TTL sempre explícito.
 */
@Configuration
@ConditionalOnProperty(name = "fashionai.redis.enabled", havingValue = "true")
public class RedisAdapters {
    /** Devolve uma unidade do balde sem recriá-lo nem tirar o TTL (chave ausente ou zerada fica como está). */
    static final RedisScript<Long> RELEASE = RedisScript.of(
            "local v = tonumber(redis.call('GET', KEYS[1]) or '0') if v > 0 then return redis.call('DECR', KEYS[1]) end return 0",
            Long.class);

    @Bean
    RateLimitPort redisRateLimit(StringRedisTemplate redis) {
        return new RateLimitPort() {
            private String key(UUID userId, String bucket) {
                return "rate:" + bucket + ":" + userId;
            }

            @Override
            public boolean tryAcquire(UUID userId, String bucket, int limit, Duration window) {
                String key = key(userId, bucket);
                Long count = redis.opsForValue().increment(key);
                // o TTL também é reposto se a chave ficou sem expiração (queda entre o INCR e o EXPIRE): senão o balde
                // nunca zeraria e a conta/IP ficaria bloqueada para sempre
                if (count != null && (count == 1L || Long.valueOf(-1L).equals(redis.getExpire(key)))) {
                    redis.expire(key, window);
                }
                return count != null && count <= limit;
            }

            @Override
            public void reset(UUID userId, String bucket) {
                redis.delete(key(userId, bucket));
            }

            @Override
            public void release(UUID userId, String bucket) {
                // DECR só se a chave existe e está acima de zero: um script, para não recriar a chave sem TTL
                redis.execute(RELEASE, List.of(key(userId, bucket)));
            }

            @Override
            public QuotaStatus status(UUID userId, String bucket, int limit, Duration window) {
                String key = key(userId, bucket);
                String raw = redis.opsForValue().get(key);
                long used = raw == null ? 0 : Long.parseLong(raw);
                Long ttl = redis.getExpire(key, TimeUnit.SECONDS);
                Instant reset = ttl == null || ttl < 0 ? Instant.now().plus(window) : Instant.now().plusSeconds(ttl);
                return new QuotaStatus(limit, used, reset);
            }
        };
    }

    @Bean
    CounterStorePort redisCounterStore(StringRedisTemplate redis) {
        return new CounterStorePort() {
            private String key(String entityType, UUID entityId) {
                return "counter:" + entityType + ":" + entityId;
            }

            @Override
            public long increment(String entityType, UUID entityId, String field, long delta) {
                Long v = redis.opsForHash().increment(key(entityType, entityId), field, delta);
                return v == null ? 0 : v;
            }

            @Override
            public Map<String, Long> read(String entityType, UUID entityId) {
                Map<Object, Object> raw = redis.opsForHash().entries(key(entityType, entityId));
                Map<String, Long> out = new LinkedHashMap<>();
                raw.forEach((k, v) -> out.put(String.valueOf(k), Long.parseLong(String.valueOf(v))));
                return out;
            }
        };
    }

    @Bean
    RenderCachePort redisRenderCache(StringRedisTemplate redis) {
        return new RenderCachePort() {
            @Override
            public Optional<String> get(String key) {
                return Optional.ofNullable(redis.opsForValue().get("render:" + key));
            }

            @Override
            public void put(String key, String value, Duration ttl) {
                redis.opsForValue().set("render:" + key, value, ttl == null ? Duration.ofMinutes(10) : ttl);
            }

            @Override
            public void evict(String key) {
                redis.delete("render:" + key);
            }
        };
    }

    @Bean
    JobQueuePort redisJobQueue(StringRedisTemplate redis) {
        return (stream, jobId) -> redis.opsForList().rightPush("jobs:" + stream, jobId.toString());
    }
}
