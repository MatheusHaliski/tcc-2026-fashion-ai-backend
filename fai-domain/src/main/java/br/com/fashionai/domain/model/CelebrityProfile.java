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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Perfil de celebridade (RF1.CA09-CA10, RF21, RF22). Só celebridades verificadas entram no pool de
 * sugestão de vínculo (RF21.CA18). A assinatura de estilo (CA17) guarda paleta/arquétipo/estilos —
 * atmosfera, nunca retrato (RF6.CA19 / direito de imagem).
 */
@Getter
@Setter
@NoArgsConstructor
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

    @Column(name = "cover_url", length = 1024)
    private String coverUrl;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "bio_ciphertext", length = 2048)
    private String bio;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "real_name_ciphertext", length = 1024)
    private String realName;

    @Column(name = "areas_json", columnDefinition = "json")
    private String areasJson;

    @Column(name = "verifiable_followers_json", columnDefinition = "json")
    private String verifiableFollowersJson;

    @Column(name = "identity_proof_url", length = 1024)
    private String identityProofUrl;

    @Column(name = "verification_url", length = 1024)
    private String verificationUrl;

    @Column(name = "professional_history", length = 2048)
    private String professionalHistory;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "representation_contact_ciphertext", length = 1024)
    private String representationContact;

    @Column(name = "fashion_interests_json", columnDefinition = "json")
    private String fashionInterestsJson;

    @Column(name = "style_signature_json", columnDefinition = "json")
    private String styleSignatureJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private ApprovalStatus verificationStatus = ApprovalStatus.PENDENTE;

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

    @Column(name = "seal_consent_granted", nullable = false)
    private boolean sealConsentGranted;

    @Column(name = "requires_seal_review", nullable = false)
    private boolean requiresSealReview;

    /** RF20 regra 2 — limiar de confiança da sugestão configurável por perfil emissor. */
    @Column(name = "seal_confidence_threshold", nullable = false, precision = 4, scale = 3)
    private java.math.BigDecimal sealConfidenceThreshold = new java.math.BigDecimal("0.600");
}
