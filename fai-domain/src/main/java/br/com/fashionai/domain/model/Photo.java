package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
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
 * RF12 "Minhas Fotos" — metadados de cada fotografia do acervo (binário no S3/MinIO). Guarda origem,
 * hash, dimensões, qualidade (alimenta o Photo Curator AI), momento-chave e última visualização.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "photos")
public class Photo extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PhotoOrigin origin;

    @Column(name = "source_entity_id", length = 36)
    private UUID sourceEntityId;

    @Column(name = "storage_key", nullable = false, length = 512)
    private String storageKey;

    @Column(name = "public_url", length = 1024)
    private String publicUrl;

    @Column(name = "original_url", length = 1024)
    private String originalUrl;

    @Column(name = "thumbnail_url", length = 1024)
    private String thumbnailUrl;

    @Column(name = "content_hash", length = 128)
    private String contentHash;

    @Column(name = "mime_type", length = 60)
    private String mimeType;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "bytes_size")
    private Long bytesSize;

    @Column(name = "quality_score", precision = 5, scale = 4)
    private BigDecimal qualityScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 40)
    private ModerationStatus moderationStatus = ModerationStatus.PENDING;

    @Column(name = "key_moment", nullable = false)
    private boolean keyMoment;

    @Column(name = "edited_from_photo_id", length = 36)
    private UUID editedFromPhotoId;

    @Column(name = "last_viewed_at")
    private Instant lastViewedAt;

    @Column(name = "metadata_json", columnDefinition = "json")
    private String metadataJson;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
