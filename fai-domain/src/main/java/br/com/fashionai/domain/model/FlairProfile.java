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

/** FLAIR — perfil de jogo: coins, pontos de rank, vitórias e skins de carta (cosméticas). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_profiles")
public class FlairProfile extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private int coins;

    @Column(name = "rank_points", nullable = false)
    private int rankPoints;

    @Column(nullable = false)
    private int wins;

    @Column(nullable = false)
    private int losses;

    @Column(nullable = false)
    private int draws;

    @Column(name = "skins_json", columnDefinition = "json")
    private String skinsJson;

    @Column(name = "active_skin", length = 30)
    private String activeSkin;

}
