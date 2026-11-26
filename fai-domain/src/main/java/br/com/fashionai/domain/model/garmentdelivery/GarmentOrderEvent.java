package br.com.fashionai.domain.model.garmentdelivery;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Etapa observada de uma encomenda: no máximo uma linha por encomenda e etapa (materialização idempotente). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "garment_order_events", uniqueConstraints = @UniqueConstraint(name = "uq_garment_order_event", columnNames = {"order_id", "stage"}))
public class GarmentOrderEvent extends AuditableEntity {
    @Column(name = "order_id", nullable = false, length = 36)
    private UUID orderId;

    @Column(nullable = false, length = 20)
    private String stage;

    /** Instante em que a etapa aconteceu segundo o plano (ou a ação da pessoa, para cancelar e receber). */
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    public GarmentOrderEvent(UUID orderId, String stage, Instant occurredAt) {
        this.orderId = orderId;
        this.stage = stage;
        this.occurredAt = occurredAt;
    }
}
