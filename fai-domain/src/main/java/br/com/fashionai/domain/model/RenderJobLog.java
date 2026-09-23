package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** RFC RF18 — render_jobs_log: linha append-only por renderização do provador 2D (custo por provedor). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "render_jobs_log")
public class RenderJobLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, length = 36)
    private UUID id;

    @Column(name = "pipeline_job_id", nullable = false, length = 36)
    private UUID pipelineJobId;

    @Column(name = "scheme_id", nullable = false, length = 36)
    private UUID schemeId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "rendering_type", length = 50)
    private String renderingType;

    @Column(length = 50)
    private String status;

    @Column(name = "total_processing_time_ms")
    private Integer totalProcessingTimeMs;

    @Column(name = "stage_times_json", columnDefinition = "json")
    private String stageTimesJson;

    @Column(name = "final_quality_score", precision = 5, scale = 4)
    private BigDecimal finalQualityScore;

    @Column(name = "cost_fashn_ai", precision = 10, scale = 5)
    private BigDecimal costFashnAi;

    @Column(name = "cost_cleanup_ai", precision = 10, scale = 5)
    private BigDecimal costCleanupAi;

    @Column(name = "cost_rembg", precision = 10, scale = 5)
    private BigDecimal costRembg;

    @Column(name = "total_cost", precision = 10, scale = 5)
    private BigDecimal totalCost;

    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;
}
