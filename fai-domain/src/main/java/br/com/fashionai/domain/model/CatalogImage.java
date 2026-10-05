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

    // ── pipeline de imagens (V38): metadados da análise; nível B também grava o master em stored_url/assets_json ──
    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "mime", length = 20)
    private String mime;

    @Column(name = "source_sha256", length = 64)
    private String sourceSha256;

    @Column(name = "phash", length = 16)
    private String phash;

    /** estado do job: PENDING, DOWNLOADING, APPROVED, NEEDS_REPROCESSING, REJECTED, FAILED */
    @Column(name = "processing_status", nullable = false, length = 24)
    private String processingStatus = "PENDING";

    @Column(name = "pipeline_version", length = 40)
    private String pipelineVersion;

    @Column(name = "quality_score", precision = 5, scale = 4)
    private java.math.BigDecimal qualityScore;

    @Column(name = "gate_reasons", length = 500)
    private String gateReasons;

    /** CANONICAL, ALTERNATE, DETAIL, DUPLICATE, REJECTED, REVIEW */
    @Column(name = "view_role", length = 20)
    private String viewRole;

    @Column(name = "is_canonical", nullable = false)
    private boolean canonical;

    /** NONE, PENDING, APPROVED, REJECTED (CatalogImageReviewQueue) */
    @Column(name = "review_status", nullable = false, length = 20)
    private String reviewStatus = "NONE";

    @Column(name = "crop_json", columnDefinition = "json")
    private String cropJson;

    @Column(name = "metrics_json", columnDefinition = "json")
    private String metricsJson;

    @Column(name = "assets_json", columnDefinition = "json")
    private String assetsJson;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "retrieved_at", nullable = false)
    private Instant retrievedAt;

    @Column(name = "last_verified_at")
    private Instant lastVerifiedAt;
}
