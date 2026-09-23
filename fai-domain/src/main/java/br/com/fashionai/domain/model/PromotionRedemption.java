package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.RedemptionStatus;
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
 * RF20.CA12 / RF21.CA22 — resgate de promoção: código único de uso único, emissor e (quando houver) marca
 * parceira executora; cupons resgatados sobrevivem à revogação do selo até a própria validade (CA14).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "promotion_redemptions")
public class PromotionRedemption extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "promotion_id", nullable = false)
    private Promotion promotion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seal_bond_id", nullable = false)
    private SealBond sealBond;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(name = "issuer_user_id", nullable = false, length = 36)
    private UUID issuerUserId;

    @Column(name = "partner_brand_user_id", length = 36)
    private UUID partnerBrandUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RedemptionStatus status = RedemptionStatus.ISSUED;

    @Column(name = "redeemed_at", nullable = false)
    private Instant redeemedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;
}
