package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** HU18 — um dia da semana planejada (evento, ocasião e combinação de peças). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "week_plan_days")
public class WeekPlanDay extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "week_plan_id", nullable = false)
    private WeekPlan weekPlan;

    @Column(name = "day_date", nullable = false)
    private LocalDate dayDate;

    @Column(name = "event_label", length = 120)
    private String eventLabel;

    @Column(length = 40)
    private String occasion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scheme_id")
    private Scheme scheme;

    @Column(name = "piece_ids_json", columnDefinition = "json")
    private String pieceIdsJson;

    /** Chave canônica (ids ordenados) usada para garantir combinações sem repetição. */
    @Column(name = "combination_key", length = 512)
    private String combinationKey;

    @Column(length = 512)
    private String rationale;

    @Column(name = "edited_manually", nullable = false)
    private boolean editedManually;
}
