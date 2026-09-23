package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF36 §4 — evidência verificável do progresso (esquema, look do dia, peça resgatada). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "challenge_events")
public class ChallengeEvent {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "instance_id", nullable = false, length = 36)
    private UUID instanceId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "evidence_type", nullable = false, length = 30)
    private String evidenceType;

    @Column(name = "ref_id", length = 36)
    private UUID refId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
