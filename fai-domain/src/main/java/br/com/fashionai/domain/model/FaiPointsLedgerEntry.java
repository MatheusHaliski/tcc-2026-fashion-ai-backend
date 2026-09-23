package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF35.CA01 — ledger append-only com chave de idempotência (user_id, action_code, ref_id). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fai_points_ledger")
public class FaiPointsLedgerEntry {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false)
    private int delta;

    @Column(name = "action_code", nullable = false, length = 40)
    private String actionCode;

    @Column(name = "ref_type", length = 30)
    private String refType;

    @Column(name = "ref_id", length = 64)
    private String refId;

    @Column(name = "idempotency_key", nullable = false, length = 160, unique = true)
    private String idempotencyKey;

    @Column(name = "counts_lifetime", nullable = false)
    private boolean countsLifetime = true;

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
