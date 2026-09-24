package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF36.CA08 — voto às cegas (único por votante/entrada). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "challenge_votes")
public class ChallengeVote implements org.springframework.data.domain.Persistable<UUID> {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "instance_id", nullable = false, length = 36)
    private UUID instanceId;

    @Column(name = "voter_user_id", nullable = false, length = 36)
    private UUID voterUserId;

    @Column(name = "entry_scheme_id", nullable = false, length = 36)
    private UUID entrySchemeId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

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
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
