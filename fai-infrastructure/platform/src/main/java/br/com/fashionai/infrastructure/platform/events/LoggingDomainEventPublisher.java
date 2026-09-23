package br.com.fashionai.infrastructure.platform.events;

import br.com.fashionai.application.ports.DomainEventPublisherPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Eventos de domínio para integrações externas (webhooks, mensageria): por enquanto só o log estruturado. */
@Component
public class LoggingDomainEventPublisher implements DomainEventPublisherPort {
    private static final Logger log = LoggerFactory.getLogger(LoggingDomainEventPublisher.class);

    @Override
    public void publish(String eventType, Map<String, Object> payload) {
        log.info("evento {} {}", eventType, payload);
    }
}
