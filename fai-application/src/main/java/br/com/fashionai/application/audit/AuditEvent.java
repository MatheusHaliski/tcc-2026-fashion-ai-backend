package br.com.fashionai.application.audit;

import java.time.Instant;
import java.util.Map;

public record AuditEvent(
        String actor,
        String acao,
        String recurso,
        String resultado,
        String ip,
        String userAgent,
        Instant timestamp,
        String correlationId,
        Map<String, Object> metadata
) {
    public AuditEvent {
        timestamp = timestamp == null ? Instant.now() : timestamp;
        metadata = metadata == null ? Map.of() : AuditSanitizer.sanitize(metadata);
    }
}
