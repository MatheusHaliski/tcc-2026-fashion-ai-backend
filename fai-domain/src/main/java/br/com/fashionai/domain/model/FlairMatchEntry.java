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

/** FLAIR — deck inscrito numa partida (lado A/B ou SOLO na batalha de ocasião). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_match_entries")
public class FlairMatchEntry extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private FlairMatch match;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scheme_id")
    private Scheme scheme;

    @Column(nullable = false, length = 10)
    private String side;

    @Column(name = "deck_power", nullable = false)
    private int deckPower;

    @Column(precision = 8, scale = 2)
    private BigDecimal score;

    @Column(name = "brand_pieces_json", columnDefinition = "json")
    private String brandPiecesJson;

}
