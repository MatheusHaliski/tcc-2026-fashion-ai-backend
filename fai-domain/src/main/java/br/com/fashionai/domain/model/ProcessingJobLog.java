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

/** RFC RF4 — processing_jobs_log: linha append-only por job de padronização concluído (auditoria/custo). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "processing_jobs_log")
public class ProcessingJobLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, length = 36)
    private UUID id;

    @Column(name = "pipeline_job_id", nullable = false, length = 36)
    private UUID pipelineJobId;

    @Column(name = "wardrobe_item_id", length = 36)
    private UUID wardrobeItemId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "job_type", length = 50)
    private String jobType;

    @Column(length = 50)
    private String status;

    @Column(name = "total_processing_time_ms")
    private Integer totalProcessingTimeMs;

    @Column(name = "stage_times_json", columnDefinition = "json")
    private String stageTimesJson;

    @Column(name = "final_quality_score", precision = 5, scale = 4)
    private BigDecimal finalQualityScore;

    @Column(name = "total_cost_usd", precision = 10, scale = 5)
    private BigDecimal totalCostUsd;

    @Column(name = "was_accepted", nullable = false)
    private boolean accepted;

    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    @Column(name = "fallback_used", nullable = false)
    private boolean fallbackUsed;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;
}
