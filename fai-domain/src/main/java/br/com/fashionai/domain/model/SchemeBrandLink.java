package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.BrandLinkStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "scheme_brand_links")
public class SchemeBrandLink extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private Scheme scheme;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_profile_id")
    private BrandProfile brandProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "celebrity_profile_id")
    private CelebrityProfile celebrityProfile;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requested_by_user_id", nullable = false)
    private User requestedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BrandLinkStatus status = BrandLinkStatus.PENDENTE;

    @Column(nullable = false, length = 40)
    private String tier;

    @Column(precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(length = 1024)
    private String reason;

    @Column(name = "decided_at")
    private Instant decidedAt;

    protected SchemeBrandLink() {
    }
}
