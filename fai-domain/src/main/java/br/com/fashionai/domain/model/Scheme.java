package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.BackgroundAnimation;
import br.com.fashionai.domain.model.enums.ContainerOrigin;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DisplayMode;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.RenderStatus;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
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
import java.util.UUID;

/**
 * ClothesScheme (taxonomia §03) — esquema de vestimenta (RF5, RF6, RF7, RF9, RF11, RF18, RF19, RF20/21).
 * occasion/style guardam até 3 valores (CSV), sealIds até 4 (JSON). A configuração completa do
 * Background Studio (RF11: cor/gradiente, arte com IA, preset Aura, material, skin, anatomia, container)
 * fica em studioConfigJson; os campos de fundo "planos" existem para busca e renderização rápida.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "schemes")
public class Scheme extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_scheme_id")
    private Scheme originalScheme;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(length = 2048)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "creation_mode", nullable = false, length = 20)
    private CreationMode creationMode = CreationMode.MANUAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "origin", nullable = false, length = 20)
    private SchemeOrigin origin = SchemeOrigin.CRIAR_LOOK;

    @Column(nullable = false, length = 160)
    private String style;

    @Column(nullable = false, length = 160)
    private String occasion;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Season season;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Mood mood;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Visibility visibility = Visibility.PRIVATE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SchemeStatus status = SchemeStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "display_mode", nullable = false, length = 20)
    private DisplayMode displayMode = DisplayMode.GRID;

    @Column(nullable = false)
    private boolean disponivel = true;

    @Column(name = "look_do_dia", nullable = false)
    private boolean lookDoDia;

    @Column(name = "look_do_dia_count", nullable = false)
    private int lookDoDiaCount;

    @Column(name = "community_indexed", nullable = false)
    private boolean communityIndexed;

    @Column(name = "cover_image_url", length = 1024)
    private String coverImageUrl;

    @Column(name = "background_art_url", length = 1024)
    private String backgroundArtUrl;

    @Column(name = "background_color", length = 20)
    private String backgroundColor = "#F4F2EF";

    @Column(name = "background_gradient", length = 512)
    private String backgroundGradient;

    @Enumerated(EnumType.STRING)
    @Column(name = "background_animation_type", nullable = false, length = 20)
    private BackgroundAnimation backgroundAnimationType = BackgroundAnimation.NONE;

    @Column(name = "studio_config_json", columnDefinition = "json")
    private String studioConfigJson;

    @Column(name = "card_skin", length = 20)
    private String cardSkin = "atelier";

    @Column(name = "layout_anatomy", length = 40)
    private String layoutAnatomy = "LISTA_VERTICAL";

    @Column(name = "layout_density", length = 20)
    private String layoutDensity = "AMPLIADO";

    @Enumerated(EnumType.STRING)
    @Column(name = "container_origin", nullable = false, length = 20)
    private ContainerOrigin containerOrigin = ContainerOrigin.INDEFINIDA;

    @Column(name = "container_color", length = 20)
    private String containerColor;

    @Column(name = "container_mandatory", nullable = false)
    private boolean containerMandatory;

    @Column(name = "like_count", nullable = false)
    private long likeCount;

    @Column(name = "comment_count", nullable = false)
    private long commentCount;

    @Column(name = "share_count", nullable = false)
    private long shareCount;

    @Column(name = "remix_count", nullable = false)
    private long remixCount;

    @Column(name = "view_count", nullable = false)
    private long viewCount;

    @Column(name = "save_count", nullable = false)
    private long saveCount;

    @Column(name = "total_price", precision = 10, scale = 2)
    private BigDecimal totalPrice;

    @Column(name = "seal_ids_json", columnDefinition = "json")
    private String sealIdsJson;

    @Column(length = 512)
    private String tags;

    @Enumerated(EnumType.STRING)
    @Column(name = "rendering_status", nullable = false, length = 30)
    private RenderStatus renderingStatus = RenderStatus.PENDING;

    @Column(name = "virtual_try_on_url", length = 1024)
    private String virtualTryOnUrl;

    @Column(name = "rendering_job_id", length = 36)
    private UUID renderingJobId;

    @Column(name = "rendering_quality_json", columnDefinition = "json")
    private String renderingQualityJson;

    @Column(name = "cached_until")
    private Instant cachedUntil;

    @Column(name = "rendering_metadata_json", columnDefinition = "json")
    private String renderingMetadataJson;

    @Column(name = "hype_score", precision = 6, scale = 2)
    private BigDecimal hypeScore;

    @Column(name = "hype_score_global", precision = 6, scale = 2)
    private BigDecimal hypeScoreGlobal;

    @Column(name = "hype_group_id", length = 36)
    private UUID hypeGroupId;

    @Column(name = "grouping_id", length = 36)
    private UUID groupingId;

    /** RF9.CA5 — vínculo aprovado passa a "revalidação pendente" após edição. */
    @Column(name = "revalidation_pending", nullable = false)
    private boolean revalidationPending;

    @Column(name = "published_at")
    private Instant publishedAt;
}
