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
public class ChallengeParticipant implements org.springframework.data.domain.Persistable<UUID> {
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

    /**
     * O id é atribuído no serviço antes do save(): sem este controle o Spring Data trataria a entidade como existente,
     * faria merge numa cópia e o objeto usado depois ficaria sem os campos do @PrePersist (created_at nulo no update).
     */
    @Transient
    @lombok.Getter(lombok.AccessLevel.NONE)
    @lombok.Setter(lombok.AccessLevel.NONE)
    private boolean newEntity = true;

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostLoad
    @PostPersist
    void markPersisted() {
        newEntity = false;
    }

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
