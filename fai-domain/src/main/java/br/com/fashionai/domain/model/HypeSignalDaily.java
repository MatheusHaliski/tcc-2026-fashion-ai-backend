package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * HypeScore v2 — agregado diário de um sinal por entidade (EntityInteractionAggregate). {@code weightedCount} aplica o
 * peso da política de integridade (ex.: conta nova pesa menos); {@code eventCount} é a contagem bruta aceita.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "hype_signal_daily")
public class HypeSignalDaily {
    @Id
    @Column(length = 36)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 10)
    private HypeEntityType entityType;

    @Column(name = "entity_id", nullable = false, length = 36)
    private UUID entityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "signal_type", nullable = false, length = 30)
    private HypeSignalType signalType;

    @Column(name = "signal_date", nullable = false)
    private LocalDate signalDate;

    @Column(name = "event_count", nullable = false)
    private int eventCount;

    @Column(name = "weighted_count", nullable = false, precision = 12, scale = 3)
    private BigDecimal weightedCount = BigDecimal.ZERO;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }
}
