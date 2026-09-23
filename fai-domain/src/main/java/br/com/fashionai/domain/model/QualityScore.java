package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** RFC RF4 — QualityScore: métricas por etapa do Flat Lay, aceite e recomendações de reenvio. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "quality_scores")
public class QualityScore extends AuditableEntity {
    @Column(name = "wardrobe_item_id", length = 36)
    private UUID wardrobeItemId;

    @Column(name = "pipeline_job_id", nullable = false, length = 36)
    private UUID pipelineJobId;

    @Column(name = "metrics_json", columnDefinition = "json")
    private String metricsJson;

    @Column(name = "overall", nullable = false, precision = 5, scale = 4)
    private BigDecimal overall;

    @Column(name = "accepted", nullable = false)
    private boolean accepted;

    @Column(name = "acceptance_threshold", nullable = false, precision = 5, scale = 4)
    private BigDecimal acceptanceThreshold;

    @Column(name = "issues_json", columnDefinition = "json")
    private String issuesJson;

    @Column(name = "recommendations_json", columnDefinition = "json")
    private String recommendationsJson;

    @Column(name = "expires_at")
    private Instant expiresAt;
}
