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
import java.util.UUID;

/** RF-PESQ-04 — item da lista de materiais (material, aviamento, mão de obra, embalagem) de uma revisão imutável. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "atelier_bom_items", uniqueConstraints = @UniqueConstraint(name = "uq_bom_request", columnNames = {"project_id", "author_id", "request_id"}))
public class AtelierBomItem extends VersionedAuditableEntity {
    @Column(name = "project_id", nullable = false, length = 36)
    private UUID projectId;

    @Column(name = "revision_id", nullable = false, length = 36)
    private UUID revisionId;

    @Column(name = "author_id", nullable = false, length = 36)
    private UUID authorId;

    @Column(nullable = false, length = 12)
    private String kind;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(nullable = false, length = 20)
    private String unit;

    /** Consumo por unidade produzida. */
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    @Column(length = 1000)
    private String notes;

    @Column(name = "request_id", nullable = false, length = 80)
    private String requestId;

    @Column(name = "removed_at")
    private Instant removedAt;
}
