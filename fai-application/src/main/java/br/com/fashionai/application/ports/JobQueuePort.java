package br.com.fashionai.application.ports;

import java.util.UUID;

/** Fila de jobs assíncronos (Redis Streams em dev; SQS/RabbitMQ em produção) — estado canônico no MySQL. */
public interface JobQueuePort {
    void enqueue(String stream, UUID jobId);
}
