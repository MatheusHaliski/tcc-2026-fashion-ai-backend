package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * RF-PESQ-08 — atributos funcionais de vestir declarados pela marca para um produto do catálogo. Cada campo é
 * tri-estado ({@code TRUE}/{@code FALSE}/{@code UNKNOWN}) ou um vocabulário com {@code UNKNOWN}; nada é inferido.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_accessibility_attributes")
public class CatalogAccessibilityAttributes extends VersionedAuditableEntity {
    @Column(name = "product_id", nullable = false, unique = true, length = 36)
    private UUID productId;

    @Column(name = "declared_by", nullable = false, length = 36)
    private UUID declaredBy;

    /** BRAND_SPEC, PHYSICAL_SAMPLE, SUPPLIER_SHEET: origem da declaração. */
    @Column(name = "declaration_source", nullable = false, length = 30)
    private String declarationSource;

    /** NONE, ZIPPER, BUTTONS, MAGNETIC, VELCRO, ELASTIC, HOOKS, UNKNOWN. */
    @Column(name = "closure_type", nullable = false, length = 20)
    private String closureType = "UNKNOWN";

    /** FRONT, BACK, SIDE, SHOULDER, NONE, UNKNOWN. */
    @Column(name = "opening_position", nullable = false, length = 20)
    private String openingPosition = "UNKNOWN";

    @Column(name = "magnetic_closure", nullable = false, length = 8)
    private String magneticClosure = "UNKNOWN";

    @Column(name = "tagless_label", nullable = false, length = 8)
    private String taglessLabel = "UNKNOWN";

    @Column(name = "flat_seams", nullable = false, length = 8)
    private String flatSeams = "UNKNOWN";

    /** SOFT, NEUTRAL, TEXTURED, UNKNOWN. */
    @Column(name = "fabric_contact", nullable = false, length = 20)
    private String fabricContact = "UNKNOWN";

    @Column(name = "one_hand_dressing", nullable = false, length = 8)
    private String oneHandDressing = "UNKNOWN";

    @Column(length = 1000)
    private String notes;

    /** DECLARED (marca) ou REVIEWED (equipe editorial). */
    @Column(name = "review_status", nullable = false, length = 12)
    private String reviewStatus = "DECLARED";

    @Column(name = "reviewed_by", length = 36)
    private UUID reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;
}
