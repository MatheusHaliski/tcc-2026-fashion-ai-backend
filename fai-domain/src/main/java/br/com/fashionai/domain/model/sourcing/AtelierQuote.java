package br.com.fashionai.domain.model.sourcing;

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

/** Cotação do fornecedor: preço unitário, custo de amostra, prazo e validade; o aceite registra autor e versão. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "atelier_quotes", uniqueConstraints = @UniqueConstraint(name = "uq_quote_command", columnNames = {"quote_request_id", "supplier_id", "command_key"}))
public class AtelierQuote extends VersionedAuditableEntity {
    @Column(name = "quote_request_id", nullable = false, length = 36)
    private UUID quoteRequestId;

    @Column(name = "supplier_id", nullable = false, length = 36)
    private UUID supplierId;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "sample_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal sampleCost;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "lead_time_days", nullable = false)
    private int leadTimeDays;

    @Column(name = "valid_until", nullable = false)
    private LocalDate validUntil;

    @Column(length = 2000)
    private String notes;

    /** SUBMITTED, ACCEPTED, REJECTED. */
    @Column(nullable = false, length = 12)
    private String status = "SUBMITTED";

    @Column(name = "accepted_by", length = 36)
    private UUID acceptedBy;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "accepted_revision_id", length = 36)
    private UUID acceptedRevisionId;

    @Column(name = "accepted_project_version")
    private Long acceptedProjectVersion;

    @Column(name = "command_key", nullable = false, length = 80)
    private String commandKey;
}
