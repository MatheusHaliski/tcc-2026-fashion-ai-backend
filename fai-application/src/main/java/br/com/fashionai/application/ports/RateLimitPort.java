package br.com.fashionai.application.ports;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Redis — rate limit por usuário e por capacidade de IA (RF24.CA14) e por ação sensível (RF3.CA11). */
public interface RateLimitPort {
    boolean tryAcquire(UUID userId, String bucket, int limit, Duration window);

    QuotaStatus status(UUID userId, String bucket, int limit, Duration window);

    /** Zera o balde (ex.: falhas de login depois de um login bem-sucedido). */
    default void reset(UUID userId, String bucket) {
    }

    record QuotaStatus(int limit, long used, Instant resetAt) {
        public boolean exhausted() {
            return used >= limit;
        }
    }
}
