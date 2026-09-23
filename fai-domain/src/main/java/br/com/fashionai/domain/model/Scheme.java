package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ContainerOrigin;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.RenderStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

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
    private CreationMode creationMode;

    @Column(nullable = false, length = 160)
    private String style;

    @Column(nullable = false, length = 160)
    private String occasion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Visibility visibility = Visibility.PRIVADO;

    @Column(name = "community_indexed", nullable = false)
    private boolean communityIndexed;

    @Column(name = "cover_image_url", length = 1024)
    private String coverImageUrl;

    @Column(name = "background_art_url", length = 1024)
    private String backgroundArtUrl;

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

    @Column(name = "total_price", precision = 10, scale = 2)
    private BigDecimal totalPrice;

    @Column(name = "seals", length = 512)
    private String seals;

    @Enumerated(EnumType.STRING)
    @Column(name = "rendering_status", nullable = false, length = 30)
    private RenderStatus renderingStatus = RenderStatus.PENDING;

    @Column(name = "virtual_try_on_url", length = 1024)
    private String virtualTryOnUrl;

    @Column(name = "rendering_job_id")
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

    protected Scheme() {
    }
}
