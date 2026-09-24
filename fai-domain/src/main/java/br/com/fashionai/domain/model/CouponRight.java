package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Direito promocional (card Trello RF38): o usuário conquistou, usando o app, o direito a um cupom de uma marca ou
 * celebridade (selo com política de promoção do RF25, combinação FLAIR…). PENDENTE → RESGATADO (cupom emitido pela
 * fonte) · DISPENSADO · EXPIRADO.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "coupon_rights")
public class CouponRight extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(name = "source_type", nullable = false, length = 20)
    private String sourceType;

    @Column(name = "source_id", nullable = false, length = 36)
    private UUID sourceId;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(length = 400)
    private String detail;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "scheme_id", length = 36)
    private UUID schemeId;

    @Column(name = "coupon_ref", length = 36)
    private UUID couponRef;

    @Column(name = "decided_at")
    private Instant decidedAt;
}
