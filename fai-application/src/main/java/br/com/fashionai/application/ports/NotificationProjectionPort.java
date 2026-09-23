package br.com.fashionai.application.ports;

import java.util.UUID;

public interface NotificationProjectionPort {
    void appendNotification(UUID recipientUserId, UUID notificationId);
}
