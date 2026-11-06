package br.com.fashionai.domain.model.fitting;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** RF-PESQ-07 — prova física agendada: REQUESTED → CONFIRMED | DECLINED | EXPIRED | CANCELLED → COMPLETED. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fitting_appointments", uniqueConstraints = @UniqueConstraint(name = "uq_fitting_appt_request", columnNames = {"user_id", "request_id"}))
public class FittingAppointment extends VersionedAuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "seller_id", nullable = false, length = 36)
    private UUID sellerId;

    @Column(nullable = false, length = 12)
    private String status = "REQUESTED";

    @Column(name = "requested_slot", nullable = false)
    private Instant requestedSlot;

    @Column(name = "confirmed_slot")
    private Instant confirmedSlot;

    /** Prazo da solicitação e das reservas temporárias. */
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(length = 1000)
    private String notes;

    /** Reservas já liberadas (expiração, cancelamento e conclusão são idempotentes). */
    @Column(nullable = false)
    private boolean released;

    @Column(name = "request_id", nullable = false, length = 80)
    private String requestId;
}
