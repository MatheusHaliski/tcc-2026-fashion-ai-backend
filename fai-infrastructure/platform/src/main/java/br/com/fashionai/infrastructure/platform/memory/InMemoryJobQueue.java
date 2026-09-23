package br.com.fashionai.infrastructure.platform.memory;

import br.com.fashionai.application.ports.JobQueuePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Fila de jobs em memória. Os jobs já ficam persistidos em pipeline_jobs (MySQL) e são retomados pelos
 * agendadores ({@code reprocessPending}); a fila só sinaliza que há trabalho novo.
 */
@Component
@ConditionalOnProperty(name = "fashionai.redis.enabled", havingValue = "false", matchIfMissing = true)
public class InMemoryJobQueue implements JobQueuePort {
    private static final Logger log = LoggerFactory.getLogger(InMemoryJobQueue.class);
    private final Map<String, ConcurrentLinkedQueue<UUID>> streams = new ConcurrentHashMap<>();

    @Override
    public void enqueue(String stream, UUID jobId) {
        streams.computeIfAbsent(stream, s -> new ConcurrentLinkedQueue<>()).add(jobId);
        log.debug("job {} enfileirado em {}", jobId, stream);
    }

    public int pending(String stream) {
        ConcurrentLinkedQueue<UUID> q = streams.get(stream);
        return q == null ? 0 : q.size();
    }
}
