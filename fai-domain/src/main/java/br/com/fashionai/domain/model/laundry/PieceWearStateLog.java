package br.com.fashionai.domain.model.laundry;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Cada mudança de estado de uso com data (CA3). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "piece_wear_state_log")
public class PieceWearStateLog extends AuditableEntity {
    @Column(name = "piece_id", nullable = false, length = 36)
    private UUID pieceId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    @Column(name = "from_state", length = 10)
    private String fromState;

    @Column(name = "to_state", nullable = false, length = 10)
    private String toState;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @Column(length = 500)
    private String note;
}
