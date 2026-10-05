package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
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
import org.hibernate.annotations.BatchSize;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * ClothesPiece (taxonomia §02) — peça do guarda-roupa (RF4, RF6, RF7, RF9, RF18). Campos de formulário,
 * de sistema (pipeline Flat Lay, moderação, contadores sociais, hype score) e de lineage de remix.
 * Listas curtas (occasion/style ≤ 2, tags, selos ≤ 2) são armazenadas como CSV; estilo e ocasião também vão para
 * {@link #attributes} junto das outras dimensões da taxonomia.
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

    /** Variação (corte/silhueta/construção) da subcategoria — docs/taxonomia; null = não informada. */
    @Column(name = "variation_code", length = 60)
    private String variationCode;

    /** USER_CONFIRMED · AI_SUGGESTED · NEEDS_REVIEW · UNKNOWN */
    @Column(name = "variation_status", length = 16)
    private String variationStatus;

    @Column(name = "variation_confidence", precision = 4, scale = 3)
    private BigDecimal variationConfidence;

    /** Atributos por dimensão (acabamento, comprimento, cintura, estilo, ocasião…), tabela wardrobe_item_attributes (V42). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "wardrobe_item_attributes", joinColumns = @JoinColumn(name = "item_id"))
    @BatchSize(size = 100)
    private Set<TaxonomyAttribute> attributes = new HashSet<>();

    /** MASCULINO · FEMININO · UNISSEX — obrigatório (RF4.CA07), filtra o provador (RF18.CA08). */
    @Column(length = 40)
    private String sex;

    @Column(name = "brand_name", length = 160)
    private String brandName;

    /** RF4 — logo da marca escolhido no buscador web, já filtrado (fundo branco, letras pretas nítidas) e guardado no storage próprio. */
    @Column(name = "brand_logo_url", length = 1024)
    private String brandLogoUrl;

    /** RF4 — fonte da marca: WIKIDATA · SIMPLE_ICONS · IA_BUSCA_WEB · PLATAFORMA · TEXTO_LIVRE. */
    @Column(name = "brand_source", length = 40)
    private String brandSource;

    /** RF4 — referência externa da marca (id do Wikidata, slug do Simple Icons ou URL de origem). */
    @Column(name = "brand_ref", length = 255)
    private String brandRef;

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

    /** RF4 · a foto da peça foi recriada por IA (a pedido da pessoa): o app mostra o selo "gerada por IA". */
    @Column(name = "is_ai_generated_image", nullable = false)
    private boolean aiGeneratedImage;

    @Column(name = "image_hash", length = 128)
    private String imageHash;

    @Column(name = "image_mimetype", length = 60)
    private String imageMimetype;

    @Column(name = "image_file_size")
    private Long imageFileSize;

    @Column(precision = 10, scale = 2)
    private BigDecimal price;

    /** ISO 4217 (o preço da peça é em reais por padrão). */
    @Column(name = "price_currency", nullable = false, length = 3)
    private String priceCurrency = "BRL";

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

    /** RF4 · Estúdio: foto de produto (fundo de estúdio, luz e sombra) exibida na vitrine; o recorte segue em imageUrl. */
    @Column(name = "studio_image_url", length = 1024)
    private String studioImageUrl;

    @Column(name = "studio_backdrop", length = 30)
    private String studioBackdrop;

    /** RF4 · Estúdio: foto de detalhe 4:5 enquadrada no logo (null quando a peça não tem logo identificado). */
    @Column(name = "studio_detail_url", length = 1024)
    private String studioDetailUrl;

    /** RF4 · asset canônico frontal (determinístico, sem geração) — o fiel para busca, provador e dataset. */
    @Column(name = "canonical_image_url", length = 1024)
    private String canonicalImageUrl;

    /** RF4 · sessão de captura adaptativa que originou a peça (fotos originais, canônicos e identificação). */
    @Column(name = "capture_session_id", length = 36)
    private java.util.UUID captureSessionId;

    /** RF47 · produto global do catálogo que esta peça pessoal possui (referência, sem cópia de foto nem metadados). */
    @Column(name = "catalog_product_id", length = 36)
    private java.util.UUID catalogProductId;

    @Column(name = "catalog_variant_id", length = 36)
    private java.util.UUID catalogVariantId;

    /** RF47 · origem da imagem principal: CATALOG (foto oficial), USER_PHOTO ou DEFAULT. */
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(name = "image_origin", length = 20)
    private br.com.fashionai.domain.model.enums.ImageOrigin imageOrigin;

    /** RF47 · foto da própria pessoa (a peça real), separada da foto oficial do produto. */
    @Column(name = "user_image_url", length = 1024)
    private String userImageUrl;

    @Column(name = "model3d_generated_at")
    private Instant model3dGeneratedAt;

    @Column(name = "last_viewed_at")
    private Instant lastViewedAt;

    public void markAvailable(boolean available) {
        this.disponivel = available;
        this.availabilityStatus = available ? AvailabilityStatus.AVAILABLE : AvailabilityStatus.UNAVAILABLE;
    }

    /** DET-M07 — origem da peça: COMPRADA, GARIMPADA, HERDADA, PRESENTE, FEITA_A_MAO, TROCADA. */
    @Column(name = "piece_origin", length = 20)
    private String pieceOrigin;

    /** Foto com meu manequim (RF4/RF5): a peça ou o look vestindo o manequim da pessoa (ou o padrão masc./fem.). */
    @Column(name = "mannequin_image_url", length = 1024)
    private String mannequinImageUrl;

    /** FOTO (rosto da foto de perfil) ou PADRAO (manequim padrão, sem foto de perfil). */
    @Column(name = "mannequin_image_face", length = 20)
    private String mannequinImageFace;
}
