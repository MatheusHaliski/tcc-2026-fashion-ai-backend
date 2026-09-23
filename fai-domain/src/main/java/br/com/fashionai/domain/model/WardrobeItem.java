package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * ClothesPiece (taxonomia §02) — peça do guarda-roupa (RF4, RF6, RF7, RF9, RF18). Campos de formulário,
 * de sistema (pipeline Flat Lay, moderação, contadores sociais, hype score) e de lineage de remix.
 * Listas curtas (occasion/style ≤ 2, tags, selos ≤ 2) são armazenadas como JSON.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "wardrobe_items")
public class WardrobeItem extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_profile_id")
    private BrandProfile brandProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id")
    private Brand brand;

    @Column(nullable = false, length = 180)
    private String name;

    /** upper_piece · lower_piece · shoes_piece · accessory_piece · full_body_piece */
    @Column(nullable = false, length = 80)
    private String category;

    @Column(nullable = false, length = 120)
    private String subcategory;

    /** MASCULINO · FEMININO · UNISSEX — obrigatório (RF4.CA07), filtra o provador (RF18.CA08). */
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

    @Column(name = "seal_ids_json", columnDefinition = "json")
    private String sealIdsJson;

    @Column(name = "image_url", nullable = false, length = 1024)
    private String imageUrl;

    @Column(name = "original_image_url", length = 1024)
    private String originalImageUrl;

    @Column(name = "thumbnail_url", length = 1024)
    private String thumbnailUrl;

    @Column(name = "is_default_image", nullable = false)
    private boolean defaultImage;

    @Column(name = "image_hash", length = 128)
    private String imageHash;

    @Column(name = "image_mimetype", length = 60)
    private String imageMimetype;

    @Column(name = "image_file_size")
    private Long imageFileSize;

    @Column(precision = 10, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Visibility visibility = Visibility.PRIVATE;

    @Column(nullable = false)
    private boolean disponivel = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "availability_status", nullable = false, length = 20)
    private AvailabilityStatus availabilityStatus = AvailabilityStatus.AVAILABLE;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_condition", length = 20)
    private ItemCondition condition = ItemCondition.GOOD;

    @Column(name = "is_favorite", nullable = false)
    private boolean favorite;

    @Column(name = "for_sale", nullable = false)
    private boolean forSale;

    @Column(name = "wear_count", nullable = false)
    private int wearCount;

    @Column(name = "last_worn_date")
    private LocalDate lastWornDate;

    @Column(name = "look_do_dia_count", nullable = false)
    private int lookDoDiaCount;

    @Column(name = "scheme_usage_count", nullable = false)
    private int schemeUsageCount;

    @Column(name = "likes_count", nullable = false)
    private long likesCount;

    @Column(name = "shares_count", nullable = false)
    private long sharesCount;

    @Column(name = "remixes_count", nullable = false)
    private long remixesCount;

    @Column(name = "comment_count", nullable = false)
    private long commentCount;

    @Column(name = "view_count", nullable = false)
    private long viewCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 40)
    private ModerationStatus moderationStatus = ModerationStatus.PENDING;

    @Column(name = "moderation_confidence", precision = 5, scale = 4)
    private BigDecimal moderationConfidence;

    @Column(name = "moderation_reasons_json", columnDefinition = "json")
    private String moderationReasonsJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "photo_processing_status", nullable = false, length = 30)
    private PhotoProcessingStatus photoProcessingStatus = PhotoProcessingStatus.NEW;

    @Column(name = "photo_quality_scores_json", columnDefinition = "json")
    private String photoQualityScoresJson;

    @Column(name = "processing_job_id", length = 36)
    private UUID processingJobId;

    @Column(name = "processing_time_ms")
    private Integer processingTimeMs;

    @Column(name = "flat_lay_metadata_json", columnDefinition = "json")
    private String flatLayMetadataJson;

    /** Arte de fundo da peça isolada (RF11 subetapa 4.2 / RF9.CA6). */
    @Column(name = "background_config_json", columnDefinition = "json")
    private String backgroundConfigJson;

    @Column(name = "hype_score", precision = 6, scale = 2)
    private BigDecimal hypeScore;

    @Column(name = "hype_score_global", precision = 6, scale = 2)
    private BigDecimal hypeScoreGlobal;

    @Column(name = "hype_group_id", length = 36)
    private UUID hypeGroupId;

    @Column(name = "remixed_from_piece_id", length = 36)
    private UUID remixedFromPieceId;

    @Column(name = "grouping_id", length = 36)
    private UUID groupingId;

    @Column(length = 512)
    private String tags;

    @Column(length = 1024)
    private String notes;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(name = "purchase_location", length = 160)
    private String purchaseLocation;

    @Column(length = 80)
    private String sku;

    @Column(name = "care_instructions", length = 512)
    private String careInstructions;

    /** RF16 — tema futuro, desativado por feature flag. */
    @Enumerated(EnumType.STRING)
    @Column(name = "model3d_status", length = 20)
    private Model3dStatus model3dStatus;

    @Column(name = "model3d_url", length = 1024)
    private String model3dUrl;

    @Column(name = "model3d_generated_at")
    private Instant model3dGeneratedAt;

    @Column(name = "last_viewed_at")
    private Instant lastViewedAt;

    public void markAvailable(boolean available) {
        this.disponivel = available;
        this.availabilityStatus = available ? AvailabilityStatus.AVAILABLE : AvailabilityStatus.UNAVAILABLE;
    }
}
