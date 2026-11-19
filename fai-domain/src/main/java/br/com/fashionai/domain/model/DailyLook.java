package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.DailyLookAudience;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.DailyLookPurpose;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * saiDailyLooks (RF6 §1) — registro datado do Look do Dia: fonte de verdade para histórico,
 * continuidade na virada do dia (materialização lazy) e comparação com o dia anterior.
 *
 * <p>Look do Dia Vivido F1 (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md §5): o contexto do dia (propósito, para quem e
 * as marcas do calendário congeladas na data — dia da semana, estação, clima, Momentos) mora aqui, no registro datado,
 * porque o mesmo look pode ser vestido para uma entrevista na segunda e para um jantar no sábado.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "daily_looks", uniqueConstraints = @UniqueConstraint(name = "uq_daily_looks_user_date", columnNames = {"user_id", "look_date"}))
public class DailyLook extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private Scheme scheme;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "materialized_from_id")
    private DailyLook materializedFrom;

    @Column(name = "look_date", nullable = false)
    private LocalDate lookDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DailyLookSource source = DailyLookSource.MANUAL;

    public DailyLook(User user, Scheme scheme, LocalDate lookDate, DailyLookSource source) {
        this.user = user;
        this.scheme = scheme;
        this.lookDate = lookDate;
        this.source = source;
    }

    /** HU19 — avaliação do look do dia. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private DailyLookFeedback feedback;

    @Column(name = "feedback_at")
    private java.time.Instant feedbackAt;

    @Column(name = "week_plan_day_id", length = 36)
    private java.util.UUID weekPlanDayId;

    /** Para quê a pessoa se vestiu (nulo = não informado). */
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private DailyLookPurpose purpose;

    /** "Hoje eu vesti isso para…" — frase livre da pessoa. */
    @Column(name = "purpose_note", length = 140)
    private String purposeNote;

    /** Quem vai ver a pessoa naquele dia. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private DailyLookAudience audience;

    /** Marcas do calendário congeladas no dia: [{kind: WEEKDAY|SEASON|WEATHER|MOMENT, code, label, …}]. */
    @Column(name = "calendar_marks_json", columnDefinition = "json")
    private String calendarMarksJson;
}
