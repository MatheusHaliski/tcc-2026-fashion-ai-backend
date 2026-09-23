package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.WeekPlanStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** HU18 — Semana Planejada: sete looks sem repetição de combinação, com lacunas sugeridas. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "week_plans")
public class WeekPlan extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WeekPlanStatus status = WeekPlanStatus.ACTIVE;

    @Column(name = "gaps_json", columnDefinition = "json")
    private String gapsJson;
}
