package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** RF-PESQ-01 — variante (cor e tamanho) de uma oferta da loja física, com estoque e reservas próprios. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "physical_store_variants", uniqueConstraints = @UniqueConstraint(name = "uq_store_variant_key", columnNames = {"listing_id", "variant_key"}))
public class PhysicalStoreVariant extends VersionedAuditableEntity {
    @Column(name = "listing_id", nullable = false, length = 36)
    private UUID listingId;

    /** Variante do catálogo global de onde a cor/SKU veio; opcional porque nem todo catálogo tem variantes. */
    @Column(name = "catalog_variant_id", length = 36)
    private UUID catalogVariantId;

    /** Chave normalizada "cor|tamanho" que impede duplicar a mesma combinação na oferta. */
    @Column(name = "variant_key", nullable = false, length = 200)
    private String variantKey;

    @Column(length = 80)
    private String sku;

    @Column(name = "color_name", length = 120)
    private String colorName;

    @Column(name = "size_label", nullable = false, length = 40)
    private String sizeLabel;

    @Column(name = "stock_quantity", nullable = false)
    private int stockQuantity;

    /** Unidades seguradas por provas físicas agendadas (RF-PESQ-07); não são vendáveis até expirar. */
    @Column(name = "reserved_quantity", nullable = false)
    private int reservedQuantity;

    @Column(nullable = false)
    private boolean active = true;

    /** Unidades que podem ser resgatadas agora. */
    public int available() {
        return Math.max(0, stockQuantity - reservedQuantity);
    }
}
