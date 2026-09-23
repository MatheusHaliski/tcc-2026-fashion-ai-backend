package br.com.fashionai.infrastructure.platform.memory;

import br.com.fashionai.application.ports.NotificationProjectionPort;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Projeções desligadas: com Cassandra/OpenSearch ausentes, {@code enabled()} devolve false e os serviços
 * usam as consultas equivalentes no MySQL (feed por seguidos, busca por LIKE/FULLTEXT).
 */
@Configuration
public class NoopProjections {
    @Bean
    @ConditionalOnProperty(name = "fashionai.cassandra.enabled", havingValue = "false", matchIfMissing = true)
    TimelineProjectionPort disabledTimeline() {
        return new TimelineProjectionPort() {
            @Override
            public void appendSchemePublished(UUID ownerUserId, UUID schemeId) {
            }

            @Override
            public void fanOut(UUID authorId, Collection<UUID> followerIds, UUID schemeId, Instant publishedAt) {
            }

            @Override
            public List<UUID> readTimeline(UUID userId, int limit) {
                return List.of();
            }

            @Override
            public boolean enabled() {
                return false;
            }
        };
    }

    @Bean
    @ConditionalOnProperty(name = "fashionai.cassandra.enabled", havingValue = "false", matchIfMissing = true)
    NotificationProjectionPort disabledNotificationProjection() {
        return (recipientUserId, notificationId) -> {
        };
    }

    @Bean
    @ConditionalOnProperty(name = "fashionai.opensearch.enabled", havingValue = "false", matchIfMissing = true)
    SearchIndexPort disabledSearchIndex() {
        return new SearchIndexPort() {
            @Override
            public void index(String indexName, UUID id, Map<String, Object> document) {
            }

            @Override
            public void remove(String indexName, UUID id) {
            }

            @Override
            public List<UUID> search(String indexName, String term, Map<String, String> filters, int limit) {
                return List.of();
            }

            @Override
            public boolean enabled() {
                return false;
            }
        };
    }
}
