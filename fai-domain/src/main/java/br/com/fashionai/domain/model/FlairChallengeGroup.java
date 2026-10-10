package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** FLAIR-UT §7.1 — grupo de Desafios de Montagem (ex.: "Lenda do estilo"): completar todos dá a recompensa do grupo. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_challenge_groups")
public class FlairChallengeGroup extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "names_json", columnDefinition = "json")
    private String namesJson;

    @Column(length = 600)
    private String description;

    @Column(name = "descriptions_json", columnDefinition = "json")
    private String descriptionsJson;

    @Column(nullable = false)
    private int points;

    /** Insígnia concedida ao completar o grupo (user_achievements); nula = sem insígnia. */
    @Column(name = "badge_code", length = 40)
    private String badgeCode;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
