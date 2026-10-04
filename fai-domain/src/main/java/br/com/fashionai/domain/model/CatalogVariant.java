package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF47 · Variante de um produto (cor, código, SKU). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_variants")
public class CatalogVariant extends VersionedAuditableEntity {
    @Column(name = "product_id", nullable = false, length = 36)
    private UUID productId;

    @Column(name = "variant_key", nullable = false, length = 160)
    private String variantKey;

    @Column(name = "color", length = 80)
    private String color;

    @Column(name = "color_name", length = 120)
    private String colorName;

    @Column(name = "variant_code", length = 80)
    private String variantCode;

    @Column(name = "sku", length = 80)
    private String sku;

    @Column(name = "gtin", length = 20)
    private String gtin;

    @Column(name = "availability", length = 30)
    private String availability;
}
