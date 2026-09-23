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

import java.time.LocalDate;

@Entity
@Table(
        name = "daily_looks",
        uniqueConstraints = @UniqueConstraint(name = "uq_daily_looks_user_date", columnNames = {"user_id", "look_date"})
)
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

    protected DailyLook() {
    }
}
