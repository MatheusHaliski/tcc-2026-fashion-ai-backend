package br.com.fashionai.domain.model.sourcing;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Pedido de cotação a um fornecedor convidado: revisão imutável, quantidades por tamanho e moeda. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "atelier_quote_requests", uniqueConstraints = @UniqueConstraint(name = "uq_quote_request", columnNames = {"project_id", "requested_by", "request_id"}))
public class AtelierQuoteRequest extends VersionedAuditableEntity {
    @Column(name = "project_id", nullable = false, length = 36)
    private UUID projectId;

    @Column(name = "revision_id", nullable = false, length = 36)
    private UUID revisionId;

    @Column(name = "requested_by", nullable = false, length = 36)
    private UUID requestedBy;

    @Column(name = "supplier_id", nullable = false, length = 36)
    private UUID supplierId;

    @Column(nullable = false, length = 3)
    private String currency;

    /** {"P": 10, "M": 20} — quantidades por tamanho comercial. */
    @Column(name = "sizes_json", nullable = false, length = 2000)
    private String sizesJson;

    @Column(length = 2000)
    private String notes;

    /** OPEN, QUOTED, ACCEPTED, DECLINED, WITHDRAWN. */
    @Column(nullable = false, length = 12)
    private String status = "OPEN";

    @Column(name = "request_id", nullable = false, length = 80)
    private String requestId;
}
