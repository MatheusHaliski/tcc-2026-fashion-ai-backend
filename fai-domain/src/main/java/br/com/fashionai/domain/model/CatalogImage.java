package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF47 · Foto oficial com proveniência; REFERENCE_ONLY guarda só a URL autorizada. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_images")
public class CatalogImage extends VersionedAuditableEntity {
    @Column(name = "product_id", nullable = false, length = 36)
    private UUID productId;

    @Column(name = "variant_id", length = 36)
    private UUID variantId;

    @Column(name = "image_url", nullable = false, length = 1024)
    private String imageUrl;

    @Column(name = "image_url_hash", nullable = false, length = 64)
    private String imageUrlHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "image_type", nullable = false, length = 20)
    private CatalogImageType imageType;

    @Column(name = "source_url", length = 1024)
    private String sourceUrl;

    @Column(name = "source_domain", length = 160)
    private String sourceDomain;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 30)
    private CatalogSourceType sourceType;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    @Enumerated(EnumType.STRING)
    @Column(name = "usage_status", nullable = false, length = 30)
    private CatalogImageUsage usageStatus;

    @Column(name = "stored_url", length = 1024)
    private String storedUrl;

    @Column(name = "retrieved_at", nullable = false)
    private Instant retrievedAt;

    @Column(name = "last_verified_at")
    private Instant lastVerifiedAt;
}
