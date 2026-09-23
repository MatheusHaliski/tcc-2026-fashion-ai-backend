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

import java.time.Instant;
import java.util.UUID;

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

    @Column(name = "input_resource_id")
    private UUID inputResourceId;

    @Column(name = "output_url", length = 1024)
    private String outputUrl;

    @Column(name = "error_code", length = 120)
    private String errorCode;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    protected PipelineJob() {
    }
}
