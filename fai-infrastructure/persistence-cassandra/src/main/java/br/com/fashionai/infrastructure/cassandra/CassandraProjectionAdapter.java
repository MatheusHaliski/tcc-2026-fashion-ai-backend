package br.com.fashionai.infrastructure.cassandra;

import br.com.fashionai.application.ports.NotificationProjectionPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.BatchableStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Projeções append-only no Cassandra (ligadas com {@code fashionai.cassandra.enabled=true}):
 * timeline por usuário (fan-out na publicação, partição = seguidor, ordenada por data) e notificações,
 * ambas com TTL de tabela (expiração automática — não há DELETE em massa). A única remoção é a partição inteira de uma
 * conta de teste no reset do Demo/Test Data Pipeline ({@link #purgeUser}).
 */
@Component
@ConditionalOnProperty(name = "fashionai.cassandra.enabled", havingValue = "true")
public class CassandraProjectionAdapter implements TimelineProjectionPort, NotificationProjectionPort {
    private static final Logger log = LoggerFactory.getLogger(CassandraProjectionAdapter.class);
    private final CqlSession session;
    private final PreparedStatement insertTimeline;
    private final PreparedStatement readTimeline;
    private final PreparedStatement insertNotification;
    private final PreparedStatement deleteTimeline;
    private final PreparedStatement deleteNotifications;

    public CassandraProjectionAdapter(CqlSession session,
                                      @Value("${fashionai.cassandra.timeline-ttl-days:90}") int timelineTtlDays,
                                      @Value("${fashionai.cassandra.notification-ttl-days:30}") int notificationTtlDays) {
        this.session = session;
        session.execute("CREATE TABLE IF NOT EXISTS timeline_by_user (user_id uuid, published_at timestamp, scheme_id uuid, "
                + "author_id uuid, PRIMARY KEY (user_id, published_at, scheme_id)) "
                + "WITH CLUSTERING ORDER BY (published_at DESC, scheme_id ASC) AND default_time_to_live = " + timelineTtlDays * 86400);
        session.execute("CREATE TABLE IF NOT EXISTS notifications_by_user (user_id uuid, created_at timestamp, notification_id uuid, "
                + "PRIMARY KEY (user_id, created_at, notification_id)) "
                + "WITH CLUSTERING ORDER BY (created_at DESC, notification_id ASC) AND default_time_to_live = " + notificationTtlDays * 86400);
        this.insertTimeline = session.prepare("INSERT INTO timeline_by_user (user_id, published_at, scheme_id, author_id) VALUES (?, ?, ?, ?)");
        this.readTimeline = session.prepare("SELECT scheme_id FROM timeline_by_user WHERE user_id = ? LIMIT ?");
        this.insertNotification = session.prepare("INSERT INTO notifications_by_user (user_id, created_at, notification_id) VALUES (?, ?, ?)");
        this.deleteTimeline = session.prepare("DELETE FROM timeline_by_user WHERE user_id = ?");
        this.deleteNotifications = session.prepare("DELETE FROM notifications_by_user WHERE user_id = ?");
        log.info("Projeções Cassandra prontas (timeline TTL {} dias, notificações TTL {} dias)", timelineTtlDays, notificationTtlDays);
    }

    @Override
    public void appendSchemePublished(UUID ownerUserId, UUID schemeId) {
        session.execute(insertTimeline.bind(ownerUserId, Instant.now(), schemeId, ownerUserId));
    }

    @Override
    public void fanOut(UUID authorId, Collection<UUID> followerIds, UUID schemeId, Instant publishedAt) {
        List<BatchableStatement<?>> batch = new ArrayList<>();
        for (UUID follower : followerIds) {
            batch.add(insertTimeline.bind(follower, publishedAt, schemeId, authorId));
            if (batch.size() == 50) {
                session.execute(BatchStatement.newInstance(BatchType.UNLOGGED, batch));
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            session.execute(BatchStatement.newInstance(BatchType.UNLOGGED, batch));
        }
    }

    @Override
    public List<UUID> readTimeline(UUID userId, int limit) {
        List<UUID> ids = new ArrayList<>();
        for (Row row : session.execute(readTimeline.bind(userId, limit))) {
            ids.add(row.getUuid("scheme_id"));
        }
        return ids;
    }

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public void appendNotification(UUID recipientUserId, UUID notificationId) {
        session.execute(insertNotification.bind(recipientUserId, Instant.now(), notificationId));
    }

    /** Uma chamada atende às duas portas: apaga a timeline e a caixa de notificações da conta (partições inteiras). */
    @Override
    public void purgeUser(UUID userId) {
        session.execute(deleteTimeline.bind(userId));
        session.execute(deleteNotifications.bind(userId));
    }
}
