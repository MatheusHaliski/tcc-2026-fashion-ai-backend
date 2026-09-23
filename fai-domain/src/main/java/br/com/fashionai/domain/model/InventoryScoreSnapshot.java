package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF34 §7 — snapshot diário/mensal do Inventory Score (evolução, Rising Wardrobe, conquistas). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "inventory_score_snapshots")
public class InventoryScoreSnapshot {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "period_type", nullable = false, length = 10)
    private String periodType;

    @Column(name = "period_date", nullable = false)
    private LocalDate periodDate;

    @Column
    private Integer score;

    @Column(name = "dimensions_json", columnDefinition = "json")
    private String dimensionsJson;

    @Column(name = "metrics_json", columnDefinition = "json")
    private String metricsJson;

    @Column(nullable = false)
    private boolean eligible;

    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
