package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF47 · Execução do pipeline de ingestão do catálogo (auditoria). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_ingestion_runs")
public class CatalogIngestionRun extends VersionedAuditableEntity {
    @Column(name = "kind", nullable = false, length = 30)
    private String kind;

    @Column(name = "source", length = 255)
    private String source;

    @Column(name = "dry_run", nullable = false)
    private boolean dryRun;

    @Column(name = "total_read", nullable = false)
    private int totalRead;

    @Column(name = "created_count", nullable = false)
    private int createdCount;

    @Column(name = "updated_count", nullable = false)
    private int updatedCount;

    @Column(name = "skipped_count", nullable = false)
    private int skippedCount;

    @Column(name = "duplicates_count", nullable = false)
    private int duplicatesCount;

    @Column(name = "error_count", nullable = false)
    private int errorCount;

    @Column(name = "report_json", columnDefinition = "json")
    private String reportJson;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;
}
