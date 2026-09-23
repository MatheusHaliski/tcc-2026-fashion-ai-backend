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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Perfil empresarial de marca (RF1.CA06-CA07, RF14, RF20). Aprovação depende de administrador;
 * CNPJ e contato comercial ficam cifrados (RNF3). {@link #requiresSealReview} é o CA07 do RF20.
 */
@Getter
@Setter
@NoArgsConstructor
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

    @Column(name = "cover_url", length = 1024)
    private String coverUrl;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "bio_ciphertext", length = 2048)
    private String bio;

    @Column(name = "store_url", length = 1024)
    private String storeUrl;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "cnpj_ciphertext", length = 512)
    private String cnpj;

    @Column(name = "razao_social", length = 200)
    private String razaoSocial;

    @Column(name = "nome_fantasia", length = 200)
    private String nomeFantasia;

    @Column(name = "fashion_category", length = 80)
    private String fashionCategory;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "commercial_contact_ciphertext", length = 1024)
    private String commercialContact;

    @Column(name = "official_hashtag", length = 80)
    private String officialHashtag;

    @Column(name = "activity_proof_url", length = 1024)
    private String activityProofUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false, length = 20)
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDENTE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BrandSource source = BrandSource.USER_SUBMITTED;

    @Column(name = "verification_score", precision = 5, scale = 2)
    private BigDecimal verificationScore;

    @Column(name = "verification_notes", length = 1024)
    private String verificationNotes;

    @Column(name = "approved_by", length = 36)
    private UUID approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "identity_verified", nullable = false)
    private boolean identityVerified;

    @Column(name = "document_verified", nullable = false)
    private boolean documentVerified;

    @Column(name = "requires_seal_review", nullable = false)
    private boolean requiresSealReview;

    @Column(name = "country", length = 2)
    private String country;

    /** RF20 regra 2 — limiar de confiança da sugestão configurável por perfil emissor. */
    @Column(name = "seal_confidence_threshold", nullable = false, precision = 4, scale = 3)
    private java.math.BigDecimal sealConfidenceThreshold = new java.math.BigDecimal("0.600");
}
