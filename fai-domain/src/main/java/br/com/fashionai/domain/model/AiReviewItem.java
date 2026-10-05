package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.AiReviewDecision;
import br.com.fashionai.domain.model.enums.AiReviewKind;
import br.com.fashionai.domain.model.enums.AiReviewStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Revisão de IA: AI decision · user correction · admin decision · final value (alimenta o active learning). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "ai_review_items")
public class AiReviewItem extends VersionedAuditableEntity {
    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20)
    private AiReviewKind kind;

    /** PIECE (peça de uma pessoa) · CATALOG_PRODUCT (produto do catálogo, sem dona — V45). */
    @Column(name = "target_type", nullable = false, length = 20)
    private String targetType = "PIECE";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private AiReviewStatus status;

    @Column(name = "session_id", length = 36)
    private UUID sessionId;

    @Column(name = "piece_id", length = 36)
    private UUID pieceId;

    @Column(name = "product_id", length = 36)
    private UUID productId;

    @Column(name = "image_id", length = 36)
    private UUID imageId;

    /** Dona da peça; null para item de produto do catálogo. */
    @Column(name = "user_id", length = 36)
    private UUID userId;

    @Column(name = "field", nullable = false, length = 40)
    private String field;

    @Column(name = "ai_value", length = 160)
    private String aiValue;

    @Column(name = "ai_confidence", precision = 5, scale = 4)
    private BigDecimal aiConfidence;

    @Column(name = "ai_model", length = 120)
    private String aiModel;

    @Column(name = "user_value", length = 160)
    private String userValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_decision", length = 20)
    private AiReviewDecision adminDecision;

    @Column(name = "admin_value", length = 160)
    private String adminValue;

    @Column(name = "final_value", length = 160)
    private String finalValue;

    @Column(name = "reviewer_id", length = 36)
    private UUID reviewerId;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "add_to_training", nullable = false)
    private boolean addToTraining;

    @Column(name = "hard_example_tags", length = 512)
    private String hardExampleTags;
}
