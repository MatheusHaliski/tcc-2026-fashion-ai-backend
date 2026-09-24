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

import java.time.Instant;
import java.util.UUID;

/** FLAIR — território do Fashion Monopoly (distritos e boutiques) e do Conquest (regiões de estilo). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_territories")
public class FlairTerritory extends VersionedAuditableEntity {
    @Column(name = "map_code", nullable = false, length = 20)
    private String mapCode;

    @Column(name = "territory_code", nullable = false, length = 40)
    private String territoryCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User owner;

    @Column(name = "defender_json", columnDefinition = "json")
    private String defenderJson;

    @Column(name = "captured_at")
    private Instant capturedAt;

    @Column(nullable = false)
    private int defenses;
}
