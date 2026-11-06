package br.com.fashionai.domain.model.laundry;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** RF-PESQ-03 — estado de uso da peça: CLEAN, WORN ou IN_WASH. Não é condição física nem arquivo. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "piece_wear_states")
public class PieceWearState extends VersionedAuditableEntity {
    public static final String CLEAN = "CLEAN";
    public static final String WORN = "WORN";
    public static final String IN_WASH = "IN_WASH";

    @Column(name = "piece_id", nullable = false, unique = true, length = 36)
    private UUID pieceId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    @Column(nullable = false, length = 10)
    private String state = CLEAN;

    @Column(name = "batch_id", length = 36)
    private UUID batchId;

    /** A lavanderia retirou a peça da disponibilidade; só então ela é restaurada ao terminar. */
    @Column(name = "availability_withheld", nullable = false)
    private boolean availabilityWithheld;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;
}
