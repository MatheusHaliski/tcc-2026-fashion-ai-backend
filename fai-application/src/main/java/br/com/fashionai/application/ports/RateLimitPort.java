package br.com.fashionai.application.ports;

import java.time.Duration;
import java.util.UUID;

public interface RateLimitPort {
    boolean tryAcquire(UUID userId, String bucket, int limit, Duration window);
}
