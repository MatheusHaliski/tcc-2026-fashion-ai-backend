package br.com.fashionai.domain.model;

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
}
