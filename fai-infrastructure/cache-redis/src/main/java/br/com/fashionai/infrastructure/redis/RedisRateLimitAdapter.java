package br.com.fashionai.infrastructure.redis;

import br.com.fashionai.application.ports.RateLimitPort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;

@Component
public class RedisRateLimitAdapter implements RateLimitPort {
    private final StringRedisTemplate redisTemplate;

    public RedisRateLimitAdapter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean tryAcquire(UUID userId, String bucket, int limit, Duration window) {
        String key = "rate:%s:%s".formatted(bucket, userId);
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redisTemplate.expire(key, window);
        }
        return count != null && count <= limit;
    }
}
