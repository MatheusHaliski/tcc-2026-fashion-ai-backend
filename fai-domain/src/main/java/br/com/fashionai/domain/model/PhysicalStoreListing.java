package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Physical product offered by an approved institutional seller for FAI Points. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "physical_store_listings")
public class PhysicalStoreListing extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "catalog_product_id", nullable = false)
    private CatalogProduct product;

    @Column(name = "seller_user_id", nullable = false, length = 36)
    private UUID sellerUserId;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "price_points", nullable = false)
    private int pricePoints;

    @Column(name = "required_level", nullable = false, length = 20)
    private String requiredLevel = "ESTREIA";

    @Column(name = "stock_quantity", nullable = false)
    private int stockQuantity;

    @Column(nullable = false)
    private boolean active = true;

    @Version
    @Column(nullable = false)
    private Long version;
}
