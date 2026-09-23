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

import java.time.Instant;
import java.util.UUID;

/**
 * Agregados periódicos (RFC RF4 quality_metrics e RF18 rendering_costs) unificados por {@link #kind}:
 * QUALITY (aceite/tempo/score médio do Flat Lay) ou RENDER_COST (renders, custo por provedor, média).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "metric_snapshots")
public class MetricSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, length = 36)
    private UUID id;

    @Column(nullable = false, length = 30)
    private String kind;

    @Column(name = "period_start", nullable = false)
    private Instant periodStart;

    @Column(name = "period_end", nullable = false)
    private Instant periodEnd;

    @Column(name = "values_json", columnDefinition = "json")
    private String valuesJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
