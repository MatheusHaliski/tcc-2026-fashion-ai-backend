package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ApprovalStatus;
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
@Table(name = "celebrity_profiles")
public class CelebrityProfile extends VersionedAuditableEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(name = "stage_name", nullable = false, length = 160)
    private String stageName;

    @Column(nullable = false, unique = true, length = 160)
    private String slug;

    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "bio_ciphertext", length = 2048)
    private String bio;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private ApprovalStatus verificationStatus = ApprovalStatus.PENDENTE;

    @Column(name = "seal_consent_granted", nullable = false)
    private boolean sealConsentGranted;

    protected CelebrityProfile() {
    }
}
