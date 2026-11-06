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

/** Lote de lavagem com a instrução declarada pela pessoa (WASHING → DONE | CANCELLED). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "laundry_batches")
public class LaundryBatch extends VersionedAuditableEntity {
    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    @Column(nullable = false, length = 12)
    private String status = "WASHING";

    /** Código do TipoLavagem escolhido para o lote, quando houver. */
    @Column(name = "instruction_code", length = 30)
    private String instructionCode;

    @Column(length = 1000)
    private String instructions;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;
}
