package br.com.fashionai.domain.model.sourcing;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** RF-PESQ-06 — pedido de amostra/lote: congela revisão, BOM e tolerâncias; aprovação explícita por quem decide. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "atelier_production_requests", uniqueConstraints = @UniqueConstraint(name = "uq_production_request", columnNames = {"project_id", "requested_by", "request_id"}))
public class AtelierProductionRequest extends VersionedAuditableEntity {
    @Column(name = "project_id", nullable = false, length = 36)
    private UUID projectId;

    @Column(name = "revision_id", nullable = false, length = 36)
    private UUID revisionId;

    @Column(name = "requested_by", nullable = false, length = 36)
    private UUID requestedBy;

    @Column(name = "producer_id", nullable = false, length = 36)
    private UUID producerId;

    @Column(name = "quote_id", length = 36)
    private UUID quoteId;

    @Lob
    @Column(name = "bom_snapshot_json", nullable = false, columnDefinition = "LONGTEXT")
    private String bomSnapshotJson;

    @Column(name = "tolerances_json", nullable = false, length = 4000)
    private String tolerancesJson;

    /** SAMPLE_REQUESTED, SAMPLE_RECEIVED, DEVIATIONS_RECORDED, APPROVED, RETURNED, CANCELLED. */
    @Column(nullable = false, length = 22)
    private String status = "SAMPLE_REQUESTED";

    @Column(name = "approved_by", length = 36)
    private UUID approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_project_version")
    private Long approvedProjectVersion;

    @Column(name = "request_id", nullable = false, length = 80)
    private String requestId;
}
