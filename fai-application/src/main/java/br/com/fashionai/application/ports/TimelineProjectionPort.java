package br.com.fashionai.application.ports;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Cassandra — timeline por fan-out on write (partition key = dono da timeline, clustering = data DESC).
 * Consistência eventual: o usuário recebe 201 antes do fan-out terminar.
 */
public interface TimelineProjectionPort {
    void appendSchemePublished(UUID ownerUserId, UUID schemeId);

    void fanOut(UUID authorId, Collection<UUID> followerIds, UUID schemeId, Instant publishedAt);

    List<UUID> readTimeline(UUID userId, int limit);

    boolean enabled();
}
