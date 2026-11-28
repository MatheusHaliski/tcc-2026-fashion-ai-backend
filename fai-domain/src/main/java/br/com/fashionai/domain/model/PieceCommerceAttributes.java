package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@MappedSuperclass
public abstract class PieceCommerceAttributes extends VersionedAuditableEntity {
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "negotiation_id")
    private UUID negotiationId;

    @Column(name = "negotiation_started_at")
    private Instant negotiationStartedAt;

    @Column(name = "try_on_count", nullable = false)
    private long tryOnCount;

    @Column(name = "view_count", nullable = false)
    private long viewCount;

    @Column(name = "sales_count")
    private Long salesCount;
}
