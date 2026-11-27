package br.com.fashionai.domain.model.passport;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF-PESQ-05 — ordem de reparo: REQUESTED → QUOTED → AUTHORIZED → IN_SERVICE → DELIVERED | CANCELLED. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "passport_repair_orders", uniqueConstraints = @UniqueConstraint(name = "uq_repair_order_command", columnNames = {"passport_id", "owner_id", "command_key"}))
public class PassportRepairOrder extends VersionedAuditableEntity {
    @Column(name = "passport_id", nullable = false, length = 36)
    private UUID passportId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    @Column(name = "provider_id", nullable = false, length = 36)
    private UUID providerId;

    @Column(nullable = false, length = 12)
    private String status = "REQUESTED";

    @Column(name = "request_notes", length = 2000)
    private String requestNotes;

    @Column(length = 2000)
    private String diagnosis;

    @Column(name = "quote_amount", precision = 12, scale = 2)
    private BigDecimal quoteAmount;

    @Column(name = "quote_currency", length = 3)
    private String quoteCurrency;

    @Column(name = "quote_valid_until")
    private LocalDate quoteValidUntil;

    @Column(name = "authorized_at")
    private Instant authorizedAt;

    /** Somente o proprietário do passaporte; nunca um terceiro. */
    @Column(name = "authorized_by", length = 36)
    private UUID authorizedBy;

    @Column(name = "service_summary", length = 2000)
    private String serviceSummary;

    /** Declaração do prestador sobre o serviço feito: atestação de serviço, não certificação de autenticidade. */
    @Column(name = "provider_statement", length = 2000)
    private String providerStatement;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    /** PRIVATE (só dono e prestador) ou HISTORY_ONLY (evento no histórico do passaporte, sem recibo). */
    @Column(name = "share_scope", nullable = false, length = 20)
    private String shareScope = "PRIVATE";

    @Column(name = "access_revoked_at")
    private Instant accessRevokedAt;

    @Column(name = "passport_event_id", length = 36)
    private UUID passportEventId;

    @Column(name = "command_key", nullable = false, length = 80)
    private String commandKey;
}
