package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF34 §6 — posição materializada por segmento (fatia superior inclusiva). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "ranking_positions")
public class RankingPosition {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(nullable = false, length = 80)
    private String segment;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private int total;

    @Column(name = "top_percent", nullable = false)
    private BigDecimal topPercent;

    @Column(nullable = false)
    private BigDecimal value;

    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
