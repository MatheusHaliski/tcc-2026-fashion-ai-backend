package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "brand_profiles")
public class BrandProfile extends VersionedAuditableEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(name = "brand_name", nullable = false, length = 160)
    private String brandName;

    @Column(nullable = false, unique = true, length = 160)
    private String slug;

    @Column(name = "logo_url", length = 1024)
    private String logoUrl;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "bio_ciphertext", length = 2048)
    private String bio;

    @Column(name = "store_url", length = 1024)
    private String storeUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false, length = 20)
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDENTE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BrandSource source = BrandSource.USER_SUBMITTED;

    protected BrandProfile() {
    }
}
