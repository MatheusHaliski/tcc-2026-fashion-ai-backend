package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF36 — participante: equipe (duelo de equipes), status, meta pessoal proporcional e fração cumprida. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "challenge_participants")
public class ChallengeParticipant {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "instance_id", nullable = false, length = 36)
    private UUID instanceId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(length = 2)
    private String team;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "joined_at")
    private Instant joinedAt;

    @Column(name = "left_at")
    private Instant leftAt;

    @Column(name = "personal_goal_json", columnDefinition = "json")
    private String personalGoalJson;

    @Column(name = "progress_fraction", nullable = false)
    private BigDecimal progressFraction = BigDecimal.ZERO;

    @Column(name = "best_record", nullable = false)
    private int bestRecord;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
