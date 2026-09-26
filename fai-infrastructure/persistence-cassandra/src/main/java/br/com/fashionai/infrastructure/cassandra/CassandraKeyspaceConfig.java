package br.com.fashionai.infrastructure.cassandra;

import com.datastax.oss.driver.api.core.CqlIdentifier;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.CqlSessionBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Cassandra próprio (contêiner no Railway, Docker): o driver não abre sessão num keyspace inexistente, então com
 * CASSANDRA_CREATE_KEYSPACE=true a API cria o keyspace antes de abrir a sessão da aplicação. Desligado por padrão:
 * no Astra (sem CREATE KEYSPACE por CQL) e em provedores sem essa permissão o keyspace vem do painel.
 */
@Configuration
@ConditionalOnProperty(name = {"fashionai.cassandra.enabled", "fashionai.cassandra.create-keyspace"}, havingValue = "true")
public class CassandraKeyspaceConfig {
    private static final Logger log = LoggerFactory.getLogger(CassandraKeyspaceConfig.class);

    @Bean
    CqlSession cassandraSession(ObjectProvider<CqlSessionBuilder> builders,
                                @Value("${spring.cassandra.keyspace-name:fashionai_feed}") String keyspace,
                                @Value("${fashionai.cassandra.replication-factor:1}") int replicationFactor) {
        String name = CqlIdentifier.fromInternal(keyspace).asCql(true);
        try (CqlSession admin = builders.getObject().withKeyspace((CqlIdentifier) null).build()) {
            admin.execute("CREATE KEYSPACE IF NOT EXISTS " + name
                    + " WITH replication = {'class': 'SimpleStrategy', 'replication_factor': " + replicationFactor + "}");
        }
        log.info("Cassandra: keyspace {} garantido (replication_factor {})", name, replicationFactor);
        return builders.getObject().build();
    }
}
