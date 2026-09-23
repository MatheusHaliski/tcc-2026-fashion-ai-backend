package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.SealBondOrigin;
import br.com.fashionai.domain.model.enums.SealBondBasis;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
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

import java.math.BigDecimal;
import java.time.Instant;

/**
 * SealBond (taxonomia §07, RF20/RF21) — vínculo esquema × marca/celebridade, da sugestão da IA até a
 * emissão do selo: SUGGESTED → ACCEPTED/EDITED/REFUSED → PENDING_REVIEW → APPROVED/REJECTED.
 * Mudança de estado gera auditoria obrigatória (RNF5, CA16).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "seal_bonds")
public class SealBond extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private Scheme scheme;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_owner_user_id", nullable = false)
    private User targetOwner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requested_by_user_id", nullable = false)
    private User requestedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private SealTier tier;

    @Column(name = "linked_piece_ids_json", columnDefinition = "json")
    private String linkedPieceIdsJson;

    @Column(precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(length = 1024)
    private String justification;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SealBondBasis basis = SealBondBasis.BRAND_MATCH;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SealBondStatus status = SealBondStatus.SUGGESTED;

    @Column(name = "requires_review", nullable = false)
    private boolean requiresReview;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seal_id")
    private Seal seal;

    @Column(name = "image_rights_consent")
    private Boolean imageRightsConsent;

    @Column(name = "ai_inference_id", length = 36)
    private java.util.UUID aiInferenceId;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "review_note", length = 1024)
    private String reviewNote;

    /** RF20.CA16 — origem do vínculo: sugestão da IA ou escolha manual. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SealBondOrigin origin = SealBondOrigin.AI_SUGGESTION;

    /** RF20.CA08 — identificador único e rastreável do selo emitido. */
    @Column(name = "seal_code", length = 40, unique = true)
    private String sealCode;

    @Column(name = "issued_at")
    private java.time.Instant issuedAt;

    @Column(name = "expires_at")
    private java.time.Instant expiresAt;

    @Column(name = "reviewed_by", length = 36)
    private java.util.UUID reviewedBy;

    /** RF21.CA20 — era do look consagrado exibida no Selo Premium. */
    @Column(name = "era_label", length = 80)
    private String eraLabel;
}
