package br.com.fashionai.infrastructure.ai;

import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.AiResponse;
import br.com.fashionai.application.ai.AiProviderPort;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.application.audit.AuditService;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Component
public class ResilientAiProviderAdapter implements AiProviderPort {
    private final AuditService auditService;

    public ResilientAiProviderAdapter(AuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public AiResponse invoke(AiRequest request) {
        return invokeAsync(request).join();
    }

    @Retry(name = "aiProvider")
    @CircuitBreaker(name = "aiProvider")
    @RateLimiter(name = "aiProvider")
    @TimeLimiter(name = "aiProvider")
    public CompletableFuture<AiResponse> invokeAsync(AiRequest request) {
        Instant started = Instant.now();
        return CompletableFuture.supplyAsync(() -> {
            Duration latency = Duration.between(started, Instant.now());
            AiResponse response = new AiResponse(
                    request.provider(),
                    request.model(),
                    latency,
                    BigDecimal.ZERO,
                    Map.of("status", "ADAPTER_BOUNDARY_READY", "capability", request.capability().name())
            );
            auditService.record(new AuditEvent(
                    request.userId() == null ? "system" : request.userId().toString(),
                    AuditActions.CHAMADA_IA,
                    request.capability().name(),
                    "SUCESSO",
                    null,
                    null,
                    Instant.now(),
                    UUID.randomUUID().toString(),
                    Map.of(
                            "provider", request.provider(),
                            "model", request.model(),
                            "latencyMs", latency.toMillis(),
                            "estimatedCostUsd", response.estimatedCostUsd()
                    )
            ));
            return response;
        });
    }
}
