package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF36 §2 — catálogo de desafios (modos, duração, dimensões do score, recompensa). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "challenge_templates")
public class ChallengeTemplate {
    @Id
    @Column(length = 40)
    private String code;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "rule_text", nullable = false, length = 300)
    private String ruleText;

    @Column(name = "rule_blocks_json", columnDefinition = "json")
    private String ruleBlocksJson;

    @Column(name = "modes_allowed_json", nullable = false, columnDefinition = "json")
    private String modesAllowedJson;

    @Column(name = "duration_days")
    private Integer durationDays;

    @Column(name = "score_dimensions_json", columnDefinition = "json")
    private String scoreDimensionsJson;

    @Column(name = "reward_points", nullable = false)
    private int rewardPoints;

    @Column(nullable = false, length = 10)
    private String effort;

    @Column(name = "min_participants", nullable = false)
    private int minParticipants;

    @Column(name = "max_participants", nullable = false)
    private int maxParticipants;

    @Column(nullable = false, length = 20)
    private String origin;

    @Column(name = "author_user_id", length = 36)
    private UUID authorUserId;

    @Column(name = "room_decoration", length = 60)
    private String roomDecoration;

    @Column(nullable = false)
    private boolean active = true;
}
