package br.com.fashionai.infrastructure.mysql;

import br.com.fashionai.application.security.RequestActor;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import java.util.Optional;

/** MySQL = fonte da verdade (arquitetura-persistencia-poliglota.md). Repositórios e entidades vivem no fai-domain. */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "fashionAuditorAware")
@EnableTransactionManagement
@EnableJpaRepositories(basePackages = "br.com.fashionai.domain.repository")
@EntityScan(basePackages = "br.com.fashionai.domain.model")
public class MysqlPersistenceConfig {
    @Bean
    AuditorAware<String> fashionAuditorAware() {
        return () -> Optional.of(RequestActor.current());
    }
}
