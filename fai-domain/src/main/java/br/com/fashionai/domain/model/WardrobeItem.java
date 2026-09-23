package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "wardrobe_items")
public class WardrobeItem extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_profile_id")
    private BrandProfile brandProfile;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(nullable = false, length = 80)
    private String category;

    @Column(nullable = false, length = 120)
    private String subcategory;

    @Column(length = 40)
    private String sex;

    @Column(name = "brand_name", length = 160)
    private String brandName;

    @Column(nullable = false, length = 80)
    private String color;

    @Column(nullable = false, length = 80)
    private String material;

    @Column(name = "size_label", length = 40)
    private String sizeLabel;

    @Column(length = 80)
    private String market;

    @Column(name = "style_tags", length = 512)
    private String styleTags;

    @Column(name = "occasion_tags", length = 512)
    private String occasionTags;

    @Column(name = "image_url", nullable = false, length = 1024)
    private String imageUrl;

    @Column(name = "image_hash", length = 128)
    private String imageHash;

    @Column(precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "is_favorite", nullable = false)
    private boolean favorite;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 40)
    private ModerationStatus moderationStatus = ModerationStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "photo_processing_status", nullable = false, length = 30)
    private PhotoProcessingStatus photoProcessingStatus = PhotoProcessingStatus.NEW;

    @Column(name = "photo_quality_scores_json", columnDefinition = "json")
    private String photoQualityScoresJson;

    @Column(name = "processing_job_id")
    private UUID processingJobId;

    @Column(name = "processing_time_ms")
    private Integer processingTimeMs;

    @Column(name = "flat_lay_metadata_json", columnDefinition = "json")
    private String flatLayMetadataJson;

    @Column(name = "moderation_confidence", precision = 5, scale = 4)
    private BigDecimal moderationConfidence;

    @Column(name = "hype_score", precision = 6, scale = 2)
    private BigDecimal hypeScore;

    @Column(name = "hype_score_global", precision = 6, scale = 2)
    private BigDecimal hypeScoreGlobal;

    protected WardrobeItem() {
    }
}
