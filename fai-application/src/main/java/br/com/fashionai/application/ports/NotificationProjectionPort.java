package br.com.fashionai.application.ports;

import java.util.UUID;

/** Cassandra — inbox de notificações por destinatário, com TTL de 90 dias (RF3.CA37). */
public interface NotificationProjectionPort {
    void appendNotification(UUID recipientUserId, UUID notificationId);
}
