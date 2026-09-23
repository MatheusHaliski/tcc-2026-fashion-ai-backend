package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.GroupingType;
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

/** SchemeGrouping (taxonomia §07, RF14/RF22) — coleção/promoção/série/era/fase/temporada/turnê. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "scheme_groupings")
public class SchemeGrouping extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private GroupingType type;

    @Column(nullable = false, length = 160)
    private String label;

    @Column(length = 1024)
    private String description;

    @Column(name = "cover_url", length = 1024)
    private String coverUrl;

    /** RF6.CA19 — a era de celebridade é atmosfera, nunca retrato: prompt validado antes do envio. */
    @Column(name = "atmosphere_prompt", length = 1024)
    private String atmospherePrompt;
}
