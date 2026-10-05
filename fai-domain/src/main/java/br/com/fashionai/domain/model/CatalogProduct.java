package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

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

    /** Variação (corte/silhueta/construção) — docs/taxonomia; lida do nome oficial por alias ou da curadoria. */
    @Column(name = "variation_code", length = 60)
    private String variationCode;

    @Column(name = "variation_status", length = 16)
    private String variationStatus;

    @Column(name = "variation_confidence", precision = 4, scale = 3)
    private BigDecimal variationConfidence;

    /** Quem escreveu a variação: CATALOG (dado oficial) · RULE · AI · USER (curadoria) — V45. */
    @Column(name = "variation_source", length = 12)
    private String variationSource;

    /** Atributos por dimensão (acabamento, comprimento, estilo, ocasião…), tabela catalog_product_attributes (V44). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "catalog_product_attributes", joinColumns = @JoinColumn(name = "product_id"))
    @BatchSize(size = 200)
    private Set<TaxonomyAttribute> attributes = new HashSet<>();

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

    /** ADULT · TEEN · KIDS · BABY */
    @Column(name = "age_group", length = 10)
    private String ageGroup;

    /** Preço oficial (JSON-LD offers da página do produto): Offer = min = max; AggregateOffer = lowPrice..highPrice. */
    @Column(name = "price_min", precision = 12, scale = 2)
    private BigDecimal priceMin;

    @Column(name = "price_max", precision = 12, scale = 2)
    private BigDecimal priceMax;

    /** Preço "de" (StrikethroughPrice), quando a página mostra desconto. */
    @Column(name = "list_price", precision = 12, scale = 2)
    private BigDecimal listPrice;

    @Column(name = "price_currency", length = 3)
    private String priceCurrency;

    /** JSONLD_OFFER · JSONLD_AGGREGATE · META · MANUAL */
    @Column(name = "price_source", length = 20)
    private String priceSource;

    @Column(name = "price_checked_at")
    private Instant priceCheckedAt;

    /** Versão das regras do enriquecimento (job fora do Flyway) que derivou variação/atributos; null = nunca rodou. */
    @Column(name = "enrichment_version", length = 40)
    private String enrichmentVersion;

    @Column(name = "enriched_at")
    private Instant enrichedAt;

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
