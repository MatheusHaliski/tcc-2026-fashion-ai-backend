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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** FLAIR — equipe para os duelos de equipes 3×3 e a liga semanal. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_teams")
public class FlairTeam extends VersionedAuditableEntity {
    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, length = 12)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(length = 20)
    private String color;

    @Column(nullable = false)
    private int points;

}
