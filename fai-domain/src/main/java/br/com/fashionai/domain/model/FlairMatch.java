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

/** FLAIR — partida: duelo 1×1, batalha de ocasião do dia, duelo de equipes 3×3 ou treino contra a Casa. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_matches")
public class FlairMatch extends VersionedAuditableEntity {
    @Column(nullable = false, length = 30)
    private String mode;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(length = 40)
    private String theme;

    @Column(name = "play_date")
    private LocalDate playDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @Column(name = "team_a_id", length = 36)
    private UUID teamAId;

    @Column(name = "team_b_id", length = 36)
    private UUID teamBId;

    @Column(name = "winner_side", length = 10)
    private String winnerSide;

    @Column(name = "result_json", columnDefinition = "json")
    private String resultJson;

}
