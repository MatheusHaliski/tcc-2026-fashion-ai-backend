package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.NotificationCategory;
import br.com.fashionai.domain.model.enums.NotificationType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * RNF10 — notificação in-app (sino do topbar). Fonte de verdade no MySQL; a projeção de entrega em
 * escala (inbox por destinatário, TTL de 90 dias — RF3.CA37) vive no Cassandra.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notifications")
public class Notification extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_user_id", nullable = false)
    private User recipient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private NotificationType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationCategory category;

    @Column(name = "resource_type", length = 30)
    private String resourceType;

    @Column(name = "resource_id", length = 36)
    private UUID resourceId;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(length = 500)
    private String body;

    @Column(name = "payload_json", columnDefinition = "json")
    private String payloadJson;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    @Column(name = "read_at")
    private Instant readAt;

    /** Contabilizada mas não entregue quando o tipo está desativado (RF19.CA19). */
    @Column(name = "delivered", nullable = false)
    private boolean delivered = true;
}
