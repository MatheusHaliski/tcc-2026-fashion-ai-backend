package br.com.fashionai.application.ports;

import java.util.Map;

/** Barramento de eventos (outbox/fan-out): LookPublished, PieceCreated, InteractionRegistered... */
public interface DomainEventPublisherPort {
    void publish(String eventType, Map<String, Object> payload);
}
