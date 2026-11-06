package br.com.fashionai.domain.model.passport;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Trilha da ordem de reparo com autoria; correções apontam para o evento corrigido e preservam o anterior. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "passport_repair_order_events")
public class PassportRepairOrderEvent extends AuditableEntity {
    @Column(name = "order_id", nullable = false, length = 36)
    private UUID orderId;

    @Column(name = "actor_id", nullable = false, length = 36)
    private UUID actorId;

    @Column(name = "actor_role", nullable = false, length = 10)
    private String actorRole;

    @Column(name = "from_status", length = 12)
    private String fromStatus;

    @Column(name = "to_status", nullable = false, length = 12)
    private String toStatus;

    @Column(length = 2000)
    private String notes;

    @Column(name = "corrects_event_id", length = 36)
    private UUID correctsEventId;
}
