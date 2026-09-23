package br.com.fashionai.infrastructure.cassandra;

import br.com.fashionai.application.ports.NotificationProjectionPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CassandraTimelineProjectionAdapter implements TimelineProjectionPort, NotificationProjectionPort {
    @Override
    public void appendSchemePublished(UUID ownerUserId, UUID schemeId) {
        // Cassandra projection is append-only; implementation will use owner partition and timestamp cursor.
    }

    @Override
    public void appendNotification(UUID recipientUserId, UUID notificationId) {
        // Notification projection mirrors the timeline pattern with TTL configured at table level.
    }
}
