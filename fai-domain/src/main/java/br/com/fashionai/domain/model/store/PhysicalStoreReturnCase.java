package br.com.fashionai.domain.model.store;

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

/** RF-PESQ-02 — caso de troca/devolução de um pedido da loja física, com a política congelada no pedido. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "physical_store_return_cases", uniqueConstraints = @UniqueConstraint(name = "uq_return_case_command", columnNames = {"order_id", "buyer_id", "command_key"}))
public class PhysicalStoreReturnCase extends VersionedAuditableEntity {
    @Column(name = "order_id", nullable = false, length = 36)
    private UUID orderId;

    @Column(name = "buyer_id", nullable = false, length = 36)
    private UUID buyerId;

    @Column(name = "seller_id", nullable = false, length = 36)
    private UUID sellerId;

    /** RETURN (estorno) ou EXCHANGE (outra variante da mesma oferta). */
    @Column(nullable = false, length = 10)
    private String kind;

    @Column(name = "reason_code", nullable = false, length = 30)
    private String reasonCode;

    @Column(name = "reason_notes", length = 2000)
    private String reasonNotes;

    @Column(name = "variant_id", length = 36)
    private UUID variantId;

    @Column(name = "exchange_variant_id", length = 36)
    private UUID exchangeVariantId;

    @Column(name = "exchange_order_id", length = 36)
    private UUID exchangeOrderId;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "policy_version", nullable = false, length = 20)
    private String policyVersion;

    @Column(name = "window_days", nullable = false)
    private int windowDays;

    @Column(name = "deadline_at", nullable = false)
    private Instant deadlineAt;

    /** AS_DECLARED ou DIVERGENT; preenchido somente na inspeção. */
    @Column(name = "inspection_outcome", length = 20)
    private String inspectionOutcome;

    @Column(name = "divergence_reason", length = 1000)
    private String divergenceReason;

    @Column(nullable = false)
    private boolean restocked;

    /** Chave de idempotência do lançamento de estorno; preenchida uma única vez. */
    @Column(name = "refund_ref", length = 120)
    private String refundRef;

    @Column(name = "fit_feedback_consent", nullable = false)
    private boolean fitFeedbackConsent;

    @Column(name = "command_key", nullable = false, length = 80)
    private String commandKey;

    @Column(name = "closed_at")
    private Instant closedAt;
}
