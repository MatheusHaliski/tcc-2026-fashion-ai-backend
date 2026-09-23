package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ModerationQueueStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** RN11 / RF24 funil de moderação — item roteado à fila humana ("fail-to-queue para decisão"). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "moderation_queue")
public class ModerationQueueItem extends VersionedAuditableEntity {
    @Column(name = "target_type", nullable = false, length = 30)
    private String targetType;

    @Column(name = "target_id", length = 36)
    private UUID targetId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "content_excerpt", length = 512)
    private String contentExcerpt;

    @Column(name = "categories_json", columnDefinition = "json")
    private String categoriesJson;

    @Column(precision = 5, scale = 4)
    private BigDecimal confidence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ModerationQueueStatus status = ModerationQueueStatus.PENDING_REVIEW;

    @Column(name = "reviewed_by", length = 36)
    private UUID reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(length = 512)
    private String reason;
}
