package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.Visibility;
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

/** Promotion (taxonomia §07, RF20.CA11-CA15 / RF21.CA21-CA23 / RNF12) — promoção resgatável por selo. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "promotions")
public class Promotion extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seal_id")
    private Seal seal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seal_bond_id")
    private SealBond sealBond;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PromotionType type;

    @Column(length = 40, unique = true)
    private String code;

    @Column(length = 512)
    private String description;

    @Column(name = "discount_percent")
    private Integer discountPercent;

    @Column(name = "partner_brand_user_id", length = 36)
    private UUID partnerBrandUserId;

    @Column(name = "campaign_id", length = 36)
    private UUID campaignId;

    @Column(name = "campaign_limit")
    private Integer campaignLimit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PromotionStatus status = PromotionStatus.AVAILABLE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Visibility visibility = Visibility.PUBLIC;

    @Column(name = "owner_user_id", nullable = false, length = 36)
    private UUID ownerUserId;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "redeemed_at")
    private Instant redeemedAt;

    @Column(length = 160)
    private String title;

    @Column(length = 2048)
    private String rules;

    /** BRAND_SEAL ou PREMIUM_SEAL. */
    @Column(name = "required_seal_kind", length = 20)
    private String requiredSealKind;

    @Column(name = "starts_at")
    private java.time.Instant startsAt;

    /** RF20.CA12 — estoque da campanha; null = ilimitado. */
    @Column(name = "total_quota")
    private Integer totalQuota;

    @Column(name = "per_user_limit", nullable = false)
    private int perUserLimit = 1;

    @Column(name = "redeemed_count", nullable = false)
    private int redeemedCount;

    /** Link da loja terceira onde o cupom é usado (sobrepõe o site da marca). */
    @Column(name = "store_url", length = 512)
    private String storeUrl;
}
