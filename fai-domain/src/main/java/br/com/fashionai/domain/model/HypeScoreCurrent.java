package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * HypeScore v2 — estado atual de uma entidade para uma versão do algoritmo (read model). Os cards leem esta tabela em
 * lote; o histórico fica em {@link HypeScoreSnapshot}. {@code publicEligible} = a entidade pode entrar em ranking,
 * tendência pública e estatística global (só conteúdo público e aprovado).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "hype_scores")
public class HypeScoreCurrent {
    @Id
    @Column(length = 36)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 10)
    private HypeEntityType entityType;

    @Column(name = "entity_id", nullable = false, length = 36)
    private UUID entityId;

    @Column(name = "owner_id", length = 36)
    private UUID ownerId;

    @Column(name = "algorithm_version", nullable = false, length = 20)
    private String algorithmVersion;

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

    /** variação em pontos contra o snapshot de {@code deltaWindowDays} atrás (nulo sem base de comparação) */
    @Column(name = "delta_points", precision = 7, scale = 2)
    private BigDecimal deltaPoints;

    @Column(name = "delta_percent", precision = 8, scale = 2)
    private BigDecimal deltaPercent;

    /** UP, DOWN ou STABLE */
    @Column(length = 10)
    private String direction;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private HypeMomentum momentum;

    @Column(name = "public_eligible", nullable = false)
    private boolean publicEligible;

    @Column(length = 40)
    private String category;

    @Column(length = 255)
    private String styles;

    @Column(length = 255)
    private String occasions;

    @Column(name = "signals_json", columnDefinition = "json")
    private String signalsJson;

    @Column(name = "reasons_json", columnDefinition = "json")
    private String reasonsJson;

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
