package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceStatus;
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

/** RF47 · Produto global conhecido pelo FashionAI (≠ WardrobeItem, a posse por uma pessoa). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_products")
public class CatalogProduct extends VersionedAuditableEntity {
    @Column(name = "brand_id", nullable = false, length = 36)
    private UUID brandId;

    @Column(name = "category", nullable = false, length = 80)
    private String category;

    @Column(name = "subcategory", nullable = false, length = 120)
    private String subcategory;

    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(name = "model_name", length = 160)
    private String modelName;

    @Column(name = "product_code", length = 80)
    private String productCode;

    @Column(name = "sku", length = 80)
    private String sku;

    @Column(name = "gtin", length = 20)
    private String gtin;

    @Column(name = "ean", length = 20)
    private String ean;

    @Column(name = "upc", length = 20)
    private String upc;

    @Column(name = "color", length = 80)
    private String color;

    @Column(name = "color_name", length = 120)
    private String colorName;

    @Column(name = "material", length = 40)
    private String material;

    @Column(name = "collection", length = 160)
    private String collection;

    @Column(name = "gender", length = 20)
    private String gender;

    @Column(name = "official_product_url", length = 1024)
    private String officialProductUrl;

    @Column(name = "canonical_url", length = 512)
    private String canonicalUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 30)
    private CatalogSourceType sourceType;

    @Column(name = "source_domain", length = 160)
    private String sourceDomain;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_status", nullable = false, length = 30)
    private CatalogSourceStatus sourceStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "ingestion_status", nullable = false, length = 30)
    private CatalogIngestionStatus ingestionStatus;

    @Column(name = "dedup_key", nullable = false, length = 255)
    private String dedupKey;

    /** Descrição oficial do produto (de onde sai o design quando a fonte não traz design estruturado). */
    @Column(name = "description", columnDefinition = "text")
    private String description;

    /** Características únicas da peça (estampa, logo, lados, cores da peça × da estampa) — ver DesignTraits. */
    @Column(name = "design_json", columnDefinition = "json")
    private String designJson;

    @Column(name = "search_text", nullable = false, columnDefinition = "text")
    private String searchText;

    @Column(name = "metadata_json", columnDefinition = "json")
    private String metadataJson;

    @Column(name = "owners_count", nullable = false)
    private int ownersCount;

    @Column(name = "first_seen_at", nullable = false)
    private Instant firstSeenAt;

    @Column(name = "last_verified_at")
    private Instant lastVerifiedAt;
}
