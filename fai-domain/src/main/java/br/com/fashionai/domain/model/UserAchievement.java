package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF34 §4.3 / DET-G03 — conquista concedida uma única vez (idempotente). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_achievements")
public class UserAchievement {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "achievement_code", nullable = false, length = 40)
    private String achievementCode;

    @Column(nullable = false)
    private boolean secret;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
