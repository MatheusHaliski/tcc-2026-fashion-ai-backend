package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * HypeScore v2 — ponto da série histórica (1 por entidade, versão do algoritmo e dia). Nunca é sobrescrito por outra
 * versão: trocar pesos ou fórmula gera uma nova {@code algorithmVersion} (HYPE_V2, HYPE_V3…) e séries separadas.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "hype_score_snapshots")
public class HypeScoreSnapshot {
    @Id
    @Column(length = 36)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 10)
    private HypeEntityType entityType;

    @Column(name = "entity_id", nullable = false, length = 36)
    private UUID entityId;

    @Column(name = "algorithm_version", nullable = false, length = 20)
    private String algorithmVersion;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private HypeStatus status;

    @Column(precision = 6, scale = 2)
    private BigDecimal score;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private HypeLevel level;

    @Embedded
    private HypeDimensions dimensions = new HypeDimensions();

    @Column(name = "public_eligible", nullable = false)
    private boolean publicEligible;

    @Column(name = "window_start", nullable = false)
    private Instant windowStart;

    @Column(name = "window_end", nullable = false)
    private Instant windowEnd;

    @Column(name = "calculated_at", nullable = false)
    private Instant calculatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
