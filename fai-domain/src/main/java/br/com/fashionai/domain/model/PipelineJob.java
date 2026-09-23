package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
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
import java.util.UUID;

/**
 * Job assíncrono (RF4 Flat Lay, RF18 render híbrido, RF5 render do card, RF11 geração de arte, RF24).
 * Estado canônico no MySQL (máquina de estados); o disparo vai para a fila (Redis Streams). Cada etapa
 * registra provedor, tempo e custo em stagesJson (RFC RF4/RF18 — ProcessingJob/OutfitRenderJob).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "pipeline_jobs")
public class PipelineJob extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private PipelineJobType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PipelineJobStatus status = PipelineJobStatus.PENDING;

    @Column(length = 80)
    private String provider;

    @Column(name = "external_job_id", length = 160)
    private String externalJobId;

    @Column(name = "target_type", length = 30)
    private String targetType;

    @Column(name = "input_resource_id", length = 36)
    private UUID inputResourceId;

    @Column(name = "input_json", columnDefinition = "json")
    private String inputJson;

    @Column(name = "output_url", length = 1024)
    private String outputUrl;

    @Column(name = "result_json", columnDefinition = "json")
    private String resultJson;

    @Column(name = "stages_json", columnDefinition = "json")
    private String stagesJson;

    @Column(name = "quality_score", precision = 5, scale = 4)
    private BigDecimal qualityScore;

    @Column(name = "total_cost_usd", precision = 10, scale = 5)
    private BigDecimal totalCostUsd;

    @Column(name = "total_time_ms")
    private Integer totalTimeMs;

    @Column(name = "fallback_used", nullable = false)
    private boolean fallbackUsed;

    @Column(name = "error_code", length = 120)
    private String errorCode;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    @Column(name = "queued_at")
    private Instant queuedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    public PipelineJob(User user, PipelineJobType type, String targetType, UUID inputResourceId) {
        this.user = user;
        this.type = type;
        this.targetType = targetType;
        this.inputResourceId = inputResourceId;
        this.queuedAt = Instant.now();
    }
}
