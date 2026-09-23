package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF35 §5.2 — regra de ganho por ação, com limite diário/semanal. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fai_points_rules")
public class FaiPointsRule {
    @Id
    @Column(name = "action_code", length = 40)
    private String actionCode;

    @Column(nullable = false)
    private int points;

    @Column(name = "daily_cap")
    private Integer dailyCap;

    @Column(name = "weekly_cap")
    private Integer weeklyCap;

    @Column(name = "once_per_ref", nullable = false)
    private boolean oncePerRef;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "description", length = 200)
    private String description;
}
